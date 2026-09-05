/** Shared, renderer-independent Dashboard query state and closed SQL fragments. */

export const DASHBOARD_POPULATIONS = [
  "favourites",
  "birthdays",
  "not-contacted",
  "snoozed",
  "all-contacts",
] as const;
export type DashboardPopulation = (typeof DASHBOARD_POPULATIONS)[number];

export const DASHBOARD_FILTER_FAMILIES = [
  "category",
  "social-battery",
  "needs-attention",
  "gravity",
  "contact-frequency",
] as const;
export type DashboardFilterFamily = (typeof DASHBOARD_FILTER_FAMILIES)[number];
export type DashboardFilters = Partial<Record<DashboardFilterFamily, string[]>>;

export const DASHBOARD_SORT_MODES = [
  "default",
  "name-asc",
  "name-desc",
  "least-recent",
  "most-recent",
  "status",
] as const;
export type DashboardSortMode = (typeof DASHBOARD_SORT_MODES)[number];
export type DashboardViewMode = "list" | "card";

export interface DashboardQueryState {
  viewMode: DashboardViewMode;
  populations: DashboardPopulation[];
  filters: DashboardFilters;
  sort: DashboardSortMode;
}

/**
 * The implicit Active universe. This deliberately has only ADR-011's three
 * segregation clauses: snooze suppression belongs to Needs Attention (Plan 03).
 */
export const ACTIVE_SEGREGATION_WHERE = `c.archived_at IS NULL
     AND c.tracking_enabled = 1
     AND c.last_contact IS NOT NULL`;

export function resetDashboardView(
  state: DashboardQueryState,
): DashboardQueryState {
  return {
    viewMode: state.viewMode,
    populations: [],
    filters: {},
    sort: "default",
  };
}

/** Resolve only a persisted Default sentinel; explicit choices always survive. */
export function resolveDefaultSort(
  sort: DashboardSortMode,
  populations: readonly DashboardPopulation[],
): Exclude<DashboardSortMode, "default"> {
  if (sort !== "default") return sort;
  // The tracer owns only Active (empty populations); later populations extend
  // their natural default ordering without changing the stored sentinel.
  void populations;
  return "status";
}

export function parseDashboardPopulations(
  value: unknown,
): DashboardPopulation[] | null {
  if (!Array.isArray(value)) return null;
  if (
    !value.every(
      (item) =>
        typeof item === "string" &&
        DASHBOARD_POPULATIONS.includes(item as DashboardPopulation),
    )
  )
    return null;
  return [...new Set(value as DashboardPopulation[])];
}

export function parseDashboardFilters(value: unknown): DashboardFilters | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return null;
  for (const [family, selections] of Object.entries(value)) {
    if (
      !(DASHBOARD_FILTER_FAMILIES as readonly string[]).includes(family) ||
      !Array.isArray(selections) ||
      !selections.every((item) => typeof item === "string")
    )
      return null;
  }
  return value as DashboardFilters;
}
