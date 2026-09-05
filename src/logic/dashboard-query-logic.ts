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
/** Internal sort outcomes selected when the persisted sort is Default. */
export type ResolvedDashboardSort =
  | Exclude<DashboardSortMode, "default">
  | "natural-not-contacted"
  | "natural-snooze"
  | "soonest-birthday";
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

/** Scope that every explicit population must retain at the SQL boundary. */
export const DASHBOARD_POPULATION_SCOPE_WHERE = `c.archived_at IS NULL
     AND c.tracking_enabled = 1`;

const NOT_CONTACTED_WHERE = "c.last_contact IS NULL";
const FAVOURITES_WHERE = "c.favourite_rank IS NOT NULL";
const SNOOZED_WHERE = `c.snooze_until IS NOT NULL
     AND date(c.snooze_until) > date('now','localtime')`;

export interface PopulationWhereOptions {
  /** IDs computed by the read layer via the shared birthday parser. */
  birthdayIds?: readonly number[];
}

export interface PopulationWhere {
  sql: string;
  params: unknown[];
}

function isDashboardPopulation(value: unknown): value is DashboardPopulation {
  return (
    typeof value === "string" &&
    (DASHBOARD_POPULATIONS as readonly string[]).includes(value)
  );
}

/**
 * Build one safe, dedupe-friendly population WHERE. Runtime tokens select only
 * closed SQL constants; identifiers and values are never interpolated.
 */
export function buildPopulationWhere(
  populations: readonly DashboardPopulation[] | readonly unknown[],
  opts: PopulationWhereOptions = {},
): PopulationWhere {
  const selected = [...new Set(populations.filter(isDashboardPopulation))];
  if (selected.length === 0) {
    return { sql: ACTIVE_SEGREGATION_WHERE, params: [] };
  }

  const params: unknown[] = [];
  const predicates = selected.map((population) => {
    switch (population) {
      case "favourites":
        return FAVOURITES_WHERE;
      case "birthdays": {
        const birthdayIds = opts.birthdayIds ?? [];
        if (birthdayIds.length === 0) return "0";
        params.push(...birthdayIds);
        return `c.id IN (${birthdayIds.map(() => "?").join(", ")})`;
      }
      case "not-contacted":
        return NOT_CONTACTED_WHERE;
      case "snoozed":
        return SNOOZED_WHERE;
      case "all-contacts":
        return `(${ACTIVE_SEGREGATION_WHERE}) OR (${NOT_CONTACTED_WHERE})`;
    }
  });

  return {
    sql: `${DASHBOARD_POPULATION_SCOPE_WHERE}\n     AND (${predicates.map((predicate) => `(${predicate})`).join(" OR ")})`,
    params,
  };
}

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
): ResolvedDashboardSort {
  if (sort !== "default") return sort;
  const selected = [...new Set(populations.filter(isDashboardPopulation))];
  if (selected.length !== 1) return "status";
  switch (selected[0]) {
    case "not-contacted":
      return "natural-not-contacted";
    case "snoozed":
      return "natural-snooze";
    case "birthdays":
      return "soonest-birthday";
    case "favourites":
    case "all-contacts":
      return "status";
  }
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
