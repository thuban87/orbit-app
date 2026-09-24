import {
  deleteJournalEntryCore,
  listJournalEntriesCore,
  type RestorePhotoJournalEntry,
} from "@/db/restore-photo-journal-dao";
import type { SqlExecutor } from "@/db/types";
import { registerSweepHook, SWEEP_IDS } from "@/services/launch-sweep";
import {
  deletePhoto,
  deleteRestorePending,
  listRestorePendingPhotos,
  persistMaster,
  photoFileExists,
  resolveRestorePendingUri,
} from "@/services/photos/photo-storage";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "restore-photo-finalize-sweep";

async function targetIsLive(
  exec: SqlExecutor,
  entry: RestorePhotoJournalEntry,
): Promise<boolean> {
  if (entry.targetKind === "profile") return true;
  if (entry.targetKind === "contact") {
    if (!entry.contactUid) return false;
    return (
      (await exec.getFirstAsync("SELECT id FROM contacts WHERE uid = ?", [
        entry.contactUid,
      ])) !== null
    );
  }
  if (!entry.valueUid || !entry.contactUid || !entry.fieldDefUid) return false;
  return (
    (await exec.getFirstAsync(
      `SELECT v.id
       FROM custom_field_values v
       JOIN custom_field_defs d ON d.id = v.field_def_id
       JOIN contacts c ON c.id = v.contact_id
      WHERE v.uid = ? AND d.uid = ? AND d.type = 'photo' AND c.uid = ?`,
      [entry.valueUid, entry.fieldDefUid, entry.contactUid],
    )) !== null
  );
}

async function drainEntry(
  exec: SqlExecutor,
  entry: RestorePhotoJournalEntry,
  presentPending: ReadonlySet<string>,
): Promise<boolean> {
  if (entry.action === "delete") {
    deletePhoto(entry.canonicalRelativePath);
    try {
      if (!photoFileExists(entry.canonicalRelativePath)) {
        await deleteJournalEntryCore(exec, entry.relativePath);
      } else {
        Logger.error(LOG_SCOPE, "canonical photo deletion needs retry");
      }
    } catch (error) {
      Logger.error(LOG_SCOPE, "canonical photo deletion check failed", error);
    }
    return true;
  }

  if (!(await targetIsLive(exec, entry))) {
    if (presentPending.has(entry.relativePath))
      deleteRestorePending(entry.relativePath);
    await deleteJournalEntryCore(exec, entry.relativePath);
    return true;
  }
  if (!presentPending.has(entry.relativePath)) {
    // Finalization succeeded before an interrupted cleanup; never retry it.
    await deleteJournalEntryCore(exec, entry.relativePath);
    return true;
  }
  try {
    await persistMaster(
      resolveRestorePendingUri(entry.relativePath),
      entry.canonicalRelativePath,
    );
    deleteRestorePending(entry.relativePath);
    await deleteJournalEntryCore(exec, entry.relativePath);
    return true;
  } catch {
    Logger.error(LOG_SCOPE, "restore photo finalization needs retry");
    return false;
  }
}

/** One best-effort pass; exported so node tests prove recovery without AppState wiring. */
export async function drainRestorePhotoJournal(
  exec: SqlExecutor,
): Promise<{ unrecoveredFinalize: number; failed: number }> {
  const summary = { unrecoveredFinalize: 0, failed: 0 };
  try {
    const entries = await listJournalEntriesCore(exec);
    const pending = listRestorePendingPhotos();
    const present = new Set(pending.map((item) => item.relative));
    for (const entry of entries) {
      try {
        if (
          !(await drainEntry(exec, entry, present)) &&
          entry.action === "finalize"
        ) {
          summary.unrecoveredFinalize += 1;
        }
      } catch {
        if (entry.action === "finalize") summary.unrecoveredFinalize += 1;
        summary.failed += 1;
        Logger.error(LOG_SCOPE, "journal drain entry failed");
      }
    }
    const journalPaths = new Set(entries.map((entry) => entry.relativePath));
    for (const item of pending) {
      if (item.isStageTmpOrphan || !journalPaths.has(item.relative)) {
        try {
          deleteRestorePending(item.relative);
        } catch {
          summary.failed += 1;
          Logger.error(LOG_SCOPE, "pending photo cleanup failed");
        }
      }
    }
  } catch {
    summary.failed += 1;
    Logger.error(LOG_SCOPE, "restore photo recovery sweep failed");
  }
  return summary;
}

/** Register one idempotent foreground recovery hook; importing this module does nothing. */
export function registerRestorePhotoFinalizeSweep(
  getExecutor: () => SqlExecutor,
): void {
  registerSweepHook(
    async () => {
      const summary = await drainRestorePhotoJournal(getExecutor());
      if (summary.unrecoveredFinalize > 0 || summary.failed > 0) {
        throw new Error("restore-photo recovery incomplete");
      }
    },
    { id: SWEEP_IDS.restorePhotoFinalize },
  );
}
