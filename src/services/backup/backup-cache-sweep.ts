import { Directory, File, Paths } from "expo-file-system";
import { registerSweepHook } from "@/services/launch-sweep";
import { createLocalExportFiles } from "./share-export";

// D-13: first foreground sweep at or beyond 24 hours after handoff.
export const EXPORT_STAGING_GRACE_MS = 24 * 60 * 60 * 1000;
const PROCESS_STARTED_AT = Date.now();

export interface RestoreCacheEntry {
  name: string;
  createdAtMs: number | null;
  delete(): void;
}

export interface BackupCacheSweepFiles {
  retireStaleExports(nowMs: number, graceMs: number): Promise<void>;
  listRestoreCandidates(): RestoreCacheEntry[];
}

/** Only app-owned restore-share files from an earlier process are orphans. */
export function createBackupCacheSweep(
  files: BackupCacheSweepFiles,
  now: () => number = Date.now,
  processStartedAtMs = PROCESS_STARTED_AT,
): () => Promise<void> {
  return async () => {
    await files.retireStaleExports(now(), EXPORT_STAGING_GRACE_MS);
    for (const entry of files.listRestoreCandidates()) {
      if (
        /^restore-share-.*\.json$/.test(entry.name) &&
        entry.createdAtMs != null &&
        entry.createdAtMs < processStartedAtMs
      ) {
        entry.delete();
      }
    }
  };
}

function productionFiles(): BackupCacheSweepFiles {
  const exports = createLocalExportFiles();
  return {
    retireStaleExports: (nowMs, graceMs) => exports.retireStale(nowMs, graceMs),
    listRestoreCandidates() {
      return new Directory(Paths.cache)
        .list()
        .filter(
          (item): item is File =>
            item instanceof File && /^restore-share-.*\.json$/.test(item.name),
        )
        .map((file) => ({
          name: file.name,
          createdAtMs:
            file.info().creationTime ?? file.info().modificationTime ?? null,
          delete: () => file.delete(),
        }));
    },
  };
}

export function registerBackupCacheSweep(): void {
  registerSweepHook(createBackupCacheSweep(productionFiles()), {
    id: "backup-cache",
  });
}
