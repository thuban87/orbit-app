/** Pure selection and exclusion helpers shared by ContactPicker's multi-select mode. */
export function toggleSelection(
  selected: ReadonlySet<number>,
  contactId: number,
): Set<number> {
  const next = new Set(selected);
  if (next.has(contactId)) {
    next.delete(contactId);
  } else {
    next.add(contactId);
  }
  return next;
}

export function selectionCount(selected: ReadonlySet<number>): number {
  return selected.size;
}

export function clearSelection(_selected?: ReadonlySet<number>): Set<number> {
  return new Set();
}

/** Set iteration preserves insertion order, making the confirmation payload deterministic. */
export function orderedSelection(selected: ReadonlySet<number>): number[] {
  return [...selected];
}

export interface PickerExclusions {
  excludeContactId?: number;
  excludeContactIds?: readonly number[];
}

/** Removes relationship-owner and already-present group-member ids before search filtering. */
export function applyPickerExclusions<TRow extends { id: number }>(
  rows: TRow[],
  { excludeContactId, excludeContactIds }: PickerExclusions,
): TRow[] {
  if (
    excludeContactId === undefined &&
    (!excludeContactIds || excludeContactIds.length === 0)
  ) {
    return rows;
  }

  const excluded = new Set(excludeContactIds);
  if (excludeContactId !== undefined) excluded.add(excludeContactId);
  return rows.filter((row) => !excluded.has(row.id));
}
