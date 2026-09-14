import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import {
  backgroundDerivativeRelPath,
  deleteBackgroundRestorePending,
  persistBackgroundDerivative,
  resolveBackgroundRestorePendingUri,
} from "@/services/photos/background-storage";

const finalizationTails = new Map<string, Promise<void>>();

export interface BackgroundFinalizationDependencies {
  persist?: (
    sourceUri: string,
    canonicalRelativePath: string,
  ) => Promise<unknown>;
  deletePending?: (pendingRelativePath: string) => void;
}

export type BackgroundFinalizationResult = "finalized" | "stale";

/** Serialize ownership check, file swap, row CAS, and cleanup for one template. */
function withBackgroundFinalizationLock<T>(
  templateUid: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = finalizationTails.get(templateUid) ?? Promise.resolve();
  const queued = previous.catch(() => undefined).then(operation);
  const tail = queued.then(
    () => undefined,
    () => undefined,
  );
  finalizationTails.set(templateUid, tail);
  void tail.finally(() => {
    if (finalizationTails.get(templateUid) === tail) {
      finalizationTails.delete(templateUid);
    }
  });
  return queued;
}

/**
 * Finalize one transaction-owned background artifact.
 *
 * The process-local UID lock is independent of the SQLite write mutex. No
 * transaction is held during filesystem I/O: the row is re-read under the UID
 * lock, bytes are swapped only for the exact owner, and a short transaction
 * compare-and-sets that same marker afterward. A candidate that lost ownership
 * prunes only its own pending artifact and never reaches the canonical writer.
 */
export function finalizeBackgroundRestoreCandidate(
  exec: SqlExecutor,
  candidate: { uid: string; pendingRelativePath: string },
  dependencies: BackgroundFinalizationDependencies = {},
): Promise<BackgroundFinalizationResult> {
  return withBackgroundFinalizationLock(candidate.uid, async () => {
    const deletePending =
      dependencies.deletePending ?? deleteBackgroundRestorePending;
    const committed = await exec.getFirstAsync<{ imagePath: string }>(
      "SELECT image_path AS imagePath FROM profile_background_templates WHERE uid=?",
      [candidate.uid],
    );
    if (!committed || committed.imagePath !== candidate.pendingRelativePath) {
      deletePending(candidate.pendingRelativePath);
      return "stale";
    }

    const canonicalRelativePath = backgroundDerivativeRelPath(candidate.uid);
    await (dependencies.persist ?? persistBackgroundDerivative)(
      resolveBackgroundRestorePendingUri(candidate.pendingRelativePath),
      canonicalRelativePath,
    );

    let finalized = false;
    await inWriteTransaction(exec, async () => {
      const result = await exec.runAsync(
        "UPDATE profile_background_templates SET image_path=? WHERE uid=? AND image_path=?",
        [canonicalRelativePath, candidate.uid, candidate.pendingRelativePath],
      );
      finalized = result.changes === 1;
    });
    deletePending(candidate.pendingRelativePath);
    return finalized ? "finalized" : "stale";
  });
}
