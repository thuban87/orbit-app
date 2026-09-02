/**
 * Pure display rules for the reusable shell picker. The database read enforces
 * the same deterministic ordering; keeping it here too protects callers that
 * receive rows from another local source and makes ADR-075 testable.
 */
export interface PickerOrderRow {
  id: number;
  name: string;
  favourite_rank: number | null;
  last_contact: string | null;
  snooze_until: string | null;
  archived_at: string | null;
}

export interface PickerRowMarkers {
  snoozed: boolean;
  archived: boolean;
}

/** A blank query means the normal, non-archived picker list. */
export function matchPickerRow(row: PickerOrderRow, term: string): boolean {
  const normalizedTerm = term.trim().toLocaleLowerCase();
  return normalizedTerm.length === 0 || row.name.toLocaleLowerCase().includes(normalizedTerm);
}

/**
 * `snooze_until` is a local YYYY-MM-DD value. The injected local date keeps
 * the rule deterministic in node tests and avoids converting it through UTC.
 */
export function pickerRowMarkers(
  row: PickerOrderRow,
  localToday = new Intl.DateTimeFormat("en-CA").format(new Date()),
): PickerRowMarkers {
  return {
    snoozed: row.snooze_until !== null && row.snooze_until > localToday,
    archived: row.archived_at !== null,
  };
}

/**
 * Favourites are a boolean membership band only. Within each membership band,
 * most recent interaction wins; null recency is last, then name breaks ties.
 */
export function orderPickerRows<TRow extends PickerOrderRow>(rows: TRow[]): TRow[] {
  return [...rows].sort((left, right) => {
    const favouriteDelta = Number(left.favourite_rank === null) - Number(right.favourite_rank === null);
    if (favouriteDelta !== 0) return favouriteDelta;

    const nullRecencyDelta = Number(left.last_contact === null) - Number(right.last_contact === null);
    if (nullRecencyDelta !== 0) return nullRecencyDelta;

    if (left.last_contact !== right.last_contact) {
      return (right.last_contact ?? "").localeCompare(left.last_contact ?? "");
    }

    return left.name.localeCompare(right.name, undefined, { sensitivity: "accent" });
  });
}

/**
 * An archived contact is intentionally hidden in the default list. It may be
 * displayed only after an explicit search term matches its name.
 */
export function filterPicker<TRow extends PickerOrderRow>(rows: TRow[], term: string): TRow[] {
  const hasSearch = term.trim().length > 0;
  return orderPickerRows(
    rows.filter((row) => (!row.archived_at || hasSearch) && matchPickerRow(row, term)),
  );
}
