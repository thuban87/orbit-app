/** Pure presentation helpers shared by the neutral Unbound population surface. */
import type { UnboundRow } from "@/db/unbound-read";
import { formatDisplayDateOrFallback } from "@/utils/dates";

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
  subtitle?: string,
): string {
  return [name, categoryLabel, "Unbound", subtitle].filter(Boolean).join(", ");
}

/**
 * The Unbound row's second line (38.12 D-39; wording is Claude's Discretion
 * per CONTEXT, seen by the owner at the device check): when they were last
 * contacted, through the one date-only display formatter (38.9 D-23, D-48).
 * Every row on this list is Unbound, so the old "Unbound" line said nothing.
 */
export function unboundRowSubtitle(
  lastContact: string | null,
  now?: Date,
): string {
  if (lastContact === null) return "No contact logged";
  const date = formatDisplayDateOrFallback(lastContact, "", { now });
  return date === "" ? "No contact logged" : `Last contact ${date}`;
}

/** Only direct retrieval rows outside the active lifecycle use neutral list chrome. */
export function usesNeutralUnboundRow(trackingEnabled: number): boolean {
  return trackingEnabled === 0;
}
