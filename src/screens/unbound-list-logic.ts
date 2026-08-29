/** Pure presentation helpers shared by the neutral Unbound population surface. */
export function unboundCountLabel(count: number): string {
  return `${count} unbound contact${count === 1 ? "" : "s"}`;
}

/** A complete spoken label for a row whose visual treatment intentionally stays neutral. */
export function unboundRowAccessibilityLabel(
  name: string,
  categoryLabel: string | null,
): string {
  return [name, categoryLabel, "Unbound"].filter(Boolean).join(", ");
}
