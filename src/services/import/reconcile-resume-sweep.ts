import { getExecutor, localDateTime } from "@/db/database";
import {
  discardStaleReconcileSessions,
  getNewestResumableReconcileSession,
  listReconcileSessionCards,
} from "@/db/reconcile-session-read";
import type { SqlExecutor } from "@/db/types";
import {
  isReconcileFlowActive,
  isReconcileSessionOpen,
  isReconcileStagingHeld,
} from "@/services/import/reconcile-flow-guard";
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
  /** Unresolved + partial cards left to check (38.12 D-105). */
  cardsLeft: number;
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

/**
 * A corrupt durable card is safe to discard but must not be resumed: any card
 * whose payload does not parse makes the whole check discard-only.
 */
export function describeResumableReconcile(input: {
  session: { id: number };
  cards: Array<{ diffJson: string }>;
  cardsLeft: number;
}): ResumableReconcile {
  const discardOnly = input.cards.some((card) => {
    try {
      JSON.parse(card.diffJson);
      return false;
    } catch {
      return true;
    }
  });
  return {
    sessionId: input.session.id,
    discardOnly,
    cardsLeft: input.cardsLeft,
  };
}

/**
 * Uses the first-class staged path column rather than diff_json so a malformed
 * card cannot strand files or break launch cleanup. A copy an open detail
 * screen holds is live too (38.12 review B-WR-02).
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
    if (
      !livePaths.has(staged.relative) &&
      !isReconcileStagingHeld(staged.relative)
    )
      fs.deleteReconcileStaging(staged.relative);
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
    // A permission round-trip backgrounds Orbit mid-scan: skip this pass so it
    // neither prompts for the live check nor deletes not-yet-committed staging.
    if (isReconcileFlowActive()) return;
    const exec = getExec();
    let description: ResumableReconcile | null = null;
    try {
      // Launch cleanup first (38.12 D-56): the discard commits before it
      // returns these paths, so file cleanup cannot race the transaction.
      cleanupDiscardedReconcileStagedPhotos(
        fs,
        await discardStaleReconcileSessions(exec, now()),
      );
      const newest = await getNewestResumableReconcileSession(exec);
      // Ask once per paused check (D-105): a check whose resume_prompted_at
      // is set was already shown the prompt and stays quiet until it is
      // resumed (which clears it, L-3). The check a reconcile screen is
      // showing is not "resumable" either.
      if (
        newest &&
        newest.resumePromptedAt === null &&
        !isReconcileSessionOpen(newest.session.id)
      ) {
        description = describeResumableReconcile({
          session: newest.session,
          cards: await listReconcileSessionCards(exec, newest.session.id),
          cardsLeft: newest.cardsLeft,
        });
      }
    } catch (error) {
      Logger.error(
        LOG_SCOPE,
        "could not inspect resumable reconciliation",
        error,
      );
    } finally {
      try {
        await reconcileOrphanReconcileStagedPhotos(exec, fs);
      } catch (error) {
        Logger.error(
          LOG_SCOPE,
          "could not reconcile reconciliation staging",
          error,
        );
      }
      onResumable(description);
    }
  });
}
