/** Native file/share adapters live here so the service remains node-testable. */
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type {
  ExportShareAdapter,
  LocalExportFile,
  LocalExportFiles,
} from "@/services/backup/backup-service";
import { resolveBackgroundUri } from "@/services/photos/background-storage";
import { resolvePhotoUri } from "@/services/photos/photo-storage";

const EXPORT_DIRECTORY = "backup-exports";

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
      for (const file of stagedFiles()) file.delete();
    },
    async retireStale(nowMs, graceMs) {
      for (const file of stagedFiles()) {
        const stamp = Number(/^orbit-backup-(\d+)\.json$/.exec(file.name)?.[1]);
        const created = Number.isFinite(stamp) ? stamp : file.modificationTime;
        if (created != null && nowMs - created >= graceMs) file.delete();
      }
    },
  };
}

/** Read stored bytes through the existing safe relative-path photo boundary. */
export function readStoredPhotoBase64(relativePath: string): Promise<string> {
  const uri = relativePath.startsWith("profile-backgrounds/")
    ? resolveBackgroundUri(relativePath)
    : resolvePhotoUri(relativePath);
  return new File(uri).base64();
}

/** The sole expo-sharing integration: its local-file URI becomes a platform sheet. */
export function createExpoShareAdapter(): ExportShareAdapter {
  return {
    isAvailable: () => Sharing.isAvailableAsync(),
    open: (uri) =>
      Sharing.shareAsync(uri, {
        mimeType: "application/json",
        dialogTitle: "Export Orbit backup",
      }),
  };
}
