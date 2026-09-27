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
import type { ImportSession, SessionRowCounts } from "@/db/import-session-read";
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
 * Shown (and read by TalkBack) while the batch lifecycle is locked (D-64). The
 * owner reviews the wording on the device (Plan 17).
 */
export const BULK_LIFECYCLE_LOCKED_COPY =
  "Some contacts from this import are already done, so the whole batch keeps this choice.";

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

/**
 * Whether an invalid custom frequency blocks Import (38.4 review CR-01).
 * `FrequencyPicker` never emits an invalid entry and reports validity through
 * `onValidityChange` instead, so a Bound choice with an invalid frequency must
 * not import: it would write the last cadence the picker emitted, which the
 * user never chose. Unbound carries no cadence, so it never blocks. Shared by
 * bulk setup and the single import review.
 */
export function boundFrequencyBlocksImport(
  trackingEnabled: boolean,
  intervalValid: boolean,
): boolean {
  return trackingEnabled && !intervalValid;
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

/**
 * Whether the batch lifecycle is locked (38.4 D-64, owner; review A WR-02):
 * once any row of the session has left `pending`, a pass has already run under
 * the saved choice, so Bound/Unbound and the cadence can no longer change and
 * the batch never ends with mixed lifecycles. The same rule as the
 * `setSessionBatchDefaults` backstop, so setup never offers a change the DAO
 * would reject. The category is not locked.
 */
export function bulkLifecycleLocked(counts: SessionRowCounts): boolean {
  return (
    counts.imported +
      counts.linked +
      counts.needs_review +
      counts.failed +
      counts.skipped >
    0
  );
}
