/**
 * The SINGLE birthday parser. Pure — no React Native / Expo imports — so Vitest
 * runs it in node. Plan 06's banner and Phase 11's notification (NOTIF-04) both
 * reuse this exact `daysUntilBirthday`.
 *
 * It fixes the two bugs carried in the legacy Obsidian `BirthdayBanner`:
 *   Bug 1 — the day-of drop: a time-carrying `now` compared against a local
 *           midnight made "today" fall through, so a birthday never showed 0.
 *           Fixed by comparing LOCAL MIDNIGHT to LOCAL MIDNIGHT.
 *   Bug 2 — the Feb-29 → Mar-1 overflow: `new Date(y, 1, 29)` in a non-leap year
 *           silently rolls to Mar 1. Fixed by an EXPLICIT Feb-29 observation
 *           branch (no silent Date normalization).
 *
 * Two stored formats are accepted (see edit-contact-logic.ts):
 *   - `MM-DD`      → year unknown (leap-permissive: a genuine 02-29 must survive)
 *   - `YYYY-MM-DD` → year known (Feb-29 validated against that specific year)
 * The stored year never changes the "next occurrence" math — only month/day do.
 */

// ---------------------------------------------------------------------------
// FLAGGED owner decision (RESEARCH §Open Questions Q2 / A2, severity LOW):
// how to observe a Feb-29 birthday in a NON-leap year. The two sensible
// conventions are Feb-28 (celebrate within the birth month — the default here)
// and Mar-1. The BUG is the *silent* overflow; any explicit choice fixes it.
// To switch to Mar-1 observation the owner would change this single constant
// AND the branch in `observedDayFor` (Mar-1 is month 2, day 1, not this month).
// Keeping it Feb-28 makes the observed day stay within February.
// ---------------------------------------------------------------------------
export const FEB_29_OBSERVED_DAY = 28;

const MS_PER_DAY = 86_400_000;

const MM_DD = /^(\d{2})-(\d{2})$/;
const YYYY_MM_DD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Proleptic Gregorian leap-year test. */
function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Number of days in a 1-based month for a given year (Feb depends on leap). */
function daysInMonth(year: number, month1: number): number {
  const lengths = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return lengths[month1 - 1];
}

interface ParsedBirthday {
  /** 1-based month (1–12). */
  month1: number;
  /** Day of month (1–31), pre-validated. */
  day: number;
  /**
   * Whether the day was validated leap-PERMISSIVELY (MM-DD, year unknown). A
   * year-unknown 02-29 is allowed here; a YYYY-MM-DD 02-29 was already checked
   * against its real year, so this flag is irrelevant for it.
   */
  yearUnknown: boolean;
}

/**
 * Strict parse + explicit calendar validation, done BEFORE any Date is built —
 * `new Date(y, m, d)` silently normalizes impossible dates (`02-30` → Mar 2), so
 * a length check alone would let malformed values through as real dates. Returns
 * null for anything that is not a real calendar date (MEDIUM-1).
 */
function parseStoredBirthday(stored: string): ParsedBirthday | null {
  const mmdd = MM_DD.exec(stored);
  if (mmdd) {
    const month1 = Number(mmdd[1]);
    const day = Number(mmdd[2]);
    if (month1 < 1 || month1 > 12) return null;
    // Year unknown → February is leap-permissive (allow 29 so a real Feb-29
    // birthday survives); every other month uses its fixed length.
    const maxDay = month1 === 2 ? 29 : daysInMonth(2001, month1);
    if (day < 1 || day > maxDay) return null;
    return { month1, day, yearUnknown: true };
  }

  const ymd = YYYY_MM_DD.exec(stored);
  if (ymd) {
    const year = Number(ymd[1]);
    const month1 = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (month1 < 1 || month1 > 12) return null;
    // Year known → validate the day against THAT year's calendar, so non-leap
    // 2021-02-29 → null while leap 2020-02-29 is valid.
    if (day < 1 || day > daysInMonth(year, month1)) return null;
    return { month1, day, yearUnknown: false };
  }

  return null;
}

/**
 * The day-of-month on which a birthday is observed in `targetYear`. Normally the
 * stored day, EXCEPT a Feb-29 birthday in a non-leap year, which is observed on
 * `FEB_29_OBSERVED_DAY` (Feb-28) — chosen explicitly so `new Date(y, 1, 29)`
 * never silently overflows to Mar 1.
 */
function observedDayFor(
  targetYear: number,
  month1: number,
  day: number,
): number {
  if (month1 === 2 && day === 29 && !isLeapYear(targetYear)) {
    return FEB_29_OBSERVED_DAY;
  }
  return day;
}

/**
 * Whole days from `today` until the next occurrence of the stored birthday.
 *
 * @param stored - `contacts.birthday`: `MM-DD`, `YYYY-MM-DD`, or null (nullable
 *   column, migration 001-initial.ts:69; edit-contact-logic.ts:98 already types
 *   the stored value `string | null`).
 * @param today - the reference "now"; only its LOCAL Y/M/D is used (time-of-day
 *   is discarded so the day-of case is exactly 0).
 * @returns 0 when today is the birthday; a positive count otherwise (a birthday
 *   already passed this year rolls to next year); null for null / empty /
 *   whitespace / malformed / calendar-invalid input (never throws).
 */
export function daysUntilBirthday(
  stored: string | null,
  today: Date,
): number | null {
  // Early null/empty guard BEFORE any regex or Date work (LOW-3: nullable column).
  if (stored == null || stored.trim() === "") {
    return null;
  }

  const parsed = parseStoredBirthday(stored);
  if (parsed === null) {
    return null;
  }

  // Bug 1: build BOTH anchors at LOCAL MIDNIGHT from `today`'s local Y/M/D.
  const ty = today.getFullYear();
  const tm = today.getMonth();
  const td = today.getDate();
  const todayMidnight = new Date(ty, tm, td);

  const month0 = parsed.month1 - 1;

  // This year's occurrence (Bug 2: explicit observed day, no Date overflow).
  let targetYear = ty;
  let observed = observedDayFor(targetYear, parsed.month1, parsed.day);
  let birthday = new Date(targetYear, month0, observed);

  // Already passed this year → roll to next year, recomputing the observed day
  // for next year's leap status (a Feb-29 may become Feb-28 or vice versa).
  if (birthday.getTime() < todayMidnight.getTime()) {
    targetYear = ty + 1;
    observed = observedDayFor(targetYear, parsed.month1, parsed.day);
    birthday = new Date(targetYear, month0, observed);
  }

  // Whole-day difference between two local midnights (round guards any DST drift).
  return Math.round(
    (birthday.getTime() - todayMidnight.getTime()) / MS_PER_DAY,
  );
}
