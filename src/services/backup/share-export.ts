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
  resolvePhotoUri,
} from "@/services/photos/photo-storage";
import {
  revokeBackupExportShare,
  shareBackupExport,
} from "../../../modules/orbit-backup-share";

const EXPORT_DIRECTORY = "backup-exports";

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
 */
export async function readStoredPhotoBase64(
  relativePath: string,
): Promise<string> {
  if (relativePath.startsWith("profile-backgrounds/"))
    return new File(resolveBackgroundUri(relativePath)).base64();
  const uri = resolvePhotoUri(relativePath);
  try {
    return await new File(uri).base64();
  } catch (error) {
    if (!photoFileExists(relativePath)) return "";
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
