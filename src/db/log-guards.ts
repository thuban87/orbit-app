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
 * The future test is a STRING comparison, deliberately: `occurred_at` and `now`
 * are local wall-clock strings (`YYYY-MM-DD HH:MM:SS`, produced via
 * `localDateTime()` / `formatLocalDate()` — never `toISOString()`). Zero-padded
 * local wall-clock strings sort chronologically, so `occurredAt > now` is a
 * correct future test. Equal (same second) is allowed; any past value is allowed.
 *
 * BUT the lexical compare is only valid for a WELL-FORMED value: an empty string,
 * a whitespace-only value, a bare date (`YYYY-MM-DD`), a non-zero-padded value,
 * or a nonsense calendar datetime (`2026-13-40 99:99:99`) would each sort BEFORE
 * a real `now` and slip past `occurredAt > now`, then get persisted — leaving
 * `last_contact` unparsable and day-granular status math wrong. So this module's
 * advertised single chokepoint validates BOTH arguments against the strict
 * `YYYY-MM-DD HH:MM:SS` shape AND real-calendar sanity BEFORE the compare, and
 * REJECTS a malformed value.
 *
 * Pure and dependency-free — imports nothing from react-native or expo so the
 * node/vitest test env exercises the exact production code path.
 */

/** Strict local wall-clock shape: zero-padded `YYYY-MM-DD HH:MM:SS`, anchored. */
const LOCAL_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

/**
 * True only for a strict, zero-padded `YYYY-MM-DD HH:MM:SS` that is ALSO a real
 * calendar datetime. The anchored regex rejects empty / whitespace / bare-date /
 * non-padded input; the round-trip through a local `Date` rejects impossible
 * components (month 13, day 40, hour 99, Feb 30, …) that the regex shape alone
 * would admit. No `toISOString` — local components only (dates.ts convention).
 */
function isValidLocalDateTime(value: string): boolean {
  const m = LOCAL_DATETIME_RE.exec(value);
  if (!m) {
    return false;
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6]);
  const dt = new Date(year, month - 1, day, hour, minute, second);
  return (
    dt.getFullYear() === year &&
    dt.getMonth() === month - 1 &&
    dt.getDate() === day &&
    dt.getHours() === hour &&
    dt.getMinutes() === minute &&
    dt.getSeconds() === second
  );
}

/**
 * Throw when `occurredAt` is malformed OR strictly after `now` (both local
 * wall-clock `YYYY-MM-DD HH:MM:SS`). A malformed/empty/whitespace value throws
 * BEFORE the compare (it cannot be trusted to sort chronologically). Equal and
 * past well-formed values return without throwing.
 */
export function rejectFutureOccurredAt(occurredAt: string, now: string): void {
  if (!isValidLocalDateTime(occurredAt)) {
    throw new Error(
      `occurredAt is not a valid local YYYY-MM-DD HH:MM:SS datetime (${JSON.stringify(occurredAt)})`,
    );
  }
  if (!isValidLocalDateTime(now)) {
    throw new Error(
      `now is not a valid local YYYY-MM-DD HH:MM:SS datetime (${JSON.stringify(now)})`,
    );
  }
  if (occurredAt > now) {
    throw new Error(`occurredAt is in the future (${occurredAt} > ${now})`);
  }
}
