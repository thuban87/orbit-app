/**
 * Incremental bulk import orchestration. Each row owns its own transaction so
 * a bad source snapshot never rolls back contacts imported before it.
 */
import {
  deferNeedsReview,
  finalizeSessionIfTerminal,
  type ImportLifecycle,
  type ImportSessionRowStatus,
  markRowPhotoFailed,
  markRowStatus,
  resolveAlreadyLinked,
} from "@/db/import-session-dao";
import {
  getSessionById,
  type ImportSessionRow,
  listSessionRows,
  type SessionSummaryCounts,
  sessionBatchLifecycle,
  sessionSummaryCounts,
} from "@/db/import-session-read";
import { importContactRecord } from "@/db/imported-contact-dao";
import type { SqlExecutor } from "@/db/types";
import { mapPickedContact } from "@/logic/picked-contact-map";
import { scoreImportCandidate } from "@/services/import/duplicate-evidence";
import type { BoundImportEffects } from "@/services/import/import-lifecycle-effects";
import {
  importedPhotoFs,
  persistImportedPhotoPostCommit,
} from "@/services/import/import-photo";
import { withImportRun } from "@/services/import/import-run-guard";
import { Logger } from "@/utils/logger";
import type { PickedContact } from "../../../modules/orbit-contact-picker";

/** Kept deliberately small so a picker-sized batch yields to the JS thread. */
export const CHUNK_SIZE = 10;

export interface ImportRowAsNewParams {
  row: ImportSessionRow;
  batchCategoryId: number | null;
  /** The session's batch lifecycle (`sessionBatchLifecycle(session)`; D-57). */
  lifecycle: ImportLifecycle;
  phoneRegion: string | null;
  now: string;
}

export type ImportRowAsNewResult =
  | { contactId: number; skipped?: never }
  | { contactId: null; skipped: "name-required" };

export interface RunImportBatchParams {
  sessionId: number;
  now: string;
  onProgress?: (done: number, total: number) => void;
  eligibleStatuses?: ImportSessionRowStatus[];
  /** An in-pass override; the durable session value is the normal source. */
  batchCategoryId?: number | null;
  /**
   * Post-commit reminder/widget effects after a Bound pass (D-57). Tests inject
   * a spy; the default lazily imports `import-lifecycle-effects`, which pulls in
   * native modules. The batch lifecycle itself is never a parameter here: it
   * is read from the session so a resume keeps it.
   */
  effects?: BoundImportEffects;
}

function pickedFromRow(row: ImportSessionRow): PickedContact {
  return JSON.parse(row.sourcePayload) as PickedContact;
}

/**
 * Run the Bound import effects once, post-commit and best-effort (D-57): a
 * failure — including a failed lazy import — is logged and never rethrown.
 */
async function runBoundImportEffects(
  exec: SqlExecutor,
  effects: BoundImportEffects | undefined,
): Promise<void> {
  try {
    const run =
      effects ??
      (await import("@/services/import/import-lifecycle-effects"))
        .applyBoundImportEffects;
    await run(exec);
  } catch (error) {
    Logger.error("import-driver", "Bound import effects failed", error);
  }
}

function failureReason(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "")
    return error.message;
  return "import-failed";
}

/**
 * The single bulk create chokepoint shared by the driver and review imports.
 * It deliberately rejects nameless Android records before contact creation.
 */
export async function importRowAsNew(
  exec: SqlExecutor,
  params: ImportRowAsNewParams,
): Promise<ImportRowAsNewResult> {
  const picked = pickedFromRow(params.row);
  const mapped = mapPickedContact(picked, {
    categoryId: params.batchCategoryId,
    effectivePhoneRegion: params.phoneRegion,
  });
  if (mapped.nameRequired) {
    await markRowStatus(
      exec,
      params.row.id,
      "skipped",
      "name-required",
      params.now,
    );
    return { contactId: null, skipped: "name-required" };
  }

  const { contactId } = await importContactRecord(exec, {
    input: mapped.input,
    lifecycle: params.lifecycle,
    externalLinks: [
      {
        provider: "android",
        externalContactId: params.row.externalContactId,
      },
    ],
    birthday: mapped.birthday,
    note: mapped.note,
    now: params.now,
    resolveRow: { rowId: params.row.id, matchOutcome: "new" },
  });
  const photo = await persistImportedPhotoPostCommit(exec, importedPhotoFs, {
    contactId,
    rowId: params.row.id,
    stagedPhotoPath: params.row.photoRelPath,
    now: params.now,
  });
  if (!photo.ok) {
    try {
      await markRowPhotoFailed(exec, params.row.id, params.now);
    } catch (error) {
      Logger.error(
        "import-driver",
        `could not mark photo failure for import row ${params.row.id}`,
        error,
      );
    }
  }
  return { contactId };
}

