import { parseBackupManifest } from "@/backup/backup-schema";
import { buildExportManifest } from "@/backup/export-manifest";
import type { SqlExecutor } from "@/db/types";

export interface LocalExportFile {
  readonly uri: string;
  write(contents: string): Promise<void>;
  read(): Promise<string>;
}

export interface LocalExportFiles {
  create(): Promise<LocalExportFile>;
}

export interface ExportShareAdapter {
  isAvailable(): Promise<boolean>;
  open(uri: string): Promise<void>;
}

export type ManualExportResult =
  | { status: "shared" }
  | { status: "busy" }
  | { status: "sharing-unavailable" }
  | { status: "share-failed" }
  | { status: "export-failed" };

export interface ManualExportDependencies {
  exec: SqlExecutor;
  exportedAt: string;
  readPhotoBase64: (relativePath: string) => Promise<string>;
  files: LocalExportFiles;
  share: ExportShareAdapter;
}

/**
 * Creates the manual-only path. It intentionally never reads or writes backup
 * folder/health metadata: opening a share sheet is not automatic protection.
 */
export function createManualExportService(deps: ManualExportDependencies): {
  sharePlaintextExport(): Promise<ManualExportResult>;
} {
  let inFlight = false;
  return {
    async sharePlaintextExport(): Promise<ManualExportResult> {
      if (inFlight) return { status: "busy" };
      inFlight = true;
      try {
        const manifest = await buildExportManifest(deps.exec, {
          exportedAt: deps.exportedAt,
          readPhotoBase64: deps.readPhotoBase64,
        });
        const file = await deps.files.create();
        await file.write(JSON.stringify(manifest));
        // Read-back parse is the last safety gate before a portable file leaves Orbit.
        parseBackupManifest(JSON.parse(await file.read()));
        try {
          if (!(await deps.share.isAvailable())) {
            return { status: "sharing-unavailable" };
          }
          await deps.share.open(file.uri);
          return { status: "shared" };
        } catch {
          return { status: "share-failed" };
        }
      } catch {
        return { status: "export-failed" };
      } finally {
        inFlight = false;
      }
    },
  };
}
