import type { ContactPickerRow } from "./contact-picker-source";

export function toggleSelection(
  selected: ReadonlySet<string>,
  lookupKey: string,
): Set<string> {
  const next = new Set(selected);
  if (next.has(lookupKey)) next.delete(lookupKey);
  else next.add(lookupKey);
  return next;
}

export function selectionCount(selected: ReadonlySet<string>): number {
  return selected.size;
}

export function matchesQuery(row: ContactPickerRow, term: string): boolean {
  const query = term.trim().toLocaleLowerCase();
  if (query === "") return true;
  return (
    row.displayName.toLocaleLowerCase().includes(query) ||
    row.searchMethods.some((method) =>
      method.toLocaleLowerCase().includes(query),
    )
  );
}

export function filterRows(
  rows: readonly ContactPickerRow[],
  term: string,
): ContactPickerRow[] {
  return rows.filter((row) => matchesQuery(row, term));
}
