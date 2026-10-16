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
export function isFutureLocalDate(
  picked: Date,
  now: Date = new Date(),
): boolean {
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

/** The palette token keys one Last-spoke segment draws with. */
export interface LastSpokeSegmentTone {
  background: "surface" | "accent";
  border: "border" | "borderStrong" | "accent";
  text: "textPrimary" | "textSecondary" | "onAccent";
}

/**
 * The colours of one segment (38.11 D-04, D-44, D-25). A selected segment —
 * "Not yet" included — gets the solid accent fill with an `onAccent` label.
 * Unselected, "Not yet" stays muted (textSecondary on a borderStrong outline;
 * deliberately not `danger`, it is a valid choice) and Today / Pick date sit on
 * the plain surface. Token keys only, so the control reads `colors[tone.*]`.
 */
export function lastSpokeSegmentTone(
  kind: LastSpokeValue["kind"],
  selected: boolean,
): LastSpokeSegmentTone {
  if (selected) {
    return { background: "accent", border: "accent", text: "onAccent" };
  }
  if (kind === "not-yet") {
    return {
      background: "surface",
      border: "borderStrong",
      text: "textSecondary",
    };
  }
  return { background: "surface", border: "border", text: "textPrimary" };
}

/**
 * The Pick date picker's `maximumDate` (38.11 D-31): the last millisecond of
 * today's LOCAL day, built from local date parts (never a UTC slice), so all
 * of today stays pickable and no future day is. `resolvePickedDate` still
 * rejects a future day as the after-the-fact defence.
 */
export function lastSpokeMaxDate(now: Date = new Date()): Date {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
}