/**
 * Classify and process one logical import without a batch-wide transaction.
 * Ambiguous source records remain durable review work while safe rows proceed.
 *
 * 38.4 D-74 (owner): one pass per session at a time. A call while a pass for
 * the session is in flight rejects with `ImportRunActiveError` and processes
 * nothing, since both passes would work through the same pending snapshot.
 * Import Progress follows the running pass instead (`followImportRun`).
 */
export function runImportBatch(
  exec: SqlExecutor,
  params: RunImportBatchParams,
): Promise<SessionSummaryCounts> {
  return withImportRun(params.sessionId, (report) =>
    runImportPass(exec, {
      ...params,
      onProgress: (done, total) => {
        params.onProgress?.(done, total);
        report(done, total);
      },
    }),
  );
}

async function runImportPass(
  exec: SqlExecutor,
  params: RunImportBatchParams,
): Promise<SessionSummaryCounts> {
  const session = await getSessionById(exec, params.sessionId);
  if (!session)
    throw new Error(`runImportBatch: no session id=${params.sessionId}`);

  const eligibleStatuses = params.eligibleStatuses ?? ["pending"];
  const batchCategoryId = params.batchCategoryId ?? session.batchCategoryId;
  // D-57: the batch lifecycle is read from the durable session only — never an
  // in-pass override — so a resumed pass keeps the choice made at setup.
  const lifecycle = sessionBatchLifecycle(session);
  const rows = (await listSessionRows(exec, params.sessionId)).filter((row) =>
    eligibleStatuses.includes(row.rowStatus),
  );
  let done = 0;
  let createdContacts = 0;

  for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
    const chunk = rows.slice(start, start + CHUNK_SIZE);
    for (const row of chunk) {
      try {
        // A resolved row remains safe if a Retry caller mistakenly includes it.
        if (row.contactId === null) {
          const picked = pickedFromRow(row);
          const mapped = mapPickedContact(picked, {
            categoryId: batchCategoryId,
            effectivePhoneRegion: session.phoneRegion,
          });
          const scored = await scoreImportCandidate(exec, {
            externalContactId: row.externalContactId,
            methodDrafts: mapped.input.methodDrafts ?? [],
            name: mapped.input.name,
            birthday: mapped.birthday,
            effectivePhoneRegion: session.phoneRegion,
          });
          if (scored.outcome === "already_linked") {
            await resolveAlreadyLinked(
              exec,
              row.id,
              scored.deterministicContactId,
              params.now,
            );
          } else if (scored.outcome === "new") {
            const created = await importRowAsNew(exec, {
              row,
              batchCategoryId,
              lifecycle,
              phoneRegion: session.phoneRegion,
              now: params.now,
            });
            if (created.contactId !== null) createdContacts += 1;
          } else {
            await deferNeedsReview(
              exec,
              row.id,
              scored.outcome,
              scored.candidates[0]?.contactId ?? null,
              JSON.stringify(scored.candidates),
              params.now,
            );
          }
        }
      } catch (error) {
        await markRowStatus(
          exec,
          row.id,
          "failed",
          failureReason(error),
          params.now,
        );
      }
      done += 1;
      params.onProgress?.(done, rows.length);
    }
    if (start + CHUNK_SIZE < rows.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  await finalizeSessionIfTerminal(exec, params.sessionId, params.now);
  // D-57: a Bound pass that created contacts refreshes reminders and the
  // widget once, after everything above has committed.
  if (lifecycle.trackingEnabled && createdContacts > 0) {
    await runBoundImportEffects(exec, params.effects);
  }
  return sessionSummaryCounts(exec, params.sessionId);
}
