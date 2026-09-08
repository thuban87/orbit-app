/** Resolve persisted custom-System rules and manual overrides into contact ids. */
import { listSystemOverrides } from "@/db/systems-dao";
import type { ReadOnlyExecutor } from "@/db/transaction";
import {
  ACTIVE_SEGREGATION_WHERE,
  CONTACT_FREQUENCY_BANDS,
  type DashboardFilters,
  NEEDS_ATTENTION_VALUE,
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

/**
 * The initial manual-only resolver. Rule evaluation, gravity and exclusion
 * pruning deliberately extend this stable return shape in the next plan.
 */
export async function resolveCustomSystemMembers(
  exec: ReadOnlyExecutor,
  system: { uid: string },
): Promise<ResolvedCustomSystemMembers> {
  const overrides = await listSystemOverrides(
    exec,
    `custom:${system.uid}` as never,
  );
  const inclusions = overrides
    .filter((row) => row.mode === "include")
    .map((row) => row.contactId);
  const exclusions = new Set(
    overrides
      .filter((row) => row.mode === "exclude")
      .map((row) => row.contactId),
  );
  if (inclusions.length === 0) {
    return {
      memberIds: [],
      candidateIds: [],
      brokenRules: [],
      prunableExclusionContactIds: [],
    };
  }
  const ids = [...new Set(inclusions)];
  const eligible = await exec.getAllAsync<{ id: number }>(
    `SELECT c.id FROM contacts c
      WHERE ${ACTIVE_SEGREGATION_WHERE} AND c.id IN (${ids.map(() => "?").join(", ")})`,
    ids,
  );
  return {
    memberIds: eligible
      .map((row) => row.id)
      .filter((id) => !exclusions.has(id)),
    candidateIds: [],
    brokenRules: [],
    prunableExclusionContactIds: [],
  };
}
