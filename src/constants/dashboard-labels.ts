/**
 * Dashboard (Contacts) population and axis-default labels. Pure data, so the
 * React-free logic layer can read them (38.13 review A-IN-06: before this,
 * `src/logic/dashboard-empty-copy.ts` imported them from the components
 * layer). `src/components/control-surface/control-labels.ts` re-exports them
 * and stays the single source of the rest of the control copy.
 */
import { FAVORITES, NEVER_CONTACTED } from "@/constants/glossary";
import type { DashboardPopulation } from "@/logic/dashboard-query-logic";

export const POPULATION_LABELS: Record<DashboardPopulation, string> = {
  "all-contacts": "All Contacts",
  favourites: FAVORITES,
  birthdays: "Birthdays",
  "not-contacted": NEVER_CONTACTED,
  snoozed: "Snoozed",
};

export const AXIS_DEFAULT_LABELS = {
  population: "Active Contacts",
  // D-36: the Filters chip summary reads a plain word when nothing is set.
  filters: "None",
  sort: "Default",
} as const;
