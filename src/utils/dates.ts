/**
 * Date utility functions for Orbit plugin.
 *
 * Always use formatLocalDate() instead of toISOString().split('T')[0]
 * to avoid UTC off-by-one bugs near midnight.
 */

import { isValidStoredBirthday } from "@/logic/birthday-logic";

/**
 * Returns local YYYY-MM-DD string.
 *
 * Uses the local timezone — avoids the UTC off-by-one that
 * toISOString().split('T')[0] produces for evening hours.
 *
 * @param date - Date to format (defaults to now)
 * @returns String in YYYY-MM-DD format
 */
export function formatLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse an Orbit local wall-clock timestamp without converting through UTC. */
export function parseLocalMs(stored: string): number {
  const match = stored
    .trim()
    .match(
      /^([0-9]{4})-([0-9]{2})-([0-9]{2})(?:[ T]([0-9]{2}):([0-9]{2})(?::([0-9]{2}))?)?$/,
    );
  if (!match) {
    throw new Error(`dates: unparseable timestamp "${stored}"`);
  }
  const [, year, month, day, hour, minute, second] = match;
  const components = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour ?? 0),
    minute: Number(minute ?? 0),
    second: Number(second ?? 0),
  };
  if (
    components.month < 1 ||
    components.month > 12 ||
    components.day < 1 ||
    components.day > 31 ||
    components.hour > 23 ||
    components.minute > 59 ||
    components.second > 59
  ) {
    throw new Error(`dates: unparseable timestamp "${stored}"`);
  }

  const local = new Date(
    components.year,
    components.month - 1,
    components.day,
    components.hour,
    components.minute,
    components.second,
  );
  if (
    local.getFullYear() !== components.year ||
    local.getMonth() !== components.month - 1 ||
    local.getDate() !== components.day ||
    local.getHours() !== components.hour ||
    local.getMinutes() !== components.minute ||
    local.getSeconds() !== components.second
  ) {
    throw new Error(`dates: unparseable timestamp "${stored}"`);
  }
  return local.getTime();
}

const TIME_FORMAT: "12h" | "24h" = "12h";

/**
 * The shared month and weekday names (38.9 D-23). Every display formatter in
 * the app reads these tables; no screen keeps a private copy.
 */
export const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Indexed by `Date.getDay()` (0 = Sunday). */
export const WEEKDAY_SHORT = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

/** Indexed by `Date.getDay()` (0 = Sunday). */
export const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Formats a minute-precision clock independently of device locale. */
export function formatMinuteClock(
  parts: Readonly<{ hour: number; minute: number }>,
  mode: "12h" | "24h",
): string {
  const minute = String(parts.minute).padStart(2, "0");
  if (mode === "24h") {
    return `${String(parts.hour).padStart(2, "0")}:${minute}`;
  }

  const period = parts.hour < 12 ? "AM" : "PM";
  const hour = parts.hour % 12 || 12;
  return `${hour}:${minute} ${period}`;
}

/**
 * Formats a stored local wall-clock timestamp for user-facing display.
 *
 * This is deliberately display-only: stored timestamp precision remains
 * unchanged, while visible timestamps omit seconds.
 */
export function formatDateTimeMinute(stored: string): string {
  return dateTimeMinuteOf(new Date(parseLocalMs(stored)));
}

/** "Sep 26, 2026, 2:05 PM" for an instant, in the device's local time. */
function dateTimeMinuteOf(date: Date): string {
  const month = MONTH_SHORT[date.getMonth()];
  return `${month} ${date.getDate()}, ${date.getFullYear()}, ${clockOf(date)}`;
}

/**
 * Parse an ISO-8601 UTC timestamp ending in "Z", with optional seconds and
 * optional milliseconds ("2026-10-17T14:30:00.123Z"), to epoch ms. Returns
 * null for any other shape or an impossible date (38.12 D-66: a backup's
 * `exportedAt` can be a UTC stamp, which `parseLocalMs` rejects).
 */
