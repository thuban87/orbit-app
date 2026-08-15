/**
 * Pure validation + interval math for FrequencyPicker (CRUD-01).
 *
 * Extracted from the RN component so the correctness-critical rules (positive-
 * integer custom interval; unit → interval_days) are unit-tested in the node
 * Vitest env — `FrequencyPicker.tsx` imports react-native and cannot load
 * there. This is the entry-time defence-in-depth for T-04-05: a bad interval
 * must never emit a value that could reach the recency-dao write chokepoint.
 */

/** Custom "every N" unit; the multiplier that reaches interval_days. */
export type IntervalUnit = "days" | "weeks" | "months";

/** Multiplier applied to the custom "every N" value to reach interval_days. */
export const UNIT_FACTORS: Record<IntervalUnit, number> = {
  days: 1,
  weeks: 7,
  months: 30,
};

/** Locked copy (UI-SPEC Copywriting Contract → invalid custom interval). */
export const INVALID_INTERVAL_MESSAGE = "Enter a whole number greater than 0.";

export interface CustomIntervalResult {
  /** True only when `raw` is a whole number strictly greater than 0. */
  valid: boolean;
  /** `N × unit factor` when valid; `null` otherwise (never emit on invalid). */
  intervalDays: number | null;
}

/**
 * Validate a custom "every N" entry and compute interval_days.
 *
 * Valid ⇔ the (trimmed) input is digits-only and strictly greater than 0. The
 * digits-only guard rejects blank, whitespace, `1.5`, `-1`, `abc`, `1e3` and
 * `0x1` up front, so `Number()` never sees an exponent/hex form that would
 * otherwise slip past a bare `Number.isInteger` check.
 */
export function parseCustomInterval(
  raw: string,
  unit: IntervalUnit,
): CustomIntervalResult {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, intervalDays: null };
  }
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n <= 0) {
    return { valid: false, intervalDays: null };
  }
  return { valid: true, intervalDays: n * UNIT_FACTORS[unit] };
}
