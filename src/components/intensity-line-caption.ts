/**
 * PURE caption/label helpers for IntensityLine (Phase 32 review #1) — RN-free so
 * the intended-cadence phrasing is node-testable WITHOUT loading react-native
 * (mirrors ContactCard's `contact-card-ring` split; the node test env cannot
 * parse RN's Flow-typed source). Re-imported by IntensityLine.tsx for app use.
 *
 * THE CADENCE LABEL DESCRIBES THE CONTACT, NOT THE MEASUREMENT WINDOW. The
 * "…intended" phrasing states the contact's CONFIGURED frequency interval as a
 * neutral FLOOR ("Monthly intended"). On the compact profile tile the intensity
 * period IS the contact's interval, so `periodDays` doubles as the cadence there.
 * On the window-scoped IntensityChart, `periodDays` is the WINDOW day-span, so
 * the contact's real interval must be threaded in separately (via
 * `IntensityWindowResult.cadenceDays`) — otherwise a 7-Days lens over a monthly
 * contact would misreport "Weekly intended". No colour, no react-native import.
 *
 * 38.14 D-65 (owner, Q-09): History Intensity reads as the count and its share
 * of the contact's rhythm over the lens window, in plain words ("2 logs · about
 * ⅕ of your monthly rhythm"); the bar shows that share; the average gap reads in
 * plain words and never "0-day". This is display only — `computeIntensity` and
 * `intensity-window.ts` are unchanged, so AI prompts and profile metrics are too
 * (D-35, D-22). Frequency stays a floor, never a scold (intensity-logic header).
 */
import { FREQUENCY_DAYS, type Frequency } from "@/types";
import { calendarDaysBetween, parseLocalMs } from "@/utils/dates";
import { plural } from "@/utils/plural";

/** Reverse of FREQUENCY_DAYS (days → label) for exact-interval phrasing. */
const DAYS_TO_FREQUENCY: Record<number, Frequency> = Object.fromEntries(
  (Object.entries(FREQUENCY_DAYS) as [Frequency, number][]).map(
    ([label, days]) => [days, label],
  ),
) as Record<number, Frequency>;

/**
 * The contact's cadence as a label: an exact FREQUENCY_DAYS match renders its
 * name ("Monthly"), otherwise "every N days". `cadenceDays` is the CONTACT'S
 * configured interval — never a measurement-window span.
 */
export function intendedLabel(cadenceDays: number): string {
  const named = DAYS_TO_FREQUENCY[cadenceDays];
  return named ? named : `every ${plural(cadenceDays, "day")}`;
}

/**
 * The contact's cadence as an adjective for "your … rhythm": a named cadence
 * lower-cased ("monthly"), Bi-Annually as "twice-yearly", otherwise "N-day".
 */
export function rhythmName(cadenceDays: number): string {
  const named = DAYS_TO_FREQUENCY[cadenceDays];
  if (named === "Bi-Annually") return "twice-yearly";
  return named ? named.toLowerCase() : `${cadenceDays}-day`;
}

export interface IntensityShareInput {
  /** Qualifying logs in the lens window (`IntensityResult.currentCount`). */
  readonly currentCount: number;
  /**
   * The days the share is measured over: the lens window's day-span, or for a
   * window still in progress its elapsed days (`elapsedWindowDays`, D-86).
   */
  readonly periodDays: number;
  /** The contact's configured interval (`IntensityWindowResult.cadenceDays`). */
  readonly cadenceDays: number;
}

const isPositive = (n: number): boolean => Number.isFinite(n) && n > 0;

/**
 * The days the share is measured over (38.14 D-86, owner, review B-WR-01):
 * the window from its first day up to today, inclusive. A period still in
 * progress (the current Month or Year, whose window runs to the end of the
 * month or year) is measured only over its elapsed days, so it reads fairly
 * instead of always "behind"; a past period ends before today and keeps its
 * whole span. 0 for a window that starts after today. `start`, `end` and
 * `today` are local `YYYY-MM-DD` dates (formatLocalDate), compared as strings
 * and counted through local calendar-day math, never UTC slicing. Caption
 * layer only: `computeIntensity` and `intensity-window` are unchanged (D-35).
 */
export function elapsedWindowDays(
  window: { readonly start: string; readonly end: string },
  today: string,
): number {
  const last = window.end < today ? window.end : today;
  if (last < window.start) return 0;
  return (
    calendarDaysBetween(
      parseLocalMs(`${window.start} 00:00:00`),
      parseLocalMs(`${last} 00:00:00`),
    ) + 1
  );
}

