import { localDateTime } from "@/db/database";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { EXPIRE_AFTER_HOURS } from "@/logic/assist-eligibility";
import type { SweepHook } from "@/services/launch-sweep";

/** Retain terminal assist rows briefly for local diagnostics, then prune them. */
export const RETAIN_RESOLVED_DAYS = 30;

/**
 * Build the foreground-only assist cleanup hook. Executor lookup happens only
 * when the hook runs after migration readiness, never on module import.
 */
export function interactionAssistSweep(
  getExecutor: () => SqlExecutor,
): SweepHook {
  return async () => {
    const exec = getExecutor();
    const now = localDateTime();
    await inWriteTransaction(exec, async () => {
      await exec.runAsync(
        `UPDATE interaction_assists
            SET status = 'expired', resolved_at = ?, modified_at = ?
          WHERE status = 'pending'
            AND (CAST(strftime('%s', ?) AS INTEGER) - CAST(strftime('%s', handoff_at) AS INTEGER)) > ?`,
        [now, now, now, EXPIRE_AFTER_HOURS * 60 * 60],
      );
      await exec.runAsync(
        `DELETE FROM interaction_assists
          WHERE status IN ('logged', 'dismissed', 'expired', 'failed')
            AND resolved_at IS NOT NULL
            AND (CAST(strftime('%s', ?) AS INTEGER) - CAST(strftime('%s', resolved_at) AS INTEGER)) > ?`,
        [now, RETAIN_RESOLVED_DAYS * 24 * 60 * 60],
      );
    });
  };
}
