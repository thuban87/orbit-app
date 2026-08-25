import { parseBackupManifest } from "@/backup/backup-schema";
import { buildExportManifest } from "@/backup/export-manifest";
import { automaticBackupFilename, isExpiredAutomaticBackup, isOwnedAutomaticBackup } from "@/backup/auto-backup-policy";
import type { SqlExecutor } from "@/db/types";
import type { SafStorage } from "@/services/backup/saf-storage";

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

export interface AutomaticBackupDependencies {
  exec: SqlExecutor;
  exportedAt: string;
  now: Date;
  readPhotoBase64: (relativePath: string) => Promise<string>;
  directoryUri: string;
  retentionDays: number;
  storage: SafStorage;
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

/** One single-flight SAF snapshot. Health persistence deliberately belongs to the caller. */
export function createAutomaticBackupService(deps: AutomaticBackupDependencies): {
  writeVerifiedSnapshot(): Promise<{ status: "written"; filename: string } | { status: "failed" } | { status: "busy" }>;
} {
  let inFlight = false;
  return {
    async writeVerifiedSnapshot() {
      if (inFlight) return { status: "busy" } as const;
      inFlight = true;
      try {
        const manifest = await buildExportManifest(deps.exec, { exportedAt: deps.exportedAt, readPhotoBase64: deps.readPhotoBase64 });
        const contents = JSON.stringify(manifest);
        parseBackupManifest(JSON.parse(contents));
        const filename = automaticBackupFilename(deps.now);
        await deps.storage.writeVerified(deps.directoryUri, filename, contents);
        // The just-written snapshot is protected by identity, not clock order:
        // a rollback may make its filename look older than retained snapshots.
        try {
          const listed = await deps.storage.list(deps.directoryUri);
          await Promise.all(listed.map(async (uri) => {
            const name = decodeURIComponent(uri).split("/").pop() ?? "";
            if (name !== filename && isOwnedAutomaticBackup(name) && isExpiredAutomaticBackup(name, deps.retentionDays, deps.now)) {
              await deps.storage.remove(uri);
            }
          }));
        } catch {
          // Listing/pruning failure never negates a verified write or health.
        }
        return { status: "written", filename } as const;
      } catch {
        return { status: "failed" } as const;
      } finally {
        inFlight = false;
      }
    },
  };
}
