/** Native file/share adapters live here so the service remains node-testable. */
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import type {
  ExportShareAdapter,
  LocalExportFile,
  LocalExportFiles,
} from "@/services/backup/backup-service";
import { resolveBackgroundUri } from "@/services/photos/background-storage";
import {
  photoFileExists,
  photoSwapBackupExists,
  resolvePhotoUri,
} from "@/services/photos/photo-storage";
import {
  revokeBackupExportShare,
  shareBackupExport,
} from "../../../modules/orbit-backup-share";

const EXPORT_DIRECTORY = "backup-exports";
/**
 * How long a backup photo read waits before its one retry when it caught a
 * replace mid-swap (38.6 review IN3-01). A swap is two renames.
 */
const SWAP_RETRY_DELAY_MS = 100;

/** Revoke the chosen share target's grant (ADR-155), then delete the file. */
function retire(file: File): void {
  revokeBackupExportShare(file.uri);
  file.delete();
}

export function createLocalExportFiles(
  now: () => number = Date.now,
): LocalExportFiles {
  const directory = () => new Directory(Paths.cache, EXPORT_DIRECTORY);
  const stagedFiles = (): File[] => {
    const dir = directory();
    if (!dir.exists) return [];
    return dir
      .list()
      .filter(
        (item): item is File =>
          item instanceof File && /^orbit-backup-\d+\.json$/.test(item.name),
      );
  };
  return {
    async create(): Promise<LocalExportFile> {
      const dir = directory();
      dir.create({ intermediates: true, idempotent: true });
      const file = new File(dir, `orbit-backup-${now()}.json`);
      return {
        uri: file.uri,
        async write(contents) {
          file.write(contents);
        },
        read() {
          return file.text();
        },
        async delete() {
          if (file.exists) file.delete();
        },
      };
    },
    async retireAll() {
      for (const file of stagedFiles()) retire(file);
    },
    async retireStale(nowMs, graceMs) {
      for (const file of stagedFiles()) {
        const stamp = Number(/^orbit-backup-(\d+)\.json$/.exec(file.name)?.[1]);
        const created = Number.isFinite(stamp) ? stamp : file.modificationTime;
        if (created != null && nowMs - created >= graceMs) retire(file);
      }
    },
  };
}

/**
 * Read stored bytes through the existing safe relative-path photo boundary.
 *
 * For a contact, profile or custom-field photo (38.6 D-29), this resolves `""`
 * when the file is genuinely missing or empty, so the export skips and counts
 * it. Any other read failure rejects, and the backup fails with
 * `BackupPhotoUnreadableError`. "Missing" is decided by `photoFileExists`, asked
 * only AFTER the read failed: a file that still exists but cannot be read is an
 * error, never a skip. A profile background (D-27) always rejects on failure.
 *
 * A replace caught mid-swap (the prior master moved aside to `<path>.bak`, the
 * new bytes not yet in place) is not a missing photo (review IN3-01). The
 * export cannot wait for the path lock (it holds the DB mutex, and the lock
 * order is path, then DB), so it waits briefly and reads once more. A `.bak`
 * that is still there with no canonical is an interrupted swap the launch sweep
 * moves back: the photo exists, so the read fails rather than skip it.
 */
export async function readStoredPhotoBase64(
  relativePath: string,
  options: { retryDelayMs?: number } = {},
): Promise<string> {
  if (relativePath.startsWith("profile-backgrounds/"))
    return new File(resolveBackgroundUri(relativePath)).base64();
  const uri = resolvePhotoUri(relativePath);
  try {
    return await new File(uri).base64();
  } catch (error) {
    if (photoFileExists(relativePath)) throw error;
    if (!photoSwapBackupExists(relativePath)) return "";
  }
  await new Promise((resolve) =>
    setTimeout(resolve, options.retryDelayMs ?? SWAP_RETRY_DELAY_MS),
  );
  try {
    return await new File(uri).base64();
  } catch (error) {
    if (!photoFileExists(relativePath) && !photoSwapBackupExists(relativePath))
      return "";
    throw error;
  }
}

/**
 * The sole outbound backup share. A staged export becomes the system chooser,
 * and read access is granted only to the app the user picks (ADR-155) so
 * targets that upload in the background (Google Drive) can still read it.
 */
export function createExpoShareAdapter(): ExportShareAdapter {
  return {
    isAvailable: async () => Platform.OS === "android",
    open: (uri) => shareBackupExport(uri, "Export Orbit backup"),
  };
}