/**
 * The count's share of the contact's rhythm over the window: logs ÷ the logs
 * the rhythm implies (window ÷ cadence), i.e. count × cadence ÷ window. 0 when
 * any input is not a positive number (never NaN or Infinity). May exceed 1; the
 * bar clamps separately.
 */
export function intensityShare({
  currentCount,
  periodDays,
  cadenceDays,
}: IntensityShareInput): number {
  if (!isPositive(currentCount) || !isPositive(periodDays)) return 0;
  if (!isPositive(cadenceDays)) return 0;
  return (currentCount * cadenceDays) / periodDays;
}

/** Friendly fractions for a share below the rhythm. */
const FRACTIONS: readonly { value: number; glyph: string }[] = [
  { value: 1 / 8, glyph: "⅛" },
  { value: 1 / 5, glyph: "⅕" },
  { value: 1 / 4, glyph: "¼" },
  { value: 1 / 3, glyph: "⅓" },
  { value: 2 / 5, glyph: "⅖" },
  { value: 1 / 2, glyph: "½" },
  { value: 3 / 5, glyph: "⅗" },
  { value: 2 / 3, glyph: "⅔" },
  { value: 3 / 4, glyph: "¾" },
  { value: 4 / 5, glyph: "⅘" },
];
/** Below this share the line reads "under ⅛". */
const UNDER_SMALLEST_SHARE = 0.1;
/** From this share up to the first half step past 1, "about your … rhythm". */
const ABOUT_RHYTHM_SHARE = 0.9;
/** Above this multiple, round to whole multiples instead of halves. */
const WHOLE_MULTIPLE_FROM = 5;

function nearestFraction(share: number): string {
  let best = FRACTIONS[0];
  for (const f of FRACTIONS) {
    if (Math.abs(f.value - share) < Math.abs(best.value - share)) best = f;
  }
  return best.glyph;
}

function multipleText(share: number): string | null {
  const step =
    share >= WHOLE_MULTIPLE_FROM
      ? Math.round(share)
      : Math.round(share * 2) / 2;
  if (step <= 1) return null; // reads "about your … rhythm"
  const whole = Math.floor(step);
  return step === whole ? `${whole}` : `${whole}½`;
}

/**
 * The plain-words Intensity line (D-65): "2 logs · about ⅕ of your monthly
 * rhythm", "about your monthly rhythm" near 1, "about 2× your monthly rhythm"
 * above it, and "No logs in this period" with none. Neutral: more than the
 * rhythm is never "too much".
 */
export function intensityShareCaption(input: IntensityShareInput): string {
  const count = Number.isFinite(input.currentCount)
    ? Math.max(0, Math.round(input.currentCount))
    : 0;
  if (count === 0) return "No logs in this period";
  const logs = plural(count, "log");
  const rhythm = `your ${rhythmName(input.cadenceDays)} rhythm`;
  const share = intensityShare(input);
  if (share < UNDER_SMALLEST_SHARE) return `${logs} · under ⅛ of ${rhythm}`;
  if (share < ABOUT_RHYTHM_SHARE) {
    return `${logs} · about ${nearestFraction(share)} of ${rhythm}`;
  }
  const multiple = multipleText(share);
  return multiple === null
    ? `${logs} · about ${rhythm}`
    : `${logs} · about ${multiple}× ${rhythm}`;
}

/** From this many days the gap reads in months (about 30 days each). */
const GAP_MONTHS_FROM_DAYS = 60;
const DAYS_PER_MONTH = 30;

/**
 * The trailing average gap in plain words (D-65), never "0-day": under a day
 * reads "usually on the same day"; otherwise "usually about N days apart", or
 * months from 60 days. Null (no clause) when the gap is unknown (fewer than two
 * qualifying logs) or not a usable number.
 */
export function averageGapPhrase(
  trailingAvgGapDays: number | null,
): string | null {
  if (
    trailingAvgGapDays === null ||
    !Number.isFinite(trailingAvgGapDays) ||
    trailingAvgGapDays < 0
  ) {
    return null;
  }
  if (trailingAvgGapDays < 1) return "usually on the same day";
  const days = Math.round(trailingAvgGapDays);
  if (days >= GAP_MONTHS_FROM_DAYS) {
    return `usually about ${plural(Math.round(days / DAYS_PER_MONTH), "month")} apart`;
  }
  return `usually about ${plural(days, "day")} apart`;
}
