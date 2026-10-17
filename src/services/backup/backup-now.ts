/**
 * The automatic backup's one write-verify-record path (38.12 D-115).
 *
 * `runAutomaticBackupNow` is the body the launch sweep used to run inline after
 * its due gate (`backup-sweep.ts`, 38.6 D-24/D-39): one verified SAF snapshot
 * through `createAutomaticBackupService`, then the device-local health row and
 * the skipped-photo record. The sweep calls it behind its gate; the Backup
 * page's "Back up now" calls it with no gate, so a user-tapped backup writes,
 * verifies and records health exactly as the automatic one does (ADR-057: a
 * user-tapped write is a foreground write).
 *
 * Health writes, by result:
 *   written    folder accessible, diagnostic cleared, `lastAutomaticBackupAt`
 *              and `lastBackupDataRevision` set; skipped photos recorded under
 *              the same timestamp.
 *   too-large  only the too-large diagnostic (the folder is fine, D-39).
 *   failed     the folder marked inaccessible with its diagnostic.
 *   blocked    nothing: the encryption flag is on and its SecureStore secret
 *   busy       could not be read (the service refuses before exporting a
 *              plaintext byte), or another write holds the service.
 * A failed health or skipped-photo record never fails the call: the snapshot
 * itself is written and verified.
 *
 * `chooseAutomaticBackupFolder` is the one folder chooser (Backup settings and
 * the Backup page's "Choose a folder"): the SAF picker, then the folder row.
 */
import {
  type AppSettings,
  getAppSettings,
  recordAutomaticBackupHealthCore,
} from "@/db/app-settings-dao";
import { readDataRevision } from "@/db/data-revision-dao";
import { localDateTime } from "@/db/database";
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
import {
  backupPassphraseStore,
  type PassphraseReadResult,
} from "@/services/backup/passphrase-store";
import {
  createSafStorage,
  type SafFolderAdapter,
  type SafStorage,
} from "@/services/backup/saf-storage";
import { readStoredPhotoBase64 } from "@/services/backup/share-export";
import { recordAutomaticSkippedPhotos } from "@/services/backup/skipped-photos";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "backup-now";

/** The health diagnostic a failed (inaccessible-folder) write records. */
export const AUTOMATIC_BACKUP_FAILED_DIAGNOSTIC =
  "Unable to access the backup folder.";

export type AutomaticBackupNowResult =
  | { status: "written"; skippedPhotos: number }
  | { status: "too-large" }
  | { status: "failed" }
  | {
      status: "blocked";
      reason: "passphrase-absent" | "passphrase-unavailable";
    }
  | { status: "busy" }
  /** No folder is chosen; nothing was written or recorded. */
  | { status: "no-folder" };

export interface AutomaticBackupNowDeps {
  exec: SqlExecutor;
  /** Settings already read by the caller (the sweep's gate); read when absent. */
  settings?: AppSettings;
  /** The data revision this backup represents; read before the write when absent. */
  revision?: number;
  /** Defaults to the current time. */
  now?: Date;
  /** Defaults to the real SAF storage. */
  storage?: SafStorage;
  /** Defaults to the SecureStore passphrase. */
  readPassphrase?: () => Promise<PassphraseReadResult>;
}

/** Write, verify and record health — the automatic backup's own path (D-115). */
export async function runAutomaticBackupNow(
  deps: AutomaticBackupNowDeps,
): Promise<AutomaticBackupNowResult> {
  const { exec } = deps;
  const settings = deps.settings ?? (await getAppSettings(exec));
  if (!settings.backupFolderUri) return { status: "no-folder" };
  const revision = deps.revision ?? (await readDataRevision(exec));
  const now = deps.now ?? new Date();
  // One timestamp for both the health row and the skipped-photo record, so
  // the Backup screen can tell the record belongs to this backup (38.6 D-24).
  const writtenAt = localDateTime(now);
  const readPassphrase =
    deps.readPassphrase ?? (() => backupPassphraseStore.getPassphrase());
  const result = await createAutomaticBackupService({
    exec,
    exportedAt: localDateTime(now),
    now,
    readPhotoBase64: readStoredPhotoBase64,
    directoryUri: settings.backupFolderUri,
    retentionDays: settings.backupRetentionDays,
    storage: deps.storage ?? createSafStorage(),
    // The durable flag is authoritative. If its SecureStore secret cannot be
    // read, the service blocks the write before exporting a plaintext byte.
    encryption: {
      enabled: settings.encryptionEnabled === 1,
      passphrase: await readPassphrase(),
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
      Logger.error(LOG_SCOPE, "backup health write failed");
    }
    // Device-local (38.6 D-24). A failed record never fails the call: the
    // backup itself is written and verified.
    try {
      await recordAutomaticSkippedPhotos({
        at: writtenAt,
        count: result.skippedPhotos,
      });
    } catch {
      Logger.error(LOG_SCOPE, "skipped-photo record failed");
    }
    return { status: "written", skippedPhotos: result.skippedPhotos };
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
      Logger.error(LOG_SCOPE, "backup health write failed");
    }
    Logger.warn(LOG_SCOPE, "automatic backup was over the size cap");
    return { status: "too-large" };
  }
  if (result.status === "failed") {
    try {
      await inWriteTransaction(exec, () =>
        recordAutomaticBackupHealthCore(exec, {
          backupFolderAccessible: 0,
          backupFolderDiagnostic: AUTOMATIC_BACKUP_FAILED_DIAGNOSTIC,
        }),
      );
    } catch {
      Logger.error(LOG_SCOPE, "backup health write failed");
    }
    Logger.warn(LOG_SCOPE, "automatic backup could not verify SAF access");
    return { status: "failed" };
  }
  return result;
}

export interface ChooseBackupFolderDeps {
  exec: SqlExecutor;
  /** Defaults to the real SAF picker. */
  folders?: Pick<SafFolderAdapter, "requestDirectory">;
  /** The display name stored beside the URI. */
  folderName: (directoryUri: string) => string;
}

/**
 * The one backup-folder chooser: open the SAF picker, then record the folder
 * as chosen and accessible with its diagnostic cleared. Resolves `false` when
 * the picker is cancelled (nothing written); a failed write rejects.
 */
export async function chooseAutomaticBackupFolder(
  deps: ChooseBackupFolderDeps,
): Promise<boolean> {
  // Do not seed DocumentsUI with the previously persisted provider URI. Some
  // providers (notably Drive) can leave the picker blank when the initial URI
  // is stale or unsupported; the user can still choose the existing folder
  // from the normal provider UI.
  const folders = deps.folders ?? createSafStorage();
  const result = await folders.requestDirectory();
  if (!result.granted || !result.directoryUri) return false;
  const directoryUri = result.directoryUri;
  await inWriteTransaction(deps.exec, () =>
    recordAutomaticBackupHealthCore(deps.exec, {
      backupFolderUri: directoryUri,
      backupFolderName: deps.folderName(directoryUri),
      backupFolderAccessible: 1,
      backupFolderDiagnostic: null,
    }),
  );
  return true;
}
