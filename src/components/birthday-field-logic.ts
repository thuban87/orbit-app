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
