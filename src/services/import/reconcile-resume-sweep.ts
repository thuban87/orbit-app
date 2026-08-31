import { getExecutor, localDateTime } from "@/db/database";
import {
  getNewestPendingReconcileSessionId,
  getResumableReconcileSession,
} from "@/db/reconcile-session-read";
import type { SqlExecutor } from "@/db/types";
import { registerSweepHook } from "@/services/launch-sweep";
import {
  deleteReconcileStaging,
  listReconcileStagingPhotos,
} from "@/services/photos/photo-storage";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "reconcile-resume-sweep";

export interface ReconcileStagingFileSystem {
  deleteReconcileStaging(relative: string): void;
  listReconcileStagingPhotos(): Array<{
    relative: string;
    isStageTmpOrphan: boolean;
  }>;
}

const nativeReconcileStagingFs: ReconcileStagingFileSystem = {
  deleteReconcileStaging,
  listReconcileStagingPhotos,
};

export interface ResumableReconcile {
  sessionId: number;
  /** A malformed durable card can be discarded but must not be resumed. */
  discardOnly: boolean;
}

export interface RegisterReconcileResumeSweepOptions {
  getExecutor?: () => SqlExecutor;
  fs?: ReconcileStagingFileSystem;
  now?: () => string;
}

/** Delete paths returned only after a discard transaction has committed. */
export function cleanupDiscardedReconcileStagedPhotos(
  fs: Pick<ReconcileStagingFileSystem, "deleteReconcileStaging">,
  paths: readonly string[],
): void {
  for (const path of paths) fs.deleteReconcileStaging(path);
}

/** A corrupt durable card is safe to discard but must not be resumed. */
export function describeResumableReconcile(input: {
  session: { id: number };
  cards: Array<{ diffJson: string }>;
}): ResumableReconcile {
  for (const card of input.cards) JSON.parse(card.diffJson);
  return { sessionId: input.session.id, discardOnly: false };
}

/**
 * Uses the first-class staged path column rather than diff_json so a malformed
 * card cannot strand files or break launch cleanup.
 */
export async function reconcileOrphanReconcileStagedPhotos(
  exec: SqlExecutor,
  fs: ReconcileStagingFileSystem = nativeReconcileStagingFs,
): Promise<void> {
  const rows = await exec.getAllAsync<{ staged_photo_rel_path: string | null }>(
    `SELECT c.staged_photo_rel_path
       FROM reconciliation_session_cards c
       JOIN reconciliation_sessions s ON s.id = c.session_id
      WHERE s.status = 'pending'
        AND c.card_status IN ('unresolved', 'partial')
        AND c.staged_photo_rel_path IS NOT NULL`,
  );
  const livePaths = new Set(
    rows.flatMap(({ staged_photo_rel_path }) =>
      staged_photo_rel_path === null ? [] : [staged_photo_rel_path],
    ),
  );
  for (const staged of fs.listReconcileStagingPhotos()) {
    if (!livePaths.has(staged.relative)) fs.deleteReconcileStaging(staged.relative);
  }
}

/** Register the foreground-only resume sweep; importing this module does no work. */
export function registerReconcileResumeSweep(
  onResumable: (resumable: ResumableReconcile | null) => void,
  {
    getExecutor: getExec = getExecutor,
    fs = nativeReconcileStagingFs,
    now = localDateTime,
  }: RegisterReconcileResumeSweepOptions = {},
): void {
  registerSweepHook(async () => {
    const exec = getExec();
    let description: ResumableReconcile | null = null;
    try {
      const resumable = await getResumableReconcileSession(exec, now());
      if (resumable) {
        cleanupDiscardedReconcileStagedPhotos(fs, resumable.sweptStagedPhotoRelPaths);
        description = describeResumableReconcile(resumable);
      }
    } catch (error) {
      Logger.error(LOG_SCOPE, "could not inspect resumable reconciliation", error);
      try {
        const sessionId = await getNewestPendingReconcileSessionId(exec);
        if (sessionId !== null) description = { sessionId, discardOnly: true };
      } catch (fallbackError) {
        Logger.error(LOG_SCOPE, "could not find corrupt reconciliation", fallbackError);
      }
    } finally {
      try {
        await reconcileOrphanReconcileStagedPhotos(exec, fs);
      } catch (error) {
        Logger.error(LOG_SCOPE, "could not reconcile reconciliation staging", error);
      }
      onResumable(description);
    }
  });
}
