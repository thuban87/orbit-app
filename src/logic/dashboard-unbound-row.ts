/**
 * Unbound rows on the Contacts list (38.13 D-59, ADR-233).
 *
 * An Unbound person reaches the Contacts list in two ways: an All Contacts
 * search (38.13-03 widens that one scope) and the Never Contacted population's
 * opt-in (`NOT_CONTACTED_INCLUSIVE_WHERE`, ADR-062). Both rows get the same
 * presentation and the same row-action rules, so the test keys only on the
 * row's stored lifecycle flag, never on search mode (review R1-14).
 *
 * ADR-233: an Unbound star is drawn off and dimmed and a tap explains why
 * (`unboundStarExplanation`); it writes nothing. A row the host cannot find is
 * "ignore": no write and no notice (unknown never toggles; review R2-04).
 *
 * Pure: no React, no react-native.
 */
import type { DashboardRow } from "@/db/dashboard-read";

/**
 * An Unbound person's Contacts star is drawn off and dimmed (ADR-233, 38.12
 * D-36), at the Profile's unavailable opacity (`ContactProfileScreen`
 * UNAVAILABLE_OPACITY).
 */
export const UNBOUND_STAR_OPACITY = 0.5;

/** True when the row's person is Unbound (`tracking_enabled = 0`). */
export function isUnboundRow(
  row: Pick<DashboardRow, "trackingEnabled">,
): boolean {
  return row.trackingEnabled === 0;
}

/** What a Contacts favourite tap does for a row (or for no row at all). */
export type FavouriteTapOutcome = "toggle" | "explain" | "ignore";

export function favouriteTapOutcome(
  row: Pick<DashboardRow, "trackingEnabled"> | undefined,
): FavouriteTapOutcome {
  if (row === undefined) return "ignore";
  if (isUnboundRow(row)) return "explain";
  return row.trackingEnabled === 1 ? "toggle" : "ignore";
}
