/**
 * System-contact acquisition orchestration.
 *
 * The picker grant is deliberately consumed once here: its cache photo is
 * copied into document-dir staging before the durable session snapshot is
 * inserted. Screens subsequently read the session and never re-query Android.
 */

import type { CreateContactFullInput } from "@/db/contacts-dao";
import {
  acceptImportSessionWithRows,
  completeSession,
  type ImportLifecycle,
  type ImportSessionMode,
  markRowPhotoFailed,
  UNBOUND_IMPORT,
} from "@/db/import-session-dao";
import { listSessionRows } from "@/db/import-session-read";
import {
  type ExternalContactLinkInput,
  importContactRecord,
} from "@/db/imported-contact-dao";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import { mapPickedContact } from "@/logic/picked-contact-map";
import type { FlowHost } from "@/navigation/flow-host";
import type { ImportLifecycleEffects } from "@/services/import/import-lifecycle-effects";
import {
  importedPhotoFs,
  persistImportedPhotoPostCommit,
} from "@/services/import/import-photo";
import {
  applyPhotoBudgetChoice,
  DEFAULT_PHOTO_BUDGET_DEPS,
  type DecidePhotoBudget,
  isOverPhotoBudget,
  type PhotoBudgetDeps,
  type PhotoBudgetEstimate,
  readEncryptionEnabled,
} from "@/services/import/import-photo-budget";
import { discardDerivative } from "@/services/photos/derivative-cache";
import {
  importStagingRelPath,
  stageImportPhoto,
} from "@/services/photos/photo-storage";
import { Logger } from "@/utils/logger";
import type { PickedContact } from "../../../modules/orbit-contact-picker";

export interface AcceptPickedContactsOptions {
  mode: ImportSessionMode;
  batchCategoryId: number | null;
  effectivePhoneRegion: string | null;
  now: string;
}

export interface CommitSingleImportInput {
  sessionId: number;
  rowId: number;
  input: CreateContactFullInput;
  externalLinks: ExternalContactLinkInput[];
  birthday: string | null;
  now: string;
  /**
   * Post-commit lifecycle effects after the single import (D-57, D-58).
   * Tests inject a spy; the default lazily imports `import-lifecycle-effects`.
   */
  effects?: ImportLifecycleEffects;
}

export interface PickedImportNavigator {
  navigate: (
    route: "ImportReview" | "BulkImportSetup",
    params: { sessionId: number; host?: FlowHost },
  ) => void;
}

export interface RoutePickedImportOptions
  extends Omit<AcceptPickedContactsOptions, "mode" | "batchCategoryId"> {
  batchCategoryId?: number | null;
  /**
   * Asks the user when the photos may not fit in the encrypted backup (D-133);
   * null = the size could not be checked. Absent while a check is needed, the
   * import is cancelled (fail closed, convergence c5 F-3).
   */
  decidePhotoBudget?: DecidePhotoBudget;
  /** Estimator deps; absent = production defaults, never "skip" (F-3). */
  photoBudget?: Partial<PhotoBudgetDeps>;
  /** Where the flow finishes (D-110); absent = DEFAULT_FLOW_HOST at the screen. */
  host?: FlowHost;
}

export type RoutePickedImportResult =
  | { status: "empty" }
  | { status: "cancelled" }
  | { status: "routed"; sessionId: number };

/**
 * Accept the OS snapshot as one durable transaction. A failed cache-photo copy
 * does not block contact import; a successfully staged file is intentionally
 * left for launch reconciliation if the later SQL transaction fails.
 */
