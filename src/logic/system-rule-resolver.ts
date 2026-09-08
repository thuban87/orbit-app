/** Resolve persisted custom-System rules and manual overrides into contact ids. */
import {
  listSystemOverrides,
  listSystemRules,
  type SystemOverride,
} from "@/db/systems-dao";
import type { ReadOnlyExecutor } from "@/db/transaction";
import {
  filterByGravity,
  type GravityInputsLoader,
} from "@/logic/dashboard-gravity-filter";
import {
  ACTIVE_SEGREGATION_WHERE,
  buildFilterWhere,
  CONTACT_FREQUENCY_BANDS,
  DASHBOARD_POPULATION_SCOPE_WHERE,
  type DashboardFilters,
  FAVOURITES_WHERE,
  NEEDS_ATTENTION_VALUE,
  NOT_CONTACTED_WHERE,
  SNOOZED_WHERE,
  SOCIAL_BATTERY_VALUES,
} from "@/logic/dashboard-query-logic";
import { GRAVITY_TIERS } from "@/services/impact";

export interface BrokenRule {
  ruleUid: string;
  family: string;
  value: string;
  reason: "missing-category" | "invalid-family" | "invalid-value";
}

export interface SystemRule {
  uid: string;
  family: string;
  value: string;
}

export interface ResolvedCustomSystemMembers {
  memberIds: number[];
  /** Rule-derived ids before overrides; intentionally empty for manual-only Systems. */
  candidateIds: number[];
  brokenRules: BrokenRule[];
  /** Dynamic-bucket exclusion cleanup begins in plan 02. */
  prunableExclusionContactIds: number[];
}

/** Closed system-axis values; rule rows never choose SQL syntax. */
export const FAVORITE_RULE_VALUE = "on";
export const NOT_CONTACTED_RULE_VALUE = "on";
export const SNOOZED_RULE_VALUE = "on";
export const SCOPE_POPULATION_FAMILY = "scope";
export const SCOPE_POPULATION_VALUE = "population";

export interface MappedSystemRules {
  filters: DashboardFilters;
  favorite: boolean;
  notContacted: boolean;
  populationScope: boolean;
  snoozed: boolean;
  gravityTiers: string[];
  broken: BrokenRule[];
}

function brokenRule(
  rule: SystemRule,
  reason: BrokenRule["reason"],
): BrokenRule {
  return { ruleUid: rule.uid, family: rule.family, value: rule.value, reason };
}

function addFilter(
  filters: DashboardFilters,
  family: keyof DashboardFilters,
  value: string,
): void {
  const values = filters[family] ?? [];
  values.push(value);
  filters[family] = values;
}

/** Map closed stored tokens into Dashboard inputs without rewriting bad rows. */
export async function mapRulesToFilters(
  exec: ReadOnlyExecutor,
  rules: readonly SystemRule[],
): Promise<MappedSystemRules> {
  const filters: DashboardFilters = {};
  const broken: BrokenRule[] = [];
  const categoryRules = rules.filter((rule) => rule.family === "category");
  const categoryUids = [...new Set(categoryRules.map((rule) => rule.value))];
  const categoryRows = categoryUids.length
    ? await exec.getAllAsync<{ id: number; uid: string }>(
        `SELECT id, uid FROM categories WHERE uid IN (${categoryUids.map(() => "?").join(", ")})`,
        categoryUids,
      )
    : [];
  const categoryIds = new Map(categoryRows.map((row) => [row.uid, row.id]));
  const categories: string[] = [];
  let favorite = false;
  let notContacted = false;
  let populationScope = false;
  let snoozed = false;
  const gravityTiers: string[] = [];
  for (const rule of rules) {
    if (rule.family === "category") {
      const id = categoryIds.get(rule.value);
      if (id === undefined) broken.push(brokenRule(rule, "missing-category"));
      else categories.push(String(id));
    } else if (rule.family === "social-battery") {
      if ((SOCIAL_BATTERY_VALUES as readonly string[]).includes(rule.value))
        addFilter(filters, "social-battery", rule.value);
      else broken.push(brokenRule(rule, "invalid-value"));
    } else if (rule.family === "contact-frequency") {
      if (Object.hasOwn(CONTACT_FREQUENCY_BANDS, rule.value))
        addFilter(filters, "contact-frequency", rule.value);
      else broken.push(brokenRule(rule, "invalid-value"));
    } else if (rule.family === "needs-attention") {
      if (rule.value === NEEDS_ATTENTION_VALUE)
        addFilter(filters, "needs-attention", rule.value);
      else broken.push(brokenRule(rule, "invalid-value"));
    } else if (rule.family === "gravity") {
      if (GRAVITY_TIERS.some((tier) => tier.name === rule.value))
        gravityTiers.push(rule.value);
      else broken.push(brokenRule(rule, "invalid-value"));
    } else if (rule.family === "favorite") {
      if (rule.value === FAVORITE_RULE_VALUE) favorite = true;
      else broken.push(brokenRule(rule, "invalid-value"));
    } else if (rule.family === "not-contacted") {
      if (rule.value === NOT_CONTACTED_RULE_VALUE) notContacted = true;
      else broken.push(brokenRule(rule, "invalid-value"));
    } else if (rule.family === "snoozed") {
      if (rule.value === SNOOZED_RULE_VALUE) snoozed = true;
      else broken.push(brokenRule(rule, "invalid-value"));
    } else if (rule.family === SCOPE_POPULATION_FAMILY) {
      if (rule.value === SCOPE_POPULATION_VALUE) populationScope = true;
      else broken.push(brokenRule(rule, "invalid-value"));
    } else broken.push(brokenRule(rule, "invalid-family"));
  }
  if (categories.length) filters.category = [...new Set(categories)];
  return {
    filters,
    favorite,
    notContacted,
    populationScope,
    snoozed,
    gravityTiers: [...new Set(gravityTiers)],
    broken,
  };
}

