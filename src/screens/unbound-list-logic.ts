/** Pure presentation helpers shared by the neutral Unbound population surface. */
import type { UnboundRow } from "@/db/unbound-read";

export function unboundCountLabel(
  count: number,
  opts?: { matching?: boolean },
): string {
  if (opts?.matching) return `${count} matching`;

  return `${count} unbound contact${count === 1 ? "" : "s"}`;
}

/** Filter already-loaded Unbound rows by a name substring without changing their order. */
export function filterUnboundByName(
  rows: UnboundRow[],
  term: string,
): UnboundRow[] {
  const normalizedTerm = term.trim().toLowerCase();
  if (normalizedTerm === "") return rows;

  return rows.filter((row) => row.name.toLowerCase().includes(normalizedTerm));
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
