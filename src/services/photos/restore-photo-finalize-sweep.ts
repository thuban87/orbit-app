import {
  deleteJournalEntryCore,
  listJournalEntriesCore,
  type RestorePhotoJournalEntry,
} from "@/db/restore-photo-journal-dao";
import type { SqlExecutor } from "@/db/types";
import { registerSweepHook } from "@/services/launch-sweep";
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

async function targetIsLive(exec: SqlExecutor, entry: RestorePhotoJournalEntry): Promise<boolean> {
  if (entry.targetKind === "profile") return true;
  if (entry.targetKind === "contact") {
    if (!entry.contactUid) return false;
    return (await exec.getFirstAsync("SELECT id FROM contacts WHERE uid = ?", [entry.contactUid])) !== null;
  }
  if (!entry.valueUid || !entry.contactUid || !entry.fieldDefUid) return false;
  return (await exec.getFirstAsync(
    `SELECT v.id
       FROM custom_field_values v
       JOIN custom_field_defs d ON d.id = v.field_def_id
       JOIN contacts c ON c.id = v.contact_id
      WHERE v.uid = ? AND d.uid = ? AND d.type = 'photo' AND c.uid = ?`,
    [entry.valueUid, entry.fieldDefUid, entry.contactUid],
  )) !== null;
}

async function drainEntry(
  exec: SqlExecutor,
  entry: RestorePhotoJournalEntry,
  presentPending: ReadonlySet<string>,
): Promise<void> {
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
    return;
  }

  if (!(await targetIsLive(exec, entry))) {
    if (presentPending.has(entry.relativePath)) deleteRestorePending(entry.relativePath);
    await deleteJournalEntryCore(exec, entry.relativePath);
    return;
  }
  if (!presentPending.has(entry.relativePath)) {
    // Finalization succeeded before an interrupted cleanup; never retry it.
    await deleteJournalEntryCore(exec, entry.relativePath);
    return;
  }
  try {
    await persistMaster(resolveRestorePendingUri(entry.relativePath), entry.canonicalRelativePath);
    deleteRestorePending(entry.relativePath);
    await deleteJournalEntryCore(exec, entry.relativePath);
  } catch (error) {
    Logger.error(LOG_SCOPE, "restore photo finalization needs retry", error);
  }
}

/** One best-effort pass; exported so node tests prove recovery without AppState wiring. */
export async function drainRestorePhotoJournal(exec: SqlExecutor): Promise<void> {
  try {
    const entries = await listJournalEntriesCore(exec);
    const pending = listRestorePendingPhotos();
    const present = new Set(pending.map((item) => item.relative));
    for (const entry of entries) {
      try {
        await drainEntry(exec, entry, present);
      } catch (error) {
        Logger.error(LOG_SCOPE, "journal drain entry failed", error);
      }
    }
    const journalPaths = new Set(entries.map((entry) => entry.relativePath));
    for (const item of pending) {
      if (item.isStageTmpOrphan || !journalPaths.has(item.relative)) {
        deleteRestorePending(item.relative);
      }
    }
  } catch (error) {
    Logger.error(LOG_SCOPE, "restore photo recovery sweep failed", error);
  }
}

/** Register one idempotent foreground recovery hook; importing this module does nothing. */
export function registerRestorePhotoFinalizeSweep(getExecutor: () => SqlExecutor): void {
  registerSweepHook(() => drainRestorePhotoJournal(getExecutor()));
}
