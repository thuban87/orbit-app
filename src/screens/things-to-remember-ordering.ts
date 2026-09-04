/** Keep DAO ordering intact when presentation visibility is toggled. */
export function rowsForKnowledgeDisplay<T>(
  rows: readonly T[],
  includeHidden: boolean,
  isHidden: (row: T) => boolean,
): T[] {
  return includeHidden ? [...rows] : rows.filter((row) => !isHidden(row));
}
