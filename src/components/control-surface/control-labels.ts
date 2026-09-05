import type { DashboardPopulation } from "@/logic/dashboard-query-logic";

/** The single source of dashboard control copy. */
export const POPULATION_LABELS: Record<DashboardPopulation, string> = {
  "all-contacts": "All Contacts",
  favourites: "Favourites",
  birthdays: "Birthdays",
  "not-contacted": "Not Contacted",
  snoozed: "Snoozed",
};

export const AXIS_DEFAULT_LABELS = {
  population: "Active Contacts",
  filters: "Filters",
  sort: "Default",
} as const;

export function populationLabel(key: DashboardPopulation): string {
  return POPULATION_LABELS[key];
}
