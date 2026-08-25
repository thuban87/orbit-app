import { shouldRunAutomaticBackup } from "@/backup/auto-backup-policy";
import { getAppSettings, recordAutomaticBackupHealthCore } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { readDataRevision } from "@/db/data-revision-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { createAutomaticBackupService } from "@/services/backup/backup-service";
import { createSafStorage } from "@/services/backup/saf-storage";
import { readStoredPhotoBase64 } from "@/services/backup/share-export";
import { registerSweepHook } from "@/services/launch-sweep";
import { Logger } from "@/utils/logger";

/** Register foreground-only backup work; it is never called from module import. */
export function registerBackupSweep(getExec: () => SqlExecutor = getExecutor): void {
  registerSweepHook(async () => {
    const exec = getExec();
    const settings = await getAppSettings(exec);
    if (!settings.backupFolderUri) return;
    const revision = await readDataRevision(exec);
    const now = new Date();
    if (!shouldRunAutomaticBackup(settings, revision, now)) return;
    const result = await createAutomaticBackupService({
      exec,
      exportedAt: localDateTime(now),
      now,
      readPhotoBase64: readStoredPhotoBase64,
      directoryUri: settings.backupFolderUri,
      retentionDays: settings.backupRetentionDays,
      storage: createSafStorage(),
    }).writeVerifiedSnapshot();
    if (result.status === "written") {
      await inWriteTransaction(exec, () => recordAutomaticBackupHealthCore(exec, {
        backupFolderAccessible: 1,
        backupFolderDiagnostic: null,
        lastAutomaticBackupAt: localDateTime(now),
        lastBackupDataRevision: revision,
      }));
      return;
    }
    if (result.status === "failed") {
      await inWriteTransaction(exec, () => recordAutomaticBackupHealthCore(exec, {
        backupFolderAccessible: 0,
        backupFolderDiagnostic: "Unable to access the backup folder.",
      }));
      Logger.warn("backup-sweep", "automatic backup could not verify SAF access");
    }
  });
}
