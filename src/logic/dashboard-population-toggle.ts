/**
 * Population panel next-state rules (38.13 D-23, D-58). React-free.
 *
 * - "active" is a panel-only key for the Active Contacts row. The stored
 *   Active state stays `[]`; no "active" token is ever returned or persisted
 *   (D-23; the explicit token was rejected).
 * - All Contacts and Active Contacts are exclusive: picking either clears the
 *   others, and picking any other population deselects All Contacts (D-58).
 *   Deselecting All Contacts returns to Active (phase-05 dossier :239).
 * - Favorites, Birthdays, Never Contacted and Snoozed still combine with each
 *   other (ADR-093 OR-union, untouched).
 */
import type { DashboardPopulation } from "@/logic/dashboard-query-logic";

/** A Population panel row key: a stored population or the Active Contacts row. */
export type PopulationPanelKey = DashboardPopulation | "active";

export function nextPopulations(
  current: readonly DashboardPopulation[],
  tapped: PopulationPanelKey,
): DashboardPopulation[] {
  if (tapped === "active") return [];
  if (tapped === "all-contacts") {
    return current.includes("all-contacts") ? [] : ["all-contacts"];
  }
  // A persisted mixed value (e.g. ["all-contacts","favourites"]) normalises here.
  const others = current.filter((population) => population !== "all-contacts");
  return others.includes(tapped)
    ? others.filter((population) => population !== tapped)
    : [...others, tapped];
}

/** Order-sensitive element equality, used to skip a no-change write (review R1-16). */
export function samePopulations(
  a: readonly DashboardPopulation[],
  b: readonly DashboardPopulation[],
): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
