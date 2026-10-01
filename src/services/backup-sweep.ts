import { shouldRunAutomaticBackup } from "@/backup/auto-backup-policy";
import {
  getAppSettings,
  recordAutomaticBackupHealthCore,
} from "@/db/app-settings-dao";
import { readDataRevision } from "@/db/data-revision-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import {
  AUTOMATIC_BACKUP_TOO_LARGE_DIAGNOSTIC,
  createAutomaticBackupService,
} from "@/services/backup/backup-service";
import {
  APPROVED_BACKUP_ENCRYPTION_PROFILE,
  createBackupEnvelopeCrypto,
} from "@/services/backup/encryption";
import { backupPassphraseStore } from "@/services/backup/passphrase-store";
import { createSafStorage } from "@/services/backup/saf-storage";
import { readStoredPhotoBase64 } from "@/services/backup/share-export";
import { recordAutomaticSkippedPhotos } from "@/services/backup/skipped-photos";
import { registerSweepHook, SWEEP_IDS } from "@/services/launch-sweep";
import { Logger } from "@/utils/logger";

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
      // One timestamp for both the health row and the skipped-photo record, so
      // the Backup screen can tell the record belongs to this backup (D-24).
      const writtenAt = localDateTime(now);
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
        try {
          await inWriteTransaction(exec, () =>
            recordAutomaticBackupHealthCore(exec, {
              backupFolderAccessible: 1,
              backupFolderDiagnostic: null,
              lastAutomaticBackupAt: writtenAt,
              lastBackupDataRevision: revision,
            }),
          );
        } catch {
          Logger.error("backup-sweep", "backup health write failed");
        }
        // Device-local (38.6 D-24). A failed record never fails the hook: the
        // backup itself is written and verified.
        try {
          await recordAutomaticSkippedPhotos({
            at: writtenAt,
            count: result.skippedPhotos,
          });
        } catch {
          Logger.error("backup-sweep", "skipped-photo record failed");
        }
        return;
      }
      if (result.status === "too-large") {
        // 38.6 D-39: the folder is fine; record why instead of marking it
        // inaccessible, so the health card says "too large", not "reconnect".
        try {
          await inWriteTransaction(exec, () =>
            recordAutomaticBackupHealthCore(exec, {
              backupFolderDiagnostic: AUTOMATIC_BACKUP_TOO_LARGE_DIAGNOSTIC,
            }),
          );
        } catch {
          Logger.error("backup-sweep", "backup health write failed");
        }
        Logger.warn("backup-sweep", "automatic backup was over the size cap");
        return;
      }
      if (result.status === "failed") {
        try {
          await inWriteTransaction(exec, () =>
            recordAutomaticBackupHealthCore(exec, {
              backupFolderAccessible: 0,
              backupFolderDiagnostic: "Unable to access the backup folder.",
            }),
          );
        } catch {
          Logger.error("backup-sweep", "backup health write failed");
        }
        Logger.warn(
          "backup-sweep",
          "automatic backup could not verify SAF access",
        );
      }
    },
    {
      id: SWEEP_IDS.backup,
      requires: [SWEEP_IDS.backgroundReconcile, SWEEP_IDS.restorePhotoFinalize],
    },
  );
}
