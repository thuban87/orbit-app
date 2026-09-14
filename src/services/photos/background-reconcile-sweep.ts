import type { SqlExecutor } from "@/db/types";
import { registerSweepHook } from "@/services/launch-sweep";
import {
  applyBackgroundReconcileAction,
  backgroundDerivativeRelPath,
  deleteBackgroundDerivative,
  deleteBackgroundRestorePending,
  listBackgroundRestorePendingEntries,
  listBackgroundStorageEntries,
  persistBackgroundDerivative,
  resolveBackgroundRestorePendingUri,
} from "@/services/photos/background-storage";
import { Logger } from "@/utils/logger";
import { planBackgroundReconciliation } from "./background-reconcile-model";

const LOG_SCOPE = "background-reconcile-sweep";

export { planBackgroundReconciliation } from "./background-reconcile-model";

export async function runBackgroundReconciliation(exec: SqlExecutor): Promise<void> {
  const rows = await exec.getAllAsync<{ uid: string; imagePath: string }>(
    "SELECT uid,image_path AS imagePath FROM profile_background_templates",
  );
  const referencedPaths = new Set(rows.map((row) => row.imagePath));
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
  const committedUids = new Set(rows.map((row) => row.uid));
  const recoveredPaths = new Set<string>();
  for (const pending of listBackgroundRestorePendingEntries()) {
    if (!committedUids.has(pending.uid)) {
      deleteBackgroundRestorePending(pending.uid);
      continue;
    }
    const canonical = backgroundDerivativeRelPath(pending.uid);
    await persistBackgroundDerivative(
      resolveBackgroundRestorePendingUri(pending.uid),
      canonical,
    );
    deleteBackgroundRestorePending(pending.uid);
    recoveredPaths.add(canonical);
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
