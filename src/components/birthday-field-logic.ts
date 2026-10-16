/**
 * The shared Birthday control's pure logic (38.11 D-48, D-49, D-61).
 *
 * Storage convention (RESEARCH Pitfall 7, unchanged): `contacts.birthday` holds
 * `MM-DD` when the year is unknown, `YYYY-MM-DD` when known, and null when
 * unset. The form holds a FULL `YYYY-MM-DD` input plus a year-unknown flag; a
 * stored year-unknown value seeds the input with the leap-safe placeholder year
 * 2000 so 02-29 round-trips.
 *
 * `parseBirthdayForForm` / `buildBirthdayForStorage` live here (moved from
 * `src/screens/edit-contact-logic.ts`, which re-exports them unchanged) so Add
 * Contact's `create-contact-logic.ts` can use them without an import cycle
 * (`edit-contact-logic` already imports `create-contact-logic`).
 *
 * PURE — no react-native, no DB, no Date-of-now; callers inject today.
 */

/**
 * Split a STORED birthday into the picker's full-date input + the year-unknown
 * flag (RESEARCH Pitfall 7, distinguished by string length). A `MM-DD` (5-char)
 * value is year-unknown; it seeds the picker with a leap-safe placeholder year
 * (2000) so 02-29 round-trips. A `YYYY-MM-DD` value keeps its year. Null → unset.
 */
export function parseBirthdayForForm(stored: string | null): {
  birthdayInput: string | null;
  birthdayYearUnknown: boolean;
} {
  if (stored == null || stored.length === 0) {
    return { birthdayInput: null, birthdayYearUnknown: false };
  }
  if (stored.length === 5) {
    return { birthdayInput: `2000-${stored}`, birthdayYearUnknown: true };
  }
  return { birthdayInput: stored.slice(0, 10), birthdayYearUnknown: false };
}

/**
 * The value written to `contacts.birthday`: `MM-DD` when the year is unknown,
 * `YYYY-MM-DD` when known (Pitfall 7). Null when unset.
 */
export function buildBirthdayForStorage(
  birthdayInput: string | null,
  yearUnknown: boolean,
): string | null {
  if (birthdayInput == null || birthdayInput.length === 0) {
    return null;
  }
  const full = birthdayInput.slice(0, 10);
  return yearUnknown ? full.slice(5) : full;
}

// =============================================================================
// THE YEAR-UNKNOWN STATE MACHINE (38.11 D-61, D-49; review U-08, V-10, W-02).
//
// D-61: switching Year unknown OFF never keeps the 2000 placeholder. It asks
// for the year: the host opens the date picker on the returned seed and
// changes nothing until the user picks ("set" → the picked full date, year
// known). Cancelling ("dismissed") leaves Year unknown on, input unchanged.
// D-49: Clear stores null. Every date crosses as a local `YYYY-MM-DD` string
// built from parts (never a UTC slice, never `new Date(y, 1, 29)` in a
// non-leap year, which rolls to 1 March — T-05).
// =============================================================================

/** The control's state. `input` is a FULL `YYYY-MM-DD` or null (unset). */
export interface BirthdayFieldState {
  input: string | null;
  /** On → storage drops the year (`MM-DD`). */
  yearUnknown: boolean;
  /**
   * Whether the input's year is only a placeholder, not a year the user chose
   * (V-10): true for a loaded `MM-DD` (the 2000 seed) and for a date picked
   * while Year unknown is on; false for a loaded `YYYY-MM-DD` and for a date
   * picked with Year unknown off. Switching Year unknown on, and an ask that
   * was dismissed, leave it unchanged.
   */
  yearIsPlaceholder: boolean;
}

/** No birthday (Add Contact's start, and the state after Clear). */
export const EMPTY_BIRTHDAY_FIELD_STATE: BirthdayFieldState = {
  input: null,
  yearUnknown: false,
  yearIsPlaceholder: false,
};

/** A host's step result: a new state, or "ask for the year" with a seed. */
export type BirthdayFieldStep =
  | { kind: "state"; state: BirthdayFieldState }
  | {
      /** Open the picker on `seed`; the state is unchanged until it resolves. */
      kind: "ask-year";
      seed: string;
    };

/** Why the picker is open: the date row, or the Year unknown OFF ask. */
export type BirthdayPickerPurpose = "date" | "year";

/** The native picker's outcome, as a local `YYYY-MM-DD` when set. */
export type BirthdayPickerResult =
  | { type: "set"; date: string }
  | { type: "dismissed" };

/** Load a stored birthday (hosts' seed; mirrors `parseBirthdayForForm`). */
export function birthdayFieldStateFromStored(
  stored: string | null,
): BirthdayFieldState {
  const { birthdayInput, birthdayYearUnknown } = parseBirthdayForForm(stored);
  return {
    input: birthdayInput,
    yearUnknown: birthdayYearUnknown,
    yearIsPlaceholder: birthdayYearUnknown,
  };
}

/** The value the state would store (`buildBirthdayForStorage`). */
export function birthdayStorage(state: BirthdayFieldState): string | null {
  return buildBirthdayForStorage(state.input, state.yearUnknown);
}

