import { shouldRunAutomaticBackup } from "@/backup/auto-backup-policy";
import { getAppSettings } from "@/db/app-settings-dao";
import { readDataRevision } from "@/db/data-revision-dao";
import { getExecutor } from "@/db/database";
import type { SqlExecutor } from "@/db/types";
import { runAutomaticBackupNow } from "@/services/backup/backup-now";
import { registerSweepHook, SWEEP_IDS } from "@/services/launch-sweep";

/** Register foreground-only backup work; it is never called from module import. */
export function registerBackupSweep(
  getExec: () => SqlExecutor = getExecutor,
): void {
  registerSweepHook(
    async () => {
      const exec = getExec();
      const settings = await getAppSettings(exec);
      if (!settings.backupFolderUri) return;
      const revision = await readDataRevision(exec);
      const now = new Date();
      if (!shouldRunAutomaticBackup(settings, revision, now)) return;
      // The write, verify and health record live in the one function the
      // Backup page's "Back up now" also calls (38.12 D-115).
      await runAutomaticBackupNow({ exec, settings, revision, now });
    },
    {
      id: SWEEP_IDS.backup,
      requires: [SWEEP_IDS.backgroundReconcile, SWEEP_IDS.restorePhotoFinalize],
    },
  );
}
