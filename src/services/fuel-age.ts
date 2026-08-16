/**
 * PURE conversational-fuel age formatter (FUEL-04) — renders a stored fuel
 * `created_at` as a human relative age: "today" / "N days ago" / "N months ago" /
 * "N years ago".
 *
 * No react-native, no Skia, no expo, no DB import: node-unit-tested
 * (`fuel-age.test.ts`) like `gravity-logic.ts`.
 *
 * =============================================================================
 * THE DECISION (docs/dossier/03-fuel.md Cluster C — owner [DECIDED]):
 *
 *   AGE IS DISPLAYED AND DRIVES RANKING. NOTHING IS EVER DESTROYED OR HIDDEN BY
 *   AGE. `created_at` renders here and sinks perishable kinds via the ranked
 *   read's `created_at DESC` — but there is NO launch sweep, NO auto-archive, NO
 *   age-keyed DELETE/UPDATE anywhere.
 *   [REJECTED] Auto-archiving perishable kinds; [REJECTED] auto-deletion.
 *
 * This module is therefore PURELY a string formatter — it contains no mutation,
 * no DB access, and cannot remove or conceal a row. It only names how old it is.
 *
 * UNITS: `createdAt`/`now` are stored local wall-clock `YYYY-MM-DD HH:MM:SS`
 * strings (DATA-05), parsed with LOCAL components (never toISOString / UTC),
 * matching `gravity-logic.parseLocalMs` — so there is no evening off-by-one.
 * =============================================================================
 */

/**
 * Parse a stored `YYYY-MM-DD HH:MM:SS` (or bare `YYYY-MM-DD`) as a LOCAL Date —
 * local components so there is no UTC evening off-by-one (dates.ts convention;
 * copied from `gravity-logic.parseLocalMs`). A missing time defaults to
 * `00:00:00`.
 */
function parseLocalMs(stored: string): number {
  const m = stored
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) {
    throw new Error(`fuel-age: unparseable timestamp "${stored}"`);
  }
  const [, y, mo, d, hh, mm, ss] = m;
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(hh ?? 0),
    Number(mm ?? 0),
    Number(ss ?? 0),
  ).getTime();
}

const MS_PER_DAY = 86_400_000;

/** Local midnight (00:00:00) of the day containing `ms`. */
function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** `n unit ago`, pluralised (`1 day ago`, `3 days ago`). */
function ago(n: number, unit: "day" | "month" | "year"): string {
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

/**
 * Format a fuel row's age relative to `now`:
 *   - same calendar day (or a clock-skew FUTURE createdAt) → "today"
 *   - under ~a month → "N days ago"
 *   - under 12 calendar months → "N months ago"
 *   - 12+ calendar months → "N years ago"
 *
 * Day count is calendar-day based (local midnights) so a same-day evening stamp
 * reads "today", not "yesterday". Months/years use calendar components (not a
 * fixed 30/365 divisor) so boundaries land on real month rollovers. A future
 * createdAt is clamped to "today" — age is never negative.
 */
export function formatFuelAge(createdAt: string, now: string): string {
  const createdMs = parseLocalMs(createdAt);
  const nowMs = parseLocalMs(now);

  const days = Math.floor(
    (startOfLocalDay(nowMs) - startOfLocalDay(createdMs)) / MS_PER_DAY,
  );
  if (days <= 0) {
    return "today";
  }
  if (days < 30) {
    return ago(days, "day");
  }

  const created = new Date(createdMs);
  const nowDate = new Date(nowMs);
  let months =
    (nowDate.getFullYear() - created.getFullYear()) * 12 +
    (nowDate.getMonth() - created.getMonth());
  // Not a full calendar month yet if the day-of-month hasn't been reached.
  if (nowDate.getDate() < created.getDate()) {
    months--;
  }
  // Guard: >= 30 days but the calendar arithmetic reads 0 (e.g. spanning a short
  // month) — still at least "1 month ago".
  if (months < 1) {
    months = 1;
  }
  if (months < 12) {
    return ago(months, "month");
  }
  return ago(Math.floor(months / 12), "year");
}
