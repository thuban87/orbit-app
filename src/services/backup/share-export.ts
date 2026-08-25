/** Native file/share adapters live here so the service remains node-testable. */
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type {
  ExportShareAdapter,
  LocalExportFile,
  LocalExportFiles,
} from "@/services/backup/backup-service";
import { resolvePhotoUri } from "@/services/photos/photo-storage";

const EXPORT_DIRECTORY = "backup-exports";

export function createLocalExportFiles(
  now: () => number = Date.now,
): LocalExportFiles {
  return {
    async create(): Promise<LocalExportFile> {
      const directory = new Directory(Paths.cache, EXPORT_DIRECTORY);
      directory.create({ intermediates: true, idempotent: true });
      const file = new File(directory, `orbit-backup-${now()}.json`);
      return {
        uri: file.uri,
        async write(contents) {
          file.write(contents);
        },
        read() {
          return file.text();
        },
      };
    },
  };
}

/** Read stored bytes through the existing safe relative-path photo boundary. */
export function readStoredPhotoBase64(relativePath: string): Promise<string> {
  return new File(resolvePhotoUri(relativePath)).base64();
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
