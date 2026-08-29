import { getExecutor, localDateTime } from "@/db/database";
import type { ImportSessionMode } from "@/db/import-session-dao";
import {
  getResumableSession,
  type ImportSession,
  listSessionRows,
  type SessionRowCounts,
  sessionRowCounts,
} from "@/db/import-session-read";
import type { SqlExecutor } from "@/db/types";
import { registerSweepHook } from "@/services/launch-sweep";
import {
  deleteImportStaging,
  listImportStagingPhotos,
} from "@/services/photos/photo-storage";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "import-resume-sweep";

export interface ImportStagingFileSystem {
  deleteImportStaging(relative: string): void;
  listImportStagingPhotos(): Array<{
    relative: string;
    isStageTmpOrphan: boolean;
  }>;
}

const nativeImportStagingFs: ImportStagingFileSystem = {
  deleteImportStaging,
  listImportStagingPhotos,
};

export interface ResumableImport {
  sessionId: number;
  mode: ImportSessionMode;
  counts: SessionRowCounts;
  /** A corrupt durable snapshot can be safely discarded but never resumed. */
  discardOnly: boolean;
}

export interface RegisterImportResumeSweepOptions {
  getExecutor?: () => SqlExecutor;
  fs?: ImportStagingFileSystem;
  now?: () => string;
}

/**
 * Remove only staging paths returned by a completed discard transaction.
 * It deliberately does not scan a live session: failed rows need their staged
 * source photo for Retry.
 */
export function cleanupDiscardedStagedPhotos(
  fs: Pick<ImportStagingFileSystem, "deleteImportStaging">,
  paths: readonly string[],
): void {
  for (const path of paths) fs.deleteImportStaging(path);
}

/**
 * Produce the app-root resume state without trusting the original picker URI.
 * Snapshot payload parsing is only a corruption check; routes consume durable
 * rows and counts, never a re-read of the expired system-contact grant.
 */
export async function describeResumable(
  exec: SqlExecutor,
  session: ImportSession,
): Promise<ResumableImport> {
  const [counts, rows] = await Promise.all([
    sessionRowCounts(exec, session.id),
    listSessionRows(exec, session.id),
  ]);
  const discardOnly = rows.some((row) => {
    try {
      JSON.parse(row.sourcePayload);
      return false;
    } catch {
      return true;
    }
  });
  return { sessionId: session.id, mode: session.mode, counts, discardOnly };
}

/**
 * The launch-time backstop for staging files left by an interrupted discard,
 * Replace-all, or failed accept. Every row in a non-discarded session is live:
 * in particular, pending and failed rows retain their retry input.
 */
export async function reconcileOrphanStagedPhotos(
  exec: SqlExecutor,
  fs: ImportStagingFileSystem = nativeImportStagingFs,
): Promise<void> {
  const liveRows = await exec.getAllAsync<{ photo_rel_path: string | null }>(
    `SELECT r.photo_rel_path
       FROM import_session_rows r
       JOIN import_sessions s ON s.id = r.session_id
      WHERE s.status != 'discarded' AND r.photo_rel_path IS NOT NULL`,
  );
  const livePaths = new Set(
    liveRows.flatMap(({ photo_rel_path }) =>
      photo_rel_path === null ? [] : [photo_rel_path],
    ),
  );
  for (const staged of fs.listImportStagingPhotos()) {
    if (!livePaths.has(staged.relative))
      fs.deleteImportStaging(staged.relative);
  }
}

/**
 * Register one foreground-only resume sweep. Importing this module performs no
 * work; App.tsx registers it after migration readiness under its one-shot guard.
 */
export function registerImportResumeSweep(
  onResumable: (resumable: ResumableImport | null) => void,
  {
    getExecutor: getExec = getExecutor,
    fs = nativeImportStagingFs,
    now = localDateTime,
  }: RegisterImportResumeSweepOptions = {},
): void {
  registerSweepHook(async () => {
    const exec = getExec();
    let description: ResumableImport | null = null;
    try {
      const resumable = await getResumableSession(exec, now());
      if (resumable) {
        // getResumableSession's stale-session discard has committed before it
        // returns these paths, so file cleanup cannot race the DB transaction.
        cleanupDiscardedStagedPhotos(fs, resumable.sweptPhotoRelPaths);
        description = await describeResumable(exec, resumable.session);
      }
    } catch (error) {
      Logger.error(LOG_SCOPE, "could not inspect resumable import", error);
    } finally {
      // Required every real foreground launch, even if resumable lookup failed.
      try {
        await reconcileOrphanStagedPhotos(exec, fs);
      } catch (error) {
        Logger.error(LOG_SCOPE, "could not reconcile import staging", error);
      }
      onResumable(description);
    }
  });
}