/**
 * The stored-shape string the trigger displays (`MM-DD` when the year is
 * unknown, else `YYYY-MM-DD`), for `formatStoredBirthdayForDisplay`; null when
 * unset. Display only — never written back.
 */
export function birthdayDisplayValue(state: BirthdayFieldState): string | null {
  return birthdayStorage(state);
}

/** Gregorian leap-year rule: divisible by 4, not by 100 unless by 400. */
function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function pad4(year: number): string {
  return String(year).padStart(4, "0");
}

/**
 * Where the year ask opens (U-08): the most recent occurrence of `monthDay`
 * (`MM-DD`) on or before `todayLocal` (`YYYY-MM-DD`) — this year when the
 * month/day is on or before today, else last year. `02-29` opens on 29
 * February of the most recent leap year whose 29 February is on or before
 * today (T-05), never 1 March. Never after today. Built from string parts.
 */
export function yearAskSeed(monthDay: string, todayLocal: string): string {
  const todayYear = Number(todayLocal.slice(0, 4));
  const todayMonthDay = todayLocal.slice(5, 10);
  // "MM-DD" strings sort chronologically within a year.
  let year = monthDay <= todayMonthDay ? todayYear : todayYear - 1;
  if (monthDay === "02-29") {
    while (!isLeapYear(year)) year -= 1;
  }
  return `${pad4(year)}-${monthDay}`;
}

/**
 * The seed for the Year unknown OFF ask (V-10): the form's own input when its
 * year is a real one (not a placeholder) and it is on or before today, so one
 * tap on OK cannot replace 1990 with this year; otherwise `yearAskSeed` of the
 * input's month/day. Callers only ask when an input is set; with none it
 * falls back to today.
 */
export function yearOffSeed(
  state: BirthdayFieldState,
  todayLocal: string,
): string {
  const input = state.input;
  if (input == null || input.length < 10) return todayLocal;
  const full = input.slice(0, 10);
  if (!state.yearIsPlaceholder && full <= todayLocal) return full;
  return yearAskSeed(full.slice(5), todayLocal);
}

/**
 * Where the date row's picker opens (W-02). With the picker capped at today it
 * must open where every month/day is reachable: Year unknown with no input
 * opens on 2000 plus today's month/day (a leap year, so 29 February is
 * pickable); Year unknown with an input opens on it (already a 2000
 * placeholder, or the kept real date); otherwise the input, or today.
 */
export function dateRowSeed(
  state: BirthdayFieldState,
  todayLocal: string,
): string {
  if (state.input != null && state.input.length >= 10) {
    return state.input.slice(0, 10);
  }
  return state.yearUnknown ? `2000-${todayLocal.slice(5, 10)}` : todayLocal;
}

/**
 * The Year unknown switch. ON keeps the input (storage drops the year). OFF
 * with no birthday just turns it off; OFF with a birthday asks for the year
 * (D-61) and changes nothing until the picker resolves.
 */
export function yearUnknownChanged(
  state: BirthdayFieldState,
  yearUnknown: boolean,
  todayLocal: string,
): BirthdayFieldStep {
  if (yearUnknown) {
    return { kind: "state", state: { ...state, yearUnknown: true } };
  }
  if (!state.yearUnknown) {
    return { kind: "state", state };
  }
  if (state.input == null || state.input.length === 0) {
    return { kind: "state", state: { ...state, yearUnknown: false } };
  }
  return { kind: "ask-year", seed: yearOffSeed(state, todayLocal) };
}

/**
 * The picker resolved. "dismissed" changes nothing (for the year ask, Year
 * unknown stays on — D-61's "cancelling turns Year unknown back on"). "set"
 * from the year ask stores the picked full date with the year known; "set"
 * from the date row keeps the Year unknown flag, and its year is a
 * placeholder exactly when Year unknown is on.
 */
export function pickerResult(
  state: BirthdayFieldState,
  purpose: BirthdayPickerPurpose,
  result: BirthdayPickerResult,
): BirthdayFieldState {
  if (result.type !== "set") return state;
  if (purpose === "year") {
    return { input: result.date, yearUnknown: false, yearIsPlaceholder: false };
  }
  return {
    input: result.date,
    yearUnknown: state.yearUnknown,
    yearIsPlaceholder: state.yearUnknown,
  };
}

/** Clear (D-49): no birthday; storage is null. */
export function clearBirthday(): BirthdayFieldState {
  return { ...EMPTY_BIRTHDAY_FIELD_STATE };
}

/** A local Date at midnight from a `YYYY-MM-DD` string (parts, no UTC). */
export function dateFromLocalDateString(ymd: string): Date {
  return new Date(
    Number(ymd.slice(0, 4)),
    Number(ymd.slice(5, 7)) - 1,
    Number(ymd.slice(8, 10)),
  );
}

/**
 * The birthday picker's maximum date (38.11 D-86: birthday pickers stop at
 * today on Add Contact, Edit Contact and the Profile Birthday sheet): the last
 * millisecond of today's local day, so all of today is pickable and no later
 * day is.
 */
export function birthdayPickerMaxDate(todayLocal: string): Date {
  const today = dateFromLocalDateString(todayLocal);
  return new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59,
    999,
  );
}
