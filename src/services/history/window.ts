/**
 * Pure temporal window generation for the History surfaces (HIST-05).
 *
 * The query -> WINDOW -> aggregate -> render seam (dossier §M). This module owns
 * ONLY the "window" step: turning a lens + reference date into an ordered grid of
 * local calendar dates. It is a pure function of its inputs — NO DB, store,
 * component, or transaction import — so the correctness-critical date geometry
 * lives in a node-testable `.ts`, not an un-loadable `.tsx`.
 *
 * DATE DISCIPLINE (CLAUDE.md, dates.ts): every date is a local `YYYY-MM-DD`
 * string; all arithmetic goes through `formatLocalDate()` over local `Date`
 * components. UTC ISO slicing is NEVER used — it produces an evening
 * off-by-one that has already bitten this project once. String comparison of
 * `YYYY-MM-DD` is chronological, so `<=` on the strings is a valid date order.
 *
 * `today` is injected (not read from the wall clock) so windows are deterministic
 * and node-testable; callers pass `formatLocalDate(new Date())`.
 */
import { formatLocalDate } from "@/utils/dates";

/** The four heatmap lenses. '7days'|'month'|'year' generate date windows here; 'cycles' blocks live in cycles.ts. */
export type HeatmapLens = "7days" | "month" | "year" | "cycles";

/** The three date-grid lenses this module generates windows for. */
export type DateLens = "7days" | "month" | "year";

/** One grid cell: a real local date, or a placeholder padding the week grid. */
export interface WindowCell {
  /** Local `YYYY-MM-DD`, or null for a leading/trailing placeholder (Month/Year padding). */
  readonly date: string | null;
  /** true for a padding cell outside the reference month/year (never countable). */
  readonly isPlaceholder: boolean;
  /** true when a real date is strictly after `today` — rendered, never counted. */
  readonly isFuture: boolean;
}

/** A generated window: its lens, the reference it was built around, real bounds, and ordered cells. */
export interface HistoryWindow {
  readonly lens: DateLens;
  /** The reference date the window was generated around (local `YYYY-MM-DD`). */
  readonly ref: string;
  /** First real (non-placeholder) date, local `YYYY-MM-DD`. */
  readonly start: string;
  /** Last real (non-placeholder) date, local `YYYY-MM-DD`. */
  readonly end: string;
  /** Ordered cells: 7 for '7days'; whole weeks (row-major) for 'month'; whole weeks (column-major) for 'year'. */
  readonly cells: readonly WindowCell[];
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseYMD(date: string): { y: number; m: number; d: number } {
  const match = YMD.exec(date);
  if (!match) {
    throw new Error(`history/window: expected YYYY-MM-DD, got "${date}"`);
  }
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/** Shift a local date by whole days, staying on local components (never UTC). */
function addLocalDays(date: string, delta: number): string {
  const { y, m, d } = parseYMD(date);
  const shifted = new Date(y, m - 1, d);
  shifted.setDate(shifted.getDate() + delta);
  return formatLocalDate(shifted);
}

/** Whole days in a given month (m is 1-based). */
function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

/** Local weekday of a date, 0 = Sunday .. 6 = Saturday. */
function weekdayOf(date: string): number {
  const { y, m, d } = parseYMD(date);
  return new Date(y, m - 1, d).getDay();
}

/** Chronologically earlier of two `YYYY-MM-DD` strings (lexicographic == chronological). */
function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

function realCell(date: string, today: string): WindowCell {
  return { date, isPlaceholder: false, isFuture: date > today };
}

const PLACEHOLDER: WindowCell = { date: null, isPlaceholder: true, isFuture: false };

function buildSevenDays(refDate: string, today: string): HistoryWindow {
  // Rolling last 7 local days ending at the reference date, clamped so no cell
  // is after today.
  const end = minDate(refDate, today);
  const start = addLocalDays(end, -6);
  const cells: WindowCell[] = [];
  for (let i = 0; i < 7; i++) {
    cells.push(realCell(addLocalDays(start, i), today));
  }
  return { lens: "7days", ref: refDate, start, end, cells };
}

function buildMonth(refDate: string, today: string): HistoryWindow {
  const { y, m } = parseYMD(refDate);
  const dim = daysInMonth(y, m);
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = `${y}-${String(m).padStart(2, "0")}-${String(dim).padStart(2, "0")}`;
  const cells: WindowCell[] = [];
  // Leading placeholders align day 1 to its true weekday (Sunday-first).
  for (let i = 0; i < weekdayOf(first); i++) {
    cells.push(PLACEHOLDER);
  }
  for (let day = 1; day <= dim; day++) {
    cells.push(realCell(`${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`, today));
  }
  // Trailing placeholders complete the final week.
  while (cells.length % 7 !== 0) {
    cells.push(PLACEHOLDER);
  }
  return { lens: "month", ref: refDate, start: first, end: last, cells };
}

function buildYear(refDate: string, today: string): HistoryWindow {
  const { y } = parseYMD(refDate);
  const first = `${y}-01-01`;
  const last = `${y}-12-31`;
  const cells: WindowCell[] = [];
  // GitHub-style dense grid: weeks as columns, weekdays as rows (Sunday-first),
  // laid out column-major. Leading placeholders pad the first column.
  for (let i = 0; i < weekdayOf(first); i++) {
    cells.push(PLACEHOLDER);
  }
  for (let cursor = first; cursor <= last; cursor = addLocalDays(cursor, 1)) {
    cells.push(realCell(cursor, today));
  }
  while (cells.length % 7 !== 0) {
    cells.push(PLACEHOLDER);
  }
  return { lens: "year", ref: refDate, start: first, end: last, cells };
}

/**
 * Generate the date window for a lens around `refDate`, clamped to `today`.
 *
 * '7days' -> 7 consecutive dates ending at min(refDate, today).
 * 'month' -> the reference month's grid, weekday-aligned with padding placeholders.
 * 'year'  -> the reference year's dense daily grid (weeks-as-columns).
 * Real dates strictly after `today` are flagged `isFuture` (never counted).
 */
export function buildWindow(lens: DateLens, refDate: string, today: string): HistoryWindow {
  switch (lens) {
    case "7days":
      return buildSevenDays(refDate, today);
    case "month":
      return buildMonth(refDate, today);
    case "year":
      return buildYear(refDate, today);
  }
}

/** Navigate to the previous window of the same lens (no clamp needed — always in the past). */
export function prevWindow(window: HistoryWindow, today: string): HistoryWindow {
  switch (window.lens) {
    case "7days":
      return buildWindow("7days", addLocalDays(window.end, -7), today);
    case "month":
      // Any day in the previous month == the day before the 1st of this month.
      return buildWindow("month", addLocalDays(window.start, -1), today);
    case "year":
      return buildWindow("year", `${parseYMD(window.start).y - 1}-01-01`, today);
  }
}

/** Navigate to the next window, clamped so it can never advance wholly past today. */
export function nextWindow(window: HistoryWindow, today: string): HistoryWindow {
  switch (window.lens) {
    case "7days":
      return buildWindow("7days", minDate(addLocalDays(window.end, 7), today), today);
    case "month": {
      // First day of the next month; clamped to today so a wholly-future month
      // collapses back to today's month.
      const nextFirst = addLocalDays(window.end, 1);
      return buildWindow("month", minDate(nextFirst, today), today);
    }
    case "year": {
      const nextYearJan1 = `${parseYMD(window.start).y + 1}-01-01`;
      return buildWindow("year", minDate(nextYearJan1, today), today);
    }
  }
}
