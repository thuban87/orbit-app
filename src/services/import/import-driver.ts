/**
 * Incremental bulk import orchestration. Each row owns its own transaction so
 * a bad source snapshot never rolls back contacts imported before it.
 */
import {
  deferNeedsReview,
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
  sessionSummaryCounts,
} from "@/db/import-session-read";
import { importContactRecord } from "@/db/imported-contact-dao";
import type { SqlExecutor } from "@/db/types";
import { mapPickedContact } from "@/logic/picked-contact-map";
import { scoreImportCandidate } from "@/services/import/duplicate-evidence";
import {
  importedPhotoFs,
  persistImportedPhotoPostCommit,
} from "@/services/import/import-photo";
import { Logger } from "@/utils/logger";
import type { PickedContact } from "../../../modules/orbit-contact-picker";

/** Kept deliberately small so a picker-sized batch yields to the JS thread. */
export const CHUNK_SIZE = 10;

export interface ImportRowAsNewParams {
  row: ImportSessionRow;
  batchCategoryId: number | null;
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
}

function pickedFromRow(row: ImportSessionRow): PickedContact {
  return JSON.parse(row.sourcePayload) as PickedContact;
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
      "failed",
      "name-required",
      params.now,
    );
    return { contactId: null, skipped: "name-required" };
  }

  const { contactId } = await importContactRecord(exec, {
    input: mapped.input,
    externalLinks: [
      {
        provider: "android",
        externalContactId: params.row.externalContactId,
      },
    ],
    birthday: mapped.birthday,
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
 */
export async function runImportBatch(
  exec: SqlExecutor,
  params: RunImportBatchParams,
): Promise<SessionSummaryCounts> {
  const session = await getSessionById(exec, params.sessionId);
  if (!session)
    throw new Error(`runImportBatch: no session id=${params.sessionId}`);

  const eligibleStatuses = params.eligibleStatuses ?? ["pending"];
  const batchCategoryId = params.batchCategoryId ?? session.batchCategoryId;
  const rows = (await listSessionRows(exec, params.sessionId)).filter((row) =>
    eligibleStatuses.includes(row.rowStatus),
  );
  let done = 0;

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
            await importRowAsNew(exec, {
              row,
              batchCategoryId,
              phoneRegion: session.phoneRegion,
              now: params.now,
            });
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

  return sessionSummaryCounts(exec, params.sessionId);
}
