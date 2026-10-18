/**
 * The import batch lifecycle and its one sanitiser (38.4 D-57; 38.12 D-58).
 *
 * A leaf module with no imports, so every reader of a stored batch lifecycle
 * can share it without an import cycle: the session DAO's lifecycle lock
 * (`import-session-dao.ts`), resume (`sessionBatchLifecycle`,
 * `import-session-read.ts`) and bulk setup's restore (`initialBulkLifecycle`,
 * `bulk-import-setup-logic.ts`). Before 38.12 Plan 23 the DAO kept its own copy
 * and the read layer imported the sanitiser from a screens logic file.
 */

/**
 * The lifecycle every contact a bulk import creates receives (38.4 D-57;
 * ADR-062): Bound with a positive cadence, or Unbound and never-assigned.
 */
export type ImportLifecycle =
  | { trackingEnabled: true; intervalDays: number }
  | { trackingEnabled: false; intervalDays: null };

/** The default batch lifecycle (ADR-066: Unbound stays the default). */
export const UNBOUND_IMPORT: ImportLifecycle = Object.freeze({
  trackingEnabled: false,
  intervalDays: null,
}) as ImportLifecycle;

/**
 * The one lifecycle sanitiser for stored batch values (38.12 D-58): Bound only
 * with a positive integer cadence, otherwise Unbound with no cadence. Setup's
 * restore, resume and the DAO's lifecycle lock all read the stored session
 * through it, so they can never disagree about the same stored inputs
 * (T-38.12-46). The contacts CHECK (migration 011) stays the backstop.
 */
export function sanitiseImportLifecycle(stored: {
  trackingEnabled: boolean;
  intervalDays: number | null;
}): ImportLifecycle {
  const days = stored.intervalDays;
  if (
    stored.trackingEnabled &&
    days !== null &&
    Number.isInteger(days) &&
    days > 0
  ) {
    return { trackingEnabled: true, intervalDays: days };
  }
  return UNBOUND_IMPORT;
}
