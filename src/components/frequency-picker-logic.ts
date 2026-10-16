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

/** Inputs to the one show-error rule for the Custom… box. */
export interface CustomErrorInput {
  /** The custom entry parses (`parseCustomInterval(...).valid`). */
  valid: boolean;
  /** The user has typed in the box since entering custom mode. */
  touched: boolean;
  /** A blocked Save asked the field to show its error (host-driven). */
  forced: boolean;
  /** The host opted into the after-typing timing (Add and Edit only). */
  afterTyping: boolean;
}

/**
 * Whether the Custom… box shows its error. One predicate drives BOTH error
 * signals — the caption and the box's danger border (38.11 D-36, review U-03).
 *
 * Default timing (`afterTyping` false — every host that does not opt in):
 * exactly `!valid`, today's behaviour (T-07). Opt-in timing (Add and Edit
 * Contact): an invalid entry shows only once the user has typed in the box or
 * a blocked Save forces it (38.9 validation rule: errors after the user types).
 */
export function shouldShowCustomError({
  valid,
  touched,
  forced,
  afterTyping,
}: CustomErrorInput): boolean {
  if (valid) return false;
  if (!afterTyping) return true;
  return touched || forced;
}
