/** Shared, renderer-independent Dashboard query state and closed SQL fragments. */

import { PROGRESS_SQL, STABLE_MAX } from "@/db/status";

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

/**
 * Inclusive upper bounds for the product cadence buckets. Keep the tuning
 * surface here: changing a bucket boundary is a single-number edit. Each
 * following bucket starts on the prior upper bound plus one day.
 */
export const CONTACT_FREQUENCY_BANDS = {
  weekly: 7,
  monthly: 31,
  quarterly: 91,
  yearly: null,
} as const;

type ContactFrequencyBucket = keyof typeof CONTACT_FREQUENCY_BANDS;

export const SOCIAL_BATTERY_VALUES = ["Charger", "Neutral", "Drain"] as const;
export const NEEDS_ATTENTION_VALUE = "on";

function isContactFrequencyBucket(value: string): value is ContactFrequencyBucket {
  return Object.prototype.hasOwnProperty.call(CONTACT_FREQUENCY_BANDS, value);
}

function frequencyPredicate(bucket: ContactFrequencyBucket): {
  sql: string;
  params: number[];
} {
  const entries = Object.entries(CONTACT_FREQUENCY_BANDS) as [
    ContactFrequencyBucket,
    number | null,
  ][];
  const index = entries.findIndex(([name]) => name === bucket);
  const previousUpper = index === 0 ? 0 : entries[index - 1][1];
  const upper = entries[index][1];

  if (upper === null) {
    return { sql: "c.interval_days > ?", params: [previousUpper as number] };
  }
  if (previousUpper === 0) {
    return { sql: "c.interval_days <= ?", params: [upper] };
  }
  return {
    sql: "c.interval_days > ? AND c.interval_days <= ?",
    params: [previousUpper as number, upper],
  };
}

/**
 * Build the SQL-expressible Dashboard filters. Values within a family OR
 * together; populated families AND together. Runtime tokens only choose from
 * closed constants and every runtime value stays ?-bound. Gravity deliberately
 * contributes no SQL because it is a reversible post-query TypeScript pass.
 */
export function buildFilterWhere(filters: DashboardFilters | Record<string, unknown>): PopulationWhere {
  const groups: string[] = [];
  const params: unknown[] = [];
  const selections = (family: DashboardFilterFamily): string[] => {
    const value = filters[family];
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  };

  const categoryIds = [...new Set(selections("category")
    .filter((value) => /^\d+$/.test(value))
    .map(Number)
    .filter((value) => Number.isSafeInteger(value) && value > 0))];
  if (categoryIds.length > 0) {
    groups.push(`c.category_id IN (${categoryIds.map(() => "?").join(", ")})`);
    params.push(...categoryIds);
  }

  const batteries = [...new Set(selections("social-battery").filter(
    (value): value is (typeof SOCIAL_BATTERY_VALUES)[number] =>
      (SOCIAL_BATTERY_VALUES as readonly string[]).includes(value),
  ))];
  if (batteries.length > 0) {
    groups.push(`c.social_battery IN (${batteries.map(() => "?").join(", ")})`);
    params.push(...batteries);
  }

  const frequencyGroups = [...new Set(selections("contact-frequency").filter(isContactFrequencyBucket))]
    .map(frequencyPredicate);
  if (frequencyGroups.length > 0) {
    groups.push(`(${frequencyGroups.map((group) => `(${group.sql})`).join(" OR ")})`);
    params.push(...frequencyGroups.flatMap((group) => group.params));
  }

  if (selections("needs-attention").includes(NEEDS_ATTENTION_VALUE)) {
    groups.push(`(${PROGRESS_SQL}) >= ${STABLE_MAX}
     AND (c.snooze_until IS NULL OR date(c.snooze_until) <= date('now','localtime'))`);
  }

  // The gravity family is intentionally recognized but handled after the SQL
  // candidate read; do not turn this derived value into a WHERE clause.
  return { sql: groups.map((group) => `(${group})`).join(" AND "), params };
}

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

export const NOT_CONTACTED_WHERE = "c.last_contact IS NULL";
export const FAVOURITES_WHERE = "c.favourite_rank IS NOT NULL";
export const SNOOZED_WHERE = `c.snooze_until IS NOT NULL
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
