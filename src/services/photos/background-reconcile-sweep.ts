import type { SqlExecutor } from "@/db/types";
import { registerSweepHook, SWEEP_IDS } from "@/services/launch-sweep";
import {
  finalizeBackgroundRestoreCandidate,
  withBackgroundFinalizationLock,
} from "@/services/photos/background-finalization";
import {
  applyBackgroundReconcileAction,
  backgroundDerivativeRelPath,
  deleteBackgroundDerivative,
  listBackgroundRestorePendingEntries,
  listBackgroundStorageEntries,
} from "@/services/photos/background-storage";
import {
  pendingBelongsToActiveSession,
  sessionTouchedSince,
  stagingPassMark,
} from "@/services/photos/staging-sessions";
import { Logger } from "@/utils/logger";
import { planBackgroundReconciliation } from "./background-reconcile-model";

const LOG_SCOPE = "background-reconcile-sweep";

export { planBackgroundReconciliation } from "./background-reconcile-model";

export async function runBackgroundReconciliation(
  exec: SqlExecutor,
): Promise<{ failed: number }> {
  const passMark = stagingPassMark();
  const rows = await exec.getAllAsync<{
    uid: string;
    imagePath: string;
    modifiedAt: string;
  }>(
    "SELECT uid,image_path AS imagePath,modified_at AS modifiedAt FROM profile_background_templates",
  );
  // A committed restore marker references the pending artifact, but the old
  // canonical remains a safety net until that artifact is successfully copied.
  // Keep the UID-derived canonical out of orphan deletion during this window.
  const referencedPaths = new Set(
    rows.map((row) =>
      row.imagePath.startsWith(
        `profile-backgrounds/_restore_pending/${row.uid}/`,
      )
        ? backgroundDerivativeRelPath(row.uid)
        : row.imagePath,
    ),
  );
  const plan = planBackgroundReconciliation({
    entries: listBackgroundStorageEntries(),
    referencedPaths,
  });
  let failed = 0;
  for (const action of plan.actions) {
    try {
      if (action.kind === "deleteCanonical") {
        const uid = action.relative.match(
          /^profile-backgrounds\/([A-Za-z0-9_-]+)\.jpg$/,
        )?.[1];
        if (!uid) throw new Error("unsafe background canonical path");
        await withBackgroundFinalizationLock(uid, async () => {
          const fresh = await exec.getAllAsync<{
            uid: string;
            imagePath: string;
          }>(
            "SELECT uid,image_path AS imagePath FROM profile_background_templates WHERE uid=? OR image_path=?",
            [uid, action.relative],
          );
          if (
            fresh.some(
              (row) =>
                row.imagePath === action.relative ||
                (row.uid === uid &&
                  row.imagePath.startsWith(
                    `profile-backgrounds/_restore_pending/${uid}/`,
                  )),
            )
          )
            return;
          deleteBackgroundDerivative(action.relative, true);
        });
      } else {
        await applyBackgroundReconcileAction(action);
      }
    } catch {
      failed += 1;
      Logger.error(LOG_SCOPE, `action failed: ${action.kind}`);
    }
  }
  // The listing must be fresh and the re-drive must be the final canonical
  // writer, after any .bak recovery above. Canonical existence is deliberately
  // irrelevant: it may contain stale bytes from a same-uid replacement.
  const recoveredPaths = new Set<string>();
  for (const pending of await listBackgroundRestorePendingEntries()) {
    if (
      pendingBelongsToActiveSession(pending.relative) ||
      sessionTouchedSince(pending.relative, passMark)
    )
      continue;
    try {
      const result = await finalizeBackgroundRestoreCandidate(exec, {
        uid: pending.templateUid,
        pendingRelativePath: pending.relative,
      });
      if (result === "finalized") {
        recoveredPaths.add(backgroundDerivativeRelPath(pending.templateUid));
      }
    } catch {
      failed += 1;
      Logger.error(LOG_SCOPE, "pending candidate failed");
    }
  }
  for (const relative of plan.missingReferences) {
    if (recoveredPaths.has(relative)) continue;
    Logger.error(
      LOG_SCOPE,
      "missing durable background referenced by template",
    );
  }
  return { failed };
}

/** Registers one ready-gated launch sweep; importing this module runs nothing. */
export function registerBackgroundReconcileSweep(
  getExecutor: () => SqlExecutor,
): void {
  registerSweepHook(
    async () => {
      const summary = await runBackgroundReconciliation(getExecutor());
      if (summary.failed > 0)
        throw new Error("background reconciliation incomplete");
    },
    { id: SWEEP_IDS.backgroundReconcile },
  );
}