export function parseIsoUtcMs(stored: string): number | null {
  const match = stored
    .trim()
    .match(
      /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.([0-9]{1,3}))?)?Z$/,
    );
  if (!match) return null;
  const [, year, month, day, hour, minute, second, fraction] = match;
  const parts = [
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? 0),
    Number((fraction ?? "0").padEnd(3, "0")),
  ] as const;
  const ms = Date.UTC(...parts);
  const back = new Date(ms);
  const roundTrips =
    back.getUTCFullYear() === parts[0] &&
    back.getUTCMonth() === parts[1] &&
    back.getUTCDate() === parts[2] &&
    back.getUTCHours() === parts[3] &&
    back.getUTCMinutes() === parts[4] &&
    back.getUTCSeconds() === parts[5];
  return roundTrips ? ms : null;
}

/**
 * Epoch ms of a stored stamp: Orbit's local wall-clock form
 * (`parseLocalMs`, e.g. "2026-10-17 12:00:00") or an ISO UTC "…Z" stamp
 * (`parseIsoUtcMs`), else NaN. Never `Date.parse`, whose handling of the
 * space-separated local form differs between engines (38.12 D-IN-11).
 */
export function parseStampMsOrNaN(stored: string): number {
  try {
    return parseLocalMs(stored);
  } catch {
    return parseIsoUtcMs(stored) ?? Number.NaN;
  }
}

/** The neutral display label shared by every `…OrFallback` formatter. */
const UNKNOWN_TIME_LABEL = "Unknown time";

/** Returns a neutral display label when a stored timestamp cannot be parsed. */
export function formatDateTimeMinuteOrFallback(stored: string): string {
  try {
    return formatDateTimeMinute(stored);
  } catch {
    return UNKNOWN_TIME_LABEL;
  }
}

/**
 * A backup's source time for display (38.12 D-66): an Orbit local wall-clock
 * stamp, or an ISO UTC "Z" stamp shown in the device's local time, both at
 * minute precision like `formatDateTimeMinute`. Only a value neither parses
 * shows the neutral fallback.
 */
export function formatSourceTimeMinuteOrFallback(stored: string): string {
  try {
    return formatDateTimeMinute(stored);
  } catch {
    const utcMs = parseIsoUtcMs(stored);
    return utcMs === null
      ? UNKNOWN_TIME_LABEL
      : dateTimeMinuteOf(new Date(utcMs));
  }
}

/**
 * Formats only the clock of a stored local wall-clock timestamp (e.g.
 * "9:05 AM"), for rows that already sit within a known day.
 *
 * Display-only, like `formatDateTimeMinute`: stored precision is unchanged and
 * seconds are truncated, never shown. Both formatters share `clockOf` and the
 * module-private `TIME_FORMAT`, so time-only and date-time displays are one
 * contract and cannot disagree (ADR-152, 38.4 D-07; RG-038). Throws on an
 * unparseable value — use `formatTimeMinuteOrFallback` in UI.
 */
export function formatTimeMinute(stored: string): string {
  return clockOf(new Date(parseLocalMs(stored)));
}

/** `formatTimeMinute`, degrading to the same neutral label on a parse failure. */
export function formatTimeMinuteOrFallback(stored: string): string {
  try {
    return formatTimeMinute(stored);
  } catch {
    return UNKNOWN_TIME_LABEL;
  }
}

/** The single minute-precision clock rendering shared by the display formatters. */
function clockOf(date: Date): string {
  return formatMinuteClock(
    { hour: date.getHours(), minute: date.getMinutes() },
    TIME_FORMAT,
  );
}

export interface DisplayDateOptions {
  /** The day the current-year rule compares against (defaults to the wall clock). */
  readonly now?: Date;
  /** Prefix the short weekday ("Tue, Oct 13") where the day matters. */
  readonly weekday?: boolean;
}