export async function acceptPickedContacts(
  exec: SqlExecutor,
  picked: PickedContact[],
  options: AcceptPickedContactsOptions,
): Promise<number> {
  const sessionUid = newUid();
  const rows = await Promise.all(
    picked.map(async (contact) => {
      try {
        const mapped = mapPickedContact(contact, {
          categoryId: options.batchCategoryId,
          effectivePhoneRegion: options.effectivePhoneRegion,
        });
        const rowUid = newUid();
        let photoRelPath: string | null = null;
        if (
          mapped.photoTempUri !== null &&
          !(options.mode === "bulk" && mapped.nameRequired)
        ) {
          try {
            const relative = importStagingRelPath(sessionUid, rowUid);
            await stageImportPhoto(mapped.photoTempUri, relative);
            photoRelPath = relative;
          } catch {
            // A photo is optional. The contact snapshot remains useful without it.
          }
        }
        return {
          uid: rowUid,
          externalContactId: mapped.externalContactId,
          sourcePayload: JSON.stringify({
            displayName: contact.displayName,
            methods: contact.methods,
            birthday: contact.birthday,
            note: contact.note,
            // D-132: recorded as the link's reviewed photo when the import
            // adopts this phone photo (recordImportedPhotoFingerprint).
            photoFingerprint: contact.photoFingerprint ?? null,
          }),
          photoRelPath,
        };
      } finally {
        // The thumbnail copy (D-133) is never staged here; the cold-start
        // cache sweep retires any copy whose discard fails.
        for (const cacheUri of [
          contact.photoTempUri,
          contact.thumbnailTempUri,
        ]) {
          if (!cacheUri) continue;
          try {
            discardDerivative(cacheUri);
          } catch {
            Logger.warn("import-acquire", "picker photo cleanup failed");
          }
        }
      }
    }),
  );

  const accepted = await acceptImportSessionWithRows(exec, {
    session: {
      uid: sessionUid,
      mode: options.mode,
      batchCategoryId: options.batchCategoryId,
      batchTrackingEnabled: false,
      phoneRegion: options.effectivePhoneRegion,
      now: options.now,
    },
    rows,
  });
  return accepted.sessionId;
}

/**
 * The single review's reviewed lifecycle (38.4 D-57; Phase 19 Cluster D): Bound
 * with its cadence when the review chose Bound, else Unbound. A Bound input
 * without a positive cadence is passed through so the seam's guard rejects it
 * (the review UI never produces one: it defaults to Monthly).
 */
function reviewedLifecycle(input: CreateContactFullInput): ImportLifecycle {
  if (input.trackingEnabled === true) {
    return {
      trackingEnabled: true,
      intervalDays: input.intervalDays as number,
    };
  }
  return UNBOUND_IMPORT;
}

/**
 * The one single-contact create seam. `importContactRecord` composes contact
 * creation and row resolution in one transaction before the session completes.
 */
export async function commitSingleImport(
  exec: SqlExecutor,
  params: CommitSingleImportInput,
): Promise<number> {
  const row = (await listSessionRows(exec, params.sessionId)).find(
    (candidate) => candidate.id === params.rowId,
  );
  let note: string | null = null;
  if (row) {
    try {
      const picked = JSON.parse(row.sourcePayload) as PickedContact;
      note = picked.note?.trim() ? picked.note : null;
    } catch {
      // A corrupt snapshot has no safe note to import; retain the prior create behavior.
    }
  }
  const lifecycle = reviewedLifecycle(params.input);
  const { contactId } = await importContactRecord(exec, {
    input: params.input,
    lifecycle,
    externalLinks: params.externalLinks,
    birthday: params.birthday,
    note,
    now: params.now,
    resolveRow: { rowId: params.rowId, matchOutcome: "new" },
  });
  const photo = await persistImportedPhotoPostCommit(exec, importedPhotoFs, {
    contactId,
    rowId: params.rowId,
    stagedPhotoPath: row?.photoRelPath ?? null,
    now: params.now,
  });
  if (!photo.ok) {
    try {
      await markRowPhotoFailed(exec, params.rowId, params.now);
    } catch (error) {
      Logger.error(
        "import-acquire",
        `could not mark photo failure for import row ${params.rowId}`,
        error,
      );
    }
  }
  // D-58 / convergence c1 C-6: the contact is already committed, so a
  // finalize failure must not read as a failed import. Log it and continue —
  // the effects still run and the created id is returned. A pending session
  // left behind is picked up by the existing resume/finalize path; no retry.
  try {
    await completeSession(exec, params.sessionId, params.now);
  } catch (error) {
    Logger.error(
      "import-acquire",
      "could not finalize import session after create",
      error,
    );
  }
  // D-57 / D-58: best-effort, post-commit; never fails the committed import.
  try {
    const run =
      params.effects ??
      (await import("@/services/import/import-lifecycle-effects"))
        .applyImportLifecycleEffects;
    await run(exec, {
      anyBound: lifecycle.trackingEnabled,
      anyUnbound: !lifecycle.trackingEnabled,
    });
  } catch (error) {
    Logger.error("import-acquire", "import lifecycle effects failed", error);
  }
  return contactId;
}

