import type {
  DashboardFilterFamily,
  DashboardPopulation,
  DashboardSortMode,
} from "@/logic/dashboard-query-logic";

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

export const FILTER_FAMILY_LABELS: Record<DashboardFilterFamily, string> = {
  category: "Category",
  "social-battery": "Social Battery",
  "needs-attention": "Needs Attention",
  gravity: "Gravity",
  "contact-frequency": "Contact Frequency",
};

const FILTER_OPTION_LABELS: Record<Exclude<DashboardFilterFamily, "category">, Record<string, string>> = {
  "social-battery": {
    Charger: "Charger",
    Neutral: "Neutral",
    Drain: "Drain",
  },
  "needs-attention": {
    on: "Needs attention",
  },
  gravity: {
    thin: "Thin",
    building: "Building",
    solid: "Solid",
    deep: "Deep",
  },
  "contact-frequency": {
    weekly: "Weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
    yearly: "Yearly",
  },
};

export const SORT_MODE_LABELS: Record<DashboardSortMode, string> = {
  default: AXIS_DEFAULT_LABELS.sort,
  "name-asc": "Name A–Z",
  "name-desc": "Name Z–A",
  "least-recent": "Least recent",
  "most-recent": "Most recent",
  status: "Status",
};

export const CONTROL_ACTION_LABELS = {
  clearFilters: "Clear filters",
  selected: "Selected",
} as const;

export function populationLabel(key: DashboardPopulation): string {
  return POPULATION_LABELS[key];
}

export function filterFamilyLabel(family: DashboardFilterFamily): string {
  return FILTER_FAMILY_LABELS[family];
}

export function filterOptionLabel(
  family: Exclude<DashboardFilterFamily, "category">,
  value: string,
): string | undefined {
  return FILTER_OPTION_LABELS[family][value];
}

export function sortModeLabel(mode: DashboardSortMode): string {
  return SORT_MODE_LABELS[mode];
}
