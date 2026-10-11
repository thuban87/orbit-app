/**
 * Pure helpers behind the two native date pickers (38.9 D-65 a Memory's
 * meaningful date, D-66 the custom-field Date widget). No React or
 * react-native import, so vitest runs them in node (like
 * tri-state-last-spoke-logic.ts).
 *
 * Storage: a pick is stored as `formatLocalDate()` output (YYYY-MM-DD, local;
 * D-23, CLAUDE.md conventions), never a display string and never
 * `toISOString()`. The validity check and the picker seed only read the stored
 * value: they never return or write a trimmed or repaired copy of it.
 */
import { formatLocalDate, parseLocalMs } from "@/utils/dates";

/** A leading `YYYY-MM-DD`; trailing text is tolerated, as `parsers.date` does. */
const LEADING_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * The stored value's leading calendar date, when it is a real one. Trimmed
 * first, matching `parsers.date` (`field-parsers.ts`, which matches on
 * `r.trim()`; review C6-L6). Used for validation and seeding only.
 */
function leadingCalendarDate(stored: string | null): string | null {
  const candidate = stored?.trim() ?? "";
  const match = LEADING_DATE.exec(candidate);
  if (!match) return null;
  const datePart = candidate.slice(0, 10);
  try {
    parseLocalMs(datePart);
  } catch {
    // An impossible date ("2026-02-31") passes the regex but is not a day.
    return null;
  }
  return datePart;
}

/**
 * The value to store from a native picker event: the local YYYY-MM-DD on
 * "set", otherwise `null` (dismiss or no date: nothing is emitted).
 */
export function storedFromPickerEvent(
  eventType: string,
  date?: Date,
): string | null {
  if (eventType !== "set" || !date) return null;
  return formatLocalDate(date);
}

/** Whether a stored value starts with a real calendar date the picker can show. */
export function isPickableStoredDate(stored: string | null): boolean {
  return leadingCalendarDate(stored) !== null;
}

/**
 * Where the picker opens: the stored date at local noon when it is pickable,
 * else `now`. Only positions the picker's cursor; nothing is written.
 */
export function pickerSeedFromStored(
  stored: string | null,
  now: Date = new Date(),
): Date {
  const datePart = leadingCalendarDate(stored);
  if (datePart === null) return now;
  const [year, month, day] = datePart.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}
