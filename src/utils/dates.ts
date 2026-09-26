/**
 * Date utility functions for Orbit plugin.
 *
 * Always use formatLocalDate() instead of toISOString().split('T')[0]
 * to avoid UTC off-by-one bugs near midnight.
 */

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

const MONTH_ABBREVIATIONS = [
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
  const date = new Date(parseLocalMs(stored));
  const month = MONTH_ABBREVIATIONS[date.getMonth()];
  return `${month} ${date.getDate()}, ${date.getFullYear()}, ${clockOf(date)}`;
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
