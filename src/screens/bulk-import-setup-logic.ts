/**
 * Bulk import setup's batch lifecycle (38.4 D-57, owner; OA-E2).
 *
 * The setup screen offers Bound or Unbound for the whole batch, beside the
 * batch category. This partially supersedes ADR-066 ("only a batch category
 * override"); Unbound stays the default (Phase 19 Cluster E), and there is no
 * per-person lifecycle control. The batch lifecycle lives ONLY on the durable
 * import session (`setSessionBatchDefaults`), so every bulk create path — and a
 * resumed import — reads the same choice.
 */
import { type ImportLifecycle, UNBOUND_IMPORT } from "@/db/import-session-dao";
import type { ImportSession } from "@/db/import-session-read";
import { FREQUENCY_DAYS } from "@/types";

// --- Tunable constants (top-of-file per project convention) ------------------

/** The batch frequency Bound starts at (matches the single review's default). */
export const BULK_IMPORT_DEFAULT_FREQUENCY = FREQUENCY_DAYS.Monthly;

/**
 * Shown only while Bound is selected. It must stay true: a Bound contact gets
 * birthday reminders at once and decay reminders after its first touchpoint.
 * The owner reviews the wording on the device (Plan 17).
 */
export const BULK_BOUND_BLURB =
  "Bound adds every imported contact to your reminders at this frequency.";

/**
 * The lifecycle setup saves: Bound with the picked frequency (or the default),
 * or Unbound with no cadence — even if a frequency was picked before switching
 * back to Unbound.
 */
export function bulkLifecycleChoice(
  trackingEnabled: boolean,
  intervalDays: number | null,
): ImportLifecycle {
  if (trackingEnabled) {
    return {
      trackingEnabled: true,
      intervalDays: intervalDays ?? BULK_IMPORT_DEFAULT_FREQUENCY,
    };
  }
  return UNBOUND_IMPORT;
}

/** The screen's starting choice, restored from the session (resume keeps it). */
export function initialBulkLifecycle(
  session: Pick<ImportSession, "batchTrackingEnabled" | "batchIntervalDays">,
): { trackingEnabled: boolean; intervalDays: number | null } {
  return {
    trackingEnabled: session.batchTrackingEnabled,
    intervalDays: session.batchIntervalDays,
  };
}
