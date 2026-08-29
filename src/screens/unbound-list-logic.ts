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

/** Only direct retrieval rows outside the active lifecycle use neutral list chrome. */
export function usesNeutralUnboundRow(trackingEnabled: number): boolean {
  return trackingEnabled === 0;
}
