import {
  journalPathExistsCore,
  listJournalEntriesCore,
} from "@/db/restore-photo-journal-dao";
import type { SqlExecutor } from "@/db/types";
import { registerSweepHook, SWEEP_IDS } from "@/services/launch-sweep";
import {
  executeDeleteIntentOwned,
  finalizeJournalEntryOwned,
} from "@/services/photos/owned-master";
import {
  deleteRestorePending,
  listRestorePendingPhotos,
} from "@/services/photos/photo-storage";
import {
  pendingBelongsToActiveSession,
  sessionTouchedSince,
  stagingPassMark,
} from "@/services/photos/staging-sessions";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "restore-photo-finalize-sweep";

/** One best-effort pass; exported so node tests prove recovery without AppState wiring. */
export async function drainRestorePhotoJournal(
  exec: SqlExecutor,
): Promise<{ unrecoveredFinalize: number; failed: number }> {
  const summary = { unrecoveredFinalize: 0, failed: 0 };
  try {
    const mark = stagingPassMark();
    const entries = await listJournalEntriesCore(exec);
    const pending = listRestorePendingPhotos();
    for (const entry of entries) {
      try {
        if (entry.action === "finalize")
          await finalizeJournalEntryOwned(exec, entry);
        else await executeDeleteIntentOwned(exec, entry.canonicalRelativePath);
      } catch (error) {
        if (entry.action === "finalize") summary.unrecoveredFinalize += 1;
        summary.failed += 1;
        Logger.error(LOG_SCOPE, "journal drain entry failed", error);
      }
    }
    for (const item of pending) {
      if (
        pendingBelongsToActiveSession(item.relative) ||
        sessionTouchedSince(item.relative, mark)
      )
        continue;
      if (!(await journalPathExistsCore(exec, item.relative))) {
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