function discardCopies(uris: Iterable<string | null | undefined>): void {
  for (const uri of uris) {
    if (!uri) continue;
    try {
      discardDerivative(uri);
    } catch {
      Logger.warn("import-acquire", "picker photo cleanup failed");
    }
  }
}

function discardPickedCopies(picked: readonly PickedContact[]): void {
  discardCopies(
    picked.flatMap((contact) => [
      contact.photoTempUri,
      contact.thumbnailTempUri,
    ]),
  );
}

/**
 * D-133: before photos are imported with backup encryption on, estimate the
 * backup and ask when it may not fit (or could not be checked). Returns the
 * contacts to import, or null when the import must not proceed.
 */
async function guardPhotoBudget(
  exec: SqlExecutor,
  picked: PickedContact[],
  options: RoutePickedImportOptions,
): Promise<PickedContact[] | null> {
  const incomingPhotoContacts = picked.filter(
    (contact) => contact.photoTempUri,
  ).length;
  if (incomingPhotoContacts === 0) return picked;
  // An explicitly undefined dep falls back to its production default too.
  const deps: PhotoBudgetDeps = {
    fileSize:
      options.photoBudget?.fileSize ?? DEFAULT_PHOTO_BUDGET_DEPS.fileSize,
    encryptionEnabled:
      options.photoBudget?.encryptionEnabled ??
      DEFAULT_PHOTO_BUDGET_DEPS.encryptionEnabled,
    currentBackupBytes:
      options.photoBudget?.currentBackupBytes ??
      DEFAULT_PHOTO_BUDGET_DEPS.currentBackupBytes,
  };
  // No cap without encryption (`encryption.ts` too-large; F-5).
  if (!(await readEncryptionEnabled(deps, exec))) return picked;
  let currentBytes: number | null;
  try {
    currentBytes = await deps.currentBackupBytes(exec, deps.fileSize);
  } catch (error) {
    Logger.warn(
      "import-photo-budget",
      "could not estimate the backup size",
      error,
    );
    currentBytes = null;
  }
  let estimate: PhotoBudgetEstimate;
  if (currentBytes === null) {
    estimate = null;
  } else {
    const budget = isOverPhotoBudget({
      currentBytes,
      incomingPhotoContacts,
      encryptionEnabled: true,
    });
    if (!budget.over) return picked;
    estimate = { projectedBytes: budget.projectedBytes };
  }
  if (!options.decidePhotoBudget) {
    Logger.warn(
      "import-photo-budget",
      "no photo-budget decider; import cancelled",
    );
    discardPickedCopies(picked);
    return null;
  }
  const choice = await options.decidePhotoBudget(estimate);
  if (choice === "back") {
    discardPickedCopies(picked);
    return null;
  }
  const applied = await applyPhotoBudgetChoice(picked, choice);
  discardCopies(applied.discard);
  return applied.contacts;
}

/** Route a picker result by cardinality; a cancelled picker owns no session. */
export async function routePickedImport(
  exec: SqlExecutor,
  picked: PickedContact[],
  options: RoutePickedImportOptions,
  navigation: PickedImportNavigator,
): Promise<RoutePickedImportResult> {
  if (picked.length === 0) return { status: "empty" };
  const contacts = await guardPhotoBudget(exec, picked, options);
  if (contacts === null) return { status: "cancelled" };
  const sessionId = await acceptPickedContacts(exec, contacts, {
    mode: contacts.length === 1 ? "single" : "bulk",
    batchCategoryId: options.batchCategoryId ?? null,
    effectivePhoneRegion: options.effectivePhoneRegion,
    now: options.now,
  });
  const host = options.host;
  if (contacts.length === 1) {
    navigation.navigate("ImportReview", { sessionId, host });
  } else {
    navigation.navigate("BulkImportSetup", { sessionId, host });
  }
  return { status: "routed", sessionId };
}
