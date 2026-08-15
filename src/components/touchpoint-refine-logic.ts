/**
 * Pure date+time carry-state math for TouchpointRefineForm (LOG-01).
 *
 * Extracted from the RN component so the correctness-critical part is unit-tested
 * in the node Vitest env — `TouchpointRefineForm.tsx` imports react-native + the
 * native `@react-native-community/datetimepicker` and cannot load there.
 *
 * WHY THIS IS THE CORRECTNESS-CRITICAL PART: Android has NO combined date+time
 * picker (dossier F7), so correcting a touchpoint's timestamp is TWO sequential
 * dialogs — a date dialog then a time dialog — and the app must stitch the Y-M-D
 * from one and the H:M:S from the other into ONE value while carrying whichever
 * part was chosen first. That combined value feeds `editTouchpointFull`'s
 * `occurred_at`, which the day-granular status math reads, so it MUST be a LOCAL
 * wall-clock `YYYY-MM-DD HH:MM:SS` built from local components — NEVER
 * `toISOString()`, whose UTC shift reintroduces the evening off-by-one bug already
 * fixed once in the plugin.
 *
 * Seeding the two dialogs from a STORED row also needs a parse that preserves
 * TIME-OF-DAY. `types.ts parseDate` matches only `YYYY-MM-DD` and DROPS the time,
 * so it must NOT be used here; `parseLocalDateTime` below keeps H:M:S.
 *
 * Pure and react-native-free — imports only `formatLocalDate` (local Y-M-D) and
 * `rejectFutureOccurredAt` (the shared LOG-06 future compare).
 */
import { rejectFutureOccurredAt } from "@/db/log-guards";
import { formatLocalDate } from "@/utils/dates";

/** A date or a stored `YYYY-MM-DD[ HH:MM:SS]` string. */
type DateOrStored = Date | string;

/** Zero-padded local `HH:MM:SS` from a Date's local components (never UTC). */
function localTimePart(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/** Normalise a Date-or-stored-string input to a local Date. */
function toDate(value: DateOrStored): Date {
  return typeof value === "string" ? parseLocalDateTime(value) : value;
}

/**
 * Parse a stored `YYYY-MM-DD HH:MM:SS` (or bare `YYYY-MM-DD`) into a local Date
 * via `new Date(y, m-1, d, H, M, S)` — LOCAL components, so TIME-OF-DAY is
 * preserved. This is REQUIRED for seeding the refine form's date+time dialogs
 * from a stored row; do NOT reuse `types.ts parseDate`, which matches only
 * `YYYY-MM-DD` and drops the time. A missing time defaults to `00:00:00`.
 */
export function parseLocalDateTime(stored: string): Date {
  const m = stored
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) {
    throw new Error(`parseLocalDateTime: unparseable "${stored}"`);
  }
  const [, y, mo, d, hh, mm, ss] = m;
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(hh ?? 0),
    Number(mm ?? 0),
    Number(ss ?? 0),
  );
}

/**
 * Stitch the calendar day from `datePart` and the wall-clock time from
 * `timePart` into ONE local `YYYY-MM-DD HH:MM:SS` string. This is the two-dialog
 * carry-state combine: pass the freshly-picked part plus the carried other part
 * (in either order of picking) and the untouched part survives. Local components
 * only — never `toISOString()`.
 */
export function combineDateAndTime(
  datePart: DateOrStored,
  timePart: DateOrStored,
): string {
  const day = formatLocalDate(toDate(datePart));
  const time = localTimePart(toDate(timePart));
  return `${day} ${time}`;
}

/**
 * True when the combined local datetime is strictly after `now` (both local
 * wall-clock `YYYY-MM-DD HH:MM:SS`). Reuses the shared LOG-06 `rejectFutureOccurredAt`
 * compare so the UI flags exactly what the DAO would reject. Equal / past → false.
 */
export function isCombinedInFuture(combined: string, now: string): boolean {
  try {
    rejectFutureOccurredAt(combined, now);
    return false;
  } catch {
    return true;
  }
}
