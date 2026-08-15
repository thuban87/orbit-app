/**
 * Pure value model + future-date guard for TriStateLastSpoke (CRUD-02).
 *
 * Extracted from the RN component so the correctness-critical rule (a future
 * "last spoke" date is rejected at entry) is unit-tested in the node Vitest
 * env — `TriStateLastSpoke.tsx` imports react-native + the native
 * datetimepicker and cannot load there. This is the entry-time guard for
 * T-04-05: a future occurred_at must never pin a contact `stable`. Dates format
 * through `formatLocalDate` (never toISOString) — the evening-hours UTC
 * off-by-one is a bug already fixed once and must not reappear.
 */
import { formatLocalDate } from "@/utils/dates";

/**
 * The emitted last-spoke value. "not-yet" writes a NULL last_contact (no
 * interaction row); "today"/"date" flow through the single-writer recency DAO.
 */
export type LastSpokeValue =
  | { kind: "today" }
  | { kind: "date"; date: string }
  | { kind: "not-yet" };

/** Locked copy (UI-SPEC Copywriting Contract → future last-spoke date). */
export const FUTURE_DATE_MESSAGE =
  "That date is in the future. Pick today or earlier.";

/**
 * True when `picked`'s local calendar day is strictly after `now`'s. Compares
 * local YYYY-MM-DD strings (lexicographic order matches chronological order for
 * that format), so time-of-day is ignored — picking today is never "future".
 */
export function isFutureLocalDate(picked: Date, now: Date = new Date()): boolean {
  return formatLocalDate(picked) > formatLocalDate(now);
}

export interface PickDateResult {
  /** True when the pick was a future day and must be discarded. */
  rejected: boolean;
  /** The emit value when accepted; `null` when rejected. */
  value: LastSpokeValue | null;
  /** The locked rejection copy when rejected; `null` otherwise. */
  message: string | null;
}

/**
 * Resolve a date chosen in the native picker: reject a future local day with
 * the locked copy (caller keeps the prior selection), otherwise produce a
 * `{ kind: "date" }` value carrying the local-formatted date string.
 */
export function resolvePickedDate(
  picked: Date,
  now: Date = new Date(),
): PickDateResult {
  if (isFutureLocalDate(picked, now)) {
    return { rejected: true, value: null, message: FUTURE_DATE_MESSAGE };
  }
  return {
    rejected: false,
    value: { kind: "date", date: formatLocalDate(picked) },
    message: null,
  };
}
