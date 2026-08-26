import { shouldRunAutomaticBackup } from "@/backup/auto-backup-policy";
import {
  getAppSettings,
  recordAutomaticBackupHealthCore,
} from "@/db/app-settings-dao";
import { readDataRevision } from "@/db/data-revision-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { createAutomaticBackupService } from "@/services/backup/backup-service";
import {
  APPROVED_BACKUP_ENCRYPTION_PROFILE,
  createBackupEnvelopeCrypto,
} from "@/services/backup/encryption";
import { backupPassphraseStore } from "@/services/backup/passphrase-store";
import { createSafStorage } from "@/services/backup/saf-storage";
import { readStoredPhotoBase64 } from "@/services/backup/share-export";
import { registerSweepHook } from "@/services/launch-sweep";
import { Logger } from "@/utils/logger";

/** Register foreground-only backup work; it is never called from module import. */
export function registerBackupSweep(
  getExec: () => SqlExecutor = getExecutor,
): void {
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
      // The durable flag is authoritative. If its SecureStore secret cannot be
      // read, the service blocks the write before exporting a plaintext byte.
      encryption: {
        enabled: settings.encryptionEnabled === 1,
        passphrase: await backupPassphraseStore.getPassphrase(),
        encrypt: (contents, passphrase) =>
          JSON.stringify(
            createBackupEnvelopeCrypto({
              profiles: [APPROVED_BACKUP_ENCRYPTION_PROFILE],
            }).encrypt({
              passphrase,
              plaintext: new TextEncoder().encode(contents),
              profile: APPROVED_BACKUP_ENCRYPTION_PROFILE,
            }),
          ),
      },
    }).writeVerifiedSnapshot();
    if (result.status === "written") {
      await inWriteTransaction(exec, () =>
        recordAutomaticBackupHealthCore(exec, {
          backupFolderAccessible: 1,
          backupFolderDiagnostic: null,
          lastAutomaticBackupAt: localDateTime(now),
          lastBackupDataRevision: revision,
        }),
      );
      return;
    }
    if (result.status === "failed") {
      await inWriteTransaction(exec, () =>
        recordAutomaticBackupHealthCore(exec, {
          backupFolderAccessible: 0,
          backupFolderDiagnostic: "Unable to access the backup folder.",
        }),
      );
      Logger.warn(
        "backup-sweep",
        "automatic backup could not verify SAF access",
      );
    }
  });
}
