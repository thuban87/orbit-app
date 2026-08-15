/**
 * Shared entry-time future-date guard for the touchpoint record + edit paths
 * (LOG-06).
 *
 * Extracted so BOTH the DAO reject path (`recordTouchpoint` in recency-dao.ts,
 * which calls this BEFORE opening its write transaction) and the refine-form UI
 * can enforce the same rule from one place. A future `occurred_at` otherwise
 * makes PROGRESS_SQL (status.ts) go negative → the contact buckets 'stable'
 * forever and drops off reminders — so it is rejected before anything is written.
 *
 * This is a STRING comparison, deliberately: `occurred_at` and `now` are local
 * wall-clock strings (`YYYY-MM-DD HH:MM:SS`, produced via `localDateTime()` /
 * `formatLocalDate()` — never `toISOString()`). Zero-padded local wall-clock
 * strings sort chronologically, so `occurredAt > now` is a correct future test.
 * Equal (same second) is allowed; any past value is allowed.
 *
 * Pure and dependency-free — imports nothing from react-native or expo so the
 * node/vitest test env exercises the exact production code path.
 */

/**
 * Throw when `occurredAt` is strictly after `now` (both local wall-clock
 * `YYYY-MM-DD HH:MM:SS`). Equal and past values return without throwing.
 */
export function rejectFutureOccurredAt(occurredAt: string, now: string): void {
  if (occurredAt > now) {
    throw new Error(`occurredAt is in the future (${occurredAt} > ${now})`);
  }
}
