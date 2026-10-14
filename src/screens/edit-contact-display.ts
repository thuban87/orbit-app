/**
 * Display-only helpers for Edit Contact (38.10 D-135).
 *
 * Kept apart from `edit-contact-logic.ts` on purpose: that module builds the
 * values Edit Contact saves, and the display-date contract (38.9 D-23, C5-H1)
 * forbids it from importing a display formatter. Nothing here is stored.
 *
 * PURE and react-native-free (node-testable).
 */
import type { CurrentStateEntryRow } from "@/db/current-state-history-read";
import { formatDisplayDateOrFallback } from "@/utils/dates";

/** The small card Edit Contact shows above a field's "See all" (D-135). */
export interface MostRecentEntryCard {
  value: string;
  dateLabel: string;
}

/**
 * A field's Most Recent entry as Edit Contact's card (D-135): its value and
 * the date it is about, date only (D-41, D-48) — `entry_date`, else
 * `created_at`'s date part; a value that is not a date shows raw. Null when
 * the field has no entry.
 */
export function mostRecentEntryCard(
  row:
    | Pick<CurrentStateEntryRow, "value" | "entry_date" | "created_at">
    | null
    | undefined,
): MostRecentEntryCard | null {
  if (!row) return null;
  const when = row.entry_date || row.created_at.slice(0, 10);
  return {
    value: row.value,
    dateLabel: formatDisplayDateOrFallback(when, when),
  };
}
