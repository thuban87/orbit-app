/**
 * Selection keeps its entry-time order (38.14 D-41). PURE.
 *
 * While selecting, Card view shows the frozen universe (ADR-102 / ADR-254),
 * captured at entry in on-screen order (`selectionUniverseIds` keeps the rows'
 * order; the store dedupes without reordering). A refresh can reorder the live
 * rows (a log moves someone's recency); ordering by the frozen ids keeps the
 * cards where they were when selection began.
 */
export function orderRowsByFrozenUniverse<T extends { id: number }>(
  rows: readonly T[],
  frozenUniverse: readonly number[],
): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered: T[] = [];
  for (const id of frozenUniverse) {
    const row = byId.get(id);
    if (row !== undefined) ordered.push(row);
  }
  return ordered;
}