/**
 * The one date-only display formatter (38.9 D-23, D-48): "Oct 13" in the
 * current year, "Jun 2, 2025" in any other year, and "Tue, Oct 13" with
 * `weekday`. A stored datetime shows its date part only.
 *
 * DISPLAY ONLY. Its output is never a storage key, query parameter, testID or
 * persisted value; those stay on `formatLocalDate()` (CLAUDE.md conventions,
 * D-23; `display-date-contract.test.ts`). Strings parse strictly through
 * `parseLocalMs`, so an impossible date ("2026-02-31") throws; use
 * `formatDisplayDateOrFallback` in UI.
 */
export function formatDisplayDate(
  stored: string | Date,
  opts: DisplayDateOptions = {},
): string {
  const date =
    typeof stored === "string" ? new Date(parseLocalMs(stored)) : stored;
  if (Number.isNaN(date.getTime())) {
    throw new Error("dates: invalid Date");
  }
  const now = opts.now ?? new Date();
  const monthDay = formatMonthDay(date.getMonth() + 1, date.getDate());
  const year =
    date.getFullYear() === now.getFullYear() ? "" : `, ${date.getFullYear()}`;
  const weekday = opts.weekday ? `${WEEKDAY_SHORT[date.getDay()]}, ` : "";
  return `${weekday}${monthDay}${year}`;
}

/**
 * `formatDisplayDate`, degrading to `fallback` when the value cannot be parsed.
 * Pass the raw value as the fallback where an invalid value must stay visible
 * as stored (custom-field error state, legacy free text).
 */
export function formatDisplayDateOrFallback(
  stored: string | Date,
  fallback = "Unknown date",
  opts: DisplayDateOptions = {},
): string {
  try {
    return formatDisplayDate(stored, opts);
  } catch {
    return fallback;
  }
}

/** "Feb 29" from a 1-based month and a day of month. Display only. */
export function formatMonthDay(month: number, day: number): string {
  return `${MONTH_SHORT[month - 1]} ${day}`;
}

/**
 * Display form of a stored `contacts.birthday` value (38.9 D-70, D-23).
 *
 * Only what the strict birthday gate (`isValidStoredBirthday`) accepts is
 * formatted: an exact `YYYY-MM-DD` always shows its year ("Jun 2, 2026", even
 * in the current year; D-70 narrows D-48 for birthdays only), an exact `MM-DD`
 * shows month-day ("Feb 29"). Anything else ("02-30", "--06-02", padded or
 * trailing text) is returned raw. Never throws.
 *
 * DISPLAY ONLY: never written back. The storage form is
 * `buildBirthdayForStorage` (edit-contact-logic.ts), which this does not touch.
 */
export function formatStoredBirthdayForDisplay(stored: string): string {
  if (!isValidStoredBirthday(stored)) return stored;
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(stored);
  if (full) {
    const [, year, month, day] = full;
    return `${formatMonthDay(Number(month), Number(day))}, ${Number(year)}`;
  }
  const [month, day] = stored.split("-");
  return formatMonthDay(Number(month), Number(day));
}

const MS_PER_DAY = 86_400_000;

/**
 * Whole local calendar days between timestamps, anchored to UTC midnights so
 * spring-forward and fall-back transitions cannot create an off-by-one.
 */
export function calendarDaysBetween(createdMs: number, nowMs: number): number {
  const created = new Date(createdMs);
  const now = new Date(nowMs);
  return Math.round(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(created.getFullYear(), created.getMonth(), created.getDate())) /
      MS_PER_DAY,
  );
}

/**
 * Mirrors `date(snooze_until) > date('now','localtime')`: only a parseable
 * local date strictly after today is actively snoozed. Malformed stored text
 * fails closed, matching SQLite's false/NULL comparison result.
 */
export function isSnoozed(snoozeUntil: string | null, now: string): boolean {
  if (snoozeUntil === null) return false;
  try {
    return (
      calendarDaysBetween(parseLocalMs(now), parseLocalMs(snoozeUntil)) > 0
    );
  } catch {
    return false;
  }
}
