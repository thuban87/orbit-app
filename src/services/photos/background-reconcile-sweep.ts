import type { SqlExecutor } from "@/db/types";
import { registerSweepHook } from "@/services/launch-sweep";
import { finalizeBackgroundRestoreCandidate } from "@/services/photos/background-finalization";
import {
  applyBackgroundReconcileAction,
  backgroundDerivativeRelPath,
  deleteBackgroundDerivative,
  listBackgroundRestorePendingEntries,
  listBackgroundStorageEntries,
} from "@/services/photos/background-storage";
import { Logger } from "@/utils/logger";
import { planBackgroundReconciliation } from "./background-reconcile-model";

const LOG_SCOPE = "background-reconcile-sweep";

export { planBackgroundReconciliation } from "./background-reconcile-model";

export async function runBackgroundReconciliation(
  exec: SqlExecutor,
): Promise<void> {
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
  for (const action of plan.actions) {
    if (action.kind === "deleteCanonical") {
      deleteBackgroundDerivative(action.relative);
    } else {
      await applyBackgroundReconcileAction(action);
    }
  }
  // The listing must be fresh and the re-drive must be the final canonical
  // writer, after any .bak recovery above. Canonical existence is deliberately
  // irrelevant: it may contain stale bytes from a same-uid replacement.
  const recoveredPaths = new Set<string>();
  for (const pending of await listBackgroundRestorePendingEntries()) {
    const result = await finalizeBackgroundRestoreCandidate(exec, {
      uid: pending.templateUid,
      pendingRelativePath: pending.relative,
    });
    if (result === "finalized") {
      recoveredPaths.add(backgroundDerivativeRelPath(pending.templateUid));
    }
  }
  for (const relative of plan.missingReferences) {
    if (recoveredPaths.has(relative)) continue;
    Logger.error(
      LOG_SCOPE,
      `missing durable background referenced by template: ${relative}`,
    );
  }
}

/** Registers one ready-gated launch sweep; importing this module runs nothing. */
export function registerBackgroundReconcileSweep(
  getExecutor: () => SqlExecutor,
): void {
  registerSweepHook(async () => {
    try {
      await runBackgroundReconciliation(getExecutor());
    } catch (error) {
      Logger.error(
        LOG_SCOPE,
        "background reconciliation failed (best-effort)",
        error,
      );
    }
  });
}
