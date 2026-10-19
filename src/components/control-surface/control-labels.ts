import {
  AXIS_DEFAULT_LABELS,
  POPULATION_LABELS,
} from "@/constants/dashboard-labels";
import {
  type DashboardFilterFamily,
  type DashboardPopulation,
  type DashboardSortMode,
  type ResolvedDashboardSort,
  resolveDefaultSort,
} from "@/logic/dashboard-query-logic";

/**
 * The single source of dashboard control copy. The population and axis-default
 * labels live in `src/constants/dashboard-labels.ts` so the logic layer can
 * read them (38.13 review A-IN-06); they are re-exported here.
 */
export { AXIS_DEFAULT_LABELS, POPULATION_LABELS };

export const CONTROL_AXIS_LABELS = {
  population: "Population",
  filters: "Filters",
  sort: "Sort",
} as const;

export const FILTER_FAMILY_LABELS: Record<DashboardFilterFamily, string> = {
  category: "Category",
  "social-battery": "Social Battery",
  "needs-attention": "Needs Attention",
  gravity: "Gravity",
  "contact-frequency": "Contact Frequency",
};

const FILTER_OPTION_LABELS: Record<
  Exclude<DashboardFilterFamily, "category">,
  Record<string, string>
> = {
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

/**
 * What a Default sort resolves to, shown in brackets after "Default" (D-35).
 * The wording for the population-specific orders is this plan's choice; it
 * mirrors dashboard-read.ts POPULATION_SORT (created_at ASC, snooze_until ASC,
 * soonest birthday). Status stays a separate sort option (D-19).
 */
export const RESOLVED_DEFAULT_SORT_LABELS: Record<
  ResolvedDashboardSort,
  string
> = {
  status: SORT_MODE_LABELS.status,
  "name-asc": SORT_MODE_LABELS["name-asc"],
  "name-desc": SORT_MODE_LABELS["name-desc"],
  "least-recent": SORT_MODE_LABELS["least-recent"],
  "most-recent": SORT_MODE_LABELS["most-recent"],
  "natural-not-contacted": "Oldest added",
  "natural-snooze": "Snooze ends soonest",
  "soonest-birthday": "Soonest birthday",
};

/** "Default (X)", where X is what Default resolves to for `populations` (D-35). */
export function defaultSortLabel(
  populations: readonly DashboardPopulation[],
): string {
  const resolved = resolveDefaultSort("default", populations);
  return `${AXIS_DEFAULT_LABELS.sort} (${RESOLVED_DEFAULT_SORT_LABELS[resolved]})`;
}

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