/** Query canonical SQL candidates, then narrow derived Gravity in TypeScript. */
export async function resolveCandidateIds(
  exec: ReadOnlyExecutor,
  mapped: MappedSystemRules,
  now: string,
  gravityInputsFor: GravityInputsLoader,
): Promise<number[]> {
  const filter = buildFilterWhere(mapped.filters);
  const clauses = [
    mapped.populationScope || mapped.notContacted
      ? DASHBOARD_POPULATION_SCOPE_WHERE
      : ACTIVE_SEGREGATION_WHERE,
  ];
  const params: unknown[] = [];
  if (filter.sql) {
    clauses.push(`(${filter.sql})`);
    params.push(...filter.params);
  }
  if (mapped.favorite) clauses.push(FAVOURITES_WHERE);
  if (mapped.snoozed) clauses.push(SNOOZED_WHERE);
  if (mapped.notContacted && !mapped.populationScope)
    clauses.push(NOT_CONTACTED_WHERE);
  const rows = await exec.getAllAsync<{ id: number }>(
    `SELECT c.id FROM contacts c WHERE ${clauses.join(" AND ")}
     ORDER BY COALESCE(c.ring_seq,1e9), c.created_at, c.id`,
    params,
  );
  const candidateIds = rows.map((row) => row.id);
  return mapped.gravityTiers.length
    ? filterByGravity(candidateIds, mapped.gravityTiers, gravityInputsFor, now)
    : candidateIds;
}

export function applyMembershipOverrides(input: {
  candidateIds: readonly number[];
  includeIds: readonly number[];
  excludeIds: readonly number[];
  eligibleIncludeIds: readonly number[];
}): Pick<
  ResolvedCustomSystemMembers,
  "memberIds" | "prunableExclusionContactIds"
> {
  const candidates = new Set(input.candidateIds);
  const eligibleIncludes = new Set(input.eligibleIncludeIds);
  const excludes = new Set(input.excludeIds);
  const prunableExclusionContactIds = input.excludeIds.filter(
    (id) => !candidates.has(id),
  );
  const memberIds = [
    ...input.candidateIds,
    ...input.includeIds.filter(
      (id) => !candidates.has(id) && eligibleIncludes.has(id),
    ),
  ].filter((id) => !excludes.has(id));
  return { memberIds: [...new Set(memberIds)], prunableExclusionContactIds };
}

async function eligibleIncludedIds(
  exec: ReadOnlyExecutor,
  includeIds: readonly number[],
): Promise<number[]> {
  const ids = [...new Set(includeIds)];
  if (!ids.length) return [];
  const rows = await exec.getAllAsync<{ id: number }>(
    `SELECT c.id FROM contacts c WHERE c.archived_at IS NULL
     AND c.tracking_enabled = 1 AND c.id IN (${ids.map(() => "?").join(", ")})`,
    ids,
  );
  return rows.map((row) => row.id);
}

/**
 * Read-only engine for persisted and provisional definitions. A stale exclusion
 * is discarded now and physically pruned only at the next definition save.
 */
export async function resolveMembershipFromDefinition(
  exec: ReadOnlyExecutor,
  definition: {
    rules: readonly SystemRule[];
    overrides: readonly SystemOverride[];
    now: string;
  },
  gravityInputsFor: GravityInputsLoader,
): Promise<ResolvedCustomSystemMembers> {
  const mapped = await mapRulesToFilters(exec, definition.rules);
  const candidateIds = definition.rules.length
    ? await resolveCandidateIds(exec, mapped, definition.now, gravityInputsFor)
    : [];
  const includeIds = definition.overrides
    .filter((row) => row.mode === "include")
    .map((row) => row.contactId);
  const excludeIds = definition.overrides
    .filter((row) => row.mode === "exclude")
    .map((row) => row.contactId);
  const applied = applyMembershipOverrides({
    candidateIds,
    includeIds,
    excludeIds,
    eligibleIncludeIds: await eligibleIncludedIds(exec, includeIds),
  });
  return { candidateIds, brokenRules: mapped.broken, ...applied };
}

export async function resolveCustomSystemMembers(
  exec: ReadOnlyExecutor,
  system: { uid: string },
  now: string,
  gravityInputsFor: GravityInputsLoader,
): Promise<ResolvedCustomSystemMembers> {
  const row = await exec.getFirstAsync<{ id: number }>(
    "SELECT id FROM systems WHERE uid = ?",
    [system.uid],
  );
  if (!row) throw new Error("Cannot resolve a missing custom System");
  const [rules, overrides] = await Promise.all([
    listSystemRules(exec, row.id),
    listSystemOverrides(exec, `custom:${system.uid}` as never),
  ]);
  return resolveMembershipFromDefinition(
    exec,
    { rules, overrides, now },
    gravityInputsFor,
  );
}
