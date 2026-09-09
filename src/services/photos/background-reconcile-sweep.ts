import type { SqlExecutor } from "@/db/types";
import { registerSweepHook } from "@/services/launch-sweep";
import {
  applyBackgroundReconcileAction,
  deleteBackgroundDerivative,
  listBackgroundStorageEntries,
} from "@/services/photos/background-storage";
import { Logger } from "@/utils/logger";
import { planBackgroundReconciliation } from "./background-reconcile-model";

const LOG_SCOPE = "background-reconcile-sweep";

export { planBackgroundReconciliation } from "./background-reconcile-model";

async function runBackgroundReconciliation(exec: SqlExecutor): Promise<void> {
  const rows = await exec.getAllAsync<{ imagePath: string }>(
    "SELECT image_path AS imagePath FROM profile_background_templates",
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
  for (const relative of plan.missingReferences) {
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
