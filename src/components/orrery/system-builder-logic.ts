import type { SystemOverrideIntent, SystemRuleDraft } from "@/db/systems-dao";
import {
  CONTACT_FREQUENCY_BANDS,
  SOCIAL_BATTERY_VALUES,
} from "@/logic/dashboard-query-logic";
import {
  FAVORITE_RULE_VALUE,
  NOT_CONTACTED_RULE_VALUE,
  SNOOZED_RULE_VALUE,
} from "@/logic/system-rule-resolver";
import { GRAVITY_TIERS } from "@/services/impact";

export const SYSTEM_RULE_FAMILIES = [
  "category",
  "favorite",
  "needs-attention",
  "gravity",
  "social-battery",
  "contact-frequency",
  "not-contacted",
  "snoozed",
] as const;

export type SystemRuleFamily = (typeof SYSTEM_RULE_FAMILIES)[number];
export type RuleDraft = {
  category: string[];
  favorite: boolean;
  "needs-attention": boolean;
  gravity: string[];
  "social-battery": string[];
  "contact-frequency": string[];
  "not-contacted": boolean;
  snoozed: boolean;
};

export type SystemBuilderDraft = {
  name: string;
  rules: RuleDraft;
  overrideIntent: readonly SystemOverrideIntent[];
};

const FAMILY_LABELS: Record<SystemRuleFamily, string> = {
  category: "Category",
  favorite: "Favorite",
  "needs-attention": "Needs Attention",
  gravity: "Gravity",
  "social-battery": "Social Battery",
  "contact-frequency": "Contact Frequency",
  "not-contacted": "Not Contacted",
  snoozed: "Snoozed",
};

export const RULE_FAMILY_OPTIONS: Record<
  Exclude<SystemRuleFamily, "category">,
  readonly { value: string; label: string }[]
> = {
  favorite: [{ value: FAVORITE_RULE_VALUE, label: "Favorites" }],
  "needs-attention": [{ value: "on", label: "Needs attention" }],
  gravity: GRAVITY_TIERS.map((tier) => ({
    value: tier.name,
    label: tier.name[0].toLocaleUpperCase() + tier.name.slice(1),
  })),
  "social-battery": SOCIAL_BATTERY_VALUES.map((value) => ({
    value,
    label:
      value === "Charger"
        ? "Chargers"
        : value === "Drain"
          ? "Drains"
          : "Neutral",
  })),
  "contact-frequency": Object.keys(CONTACT_FREQUENCY_BANDS).map((value) => ({
    value,
    label: value[0].toLocaleUpperCase() + value.slice(1),
  })),
  "not-contacted": [
    { value: NOT_CONTACTED_RULE_VALUE, label: "Not contacted" },
  ],
  snoozed: [{ value: SNOOZED_RULE_VALUE, label: "Snoozed" }],
};

export function emptyRuleDraft(): RuleDraft {
  return {
    category: [],
    favorite: false,
    "needs-attention": false,
    gravity: [],
    "social-battery": [],
    "contact-frequency": [],
    "not-contacted": false,
    snoozed: false,
  };
}

export function rulesToDraft(rules: readonly SystemRuleDraft[]): RuleDraft {
  const draft = emptyRuleDraft();
  for (const rule of rules) {
    switch (rule.family) {
      case "category":
      case "gravity":
      case "social-battery":
      case "contact-frequency":
        if (!draft[rule.family].includes(rule.value))
          draft[rule.family].push(rule.value);
        break;
      case "favorite":
        draft.favorite = rule.value === FAVORITE_RULE_VALUE;
        break;
      case "needs-attention":
        draft["needs-attention"] = rule.value === "on";
        break;
      case "not-contacted":
        draft["not-contacted"] = rule.value === NOT_CONTACTED_RULE_VALUE;
        break;
      case "snoozed":
        draft.snoozed = rule.value === SNOOZED_RULE_VALUE;
        break;
    }
  }
  return draft;
}

/** The DAO's closed row vocabulary; text input never becomes a SQL token. */
export function draftToRules(draft: RuleDraft): SystemRuleDraft[] {
  return [
    ...draft.category.map((value) => ({ family: "category", value })),
    ...(draft.favorite
      ? [{ family: "favorite", value: FAVORITE_RULE_VALUE }]
      : []),
    ...(draft["needs-attention"]
      ? [{ family: "needs-attention", value: "on" }]
      : []),
    ...draft.gravity.map((value) => ({ family: "gravity", value })),
    ...draft["social-battery"].map((value) => ({
      family: "social-battery",
      value,
    })),
    ...draft["contact-frequency"].map((value) => ({
      family: "contact-frequency",
      value,
    })),
    ...(draft["not-contacted"]
      ? [{ family: "not-contacted", value: NOT_CONTACTED_RULE_VALUE }]
      : []),
    ...(draft.snoozed
      ? [{ family: "snoozed", value: SNOOZED_RULE_VALUE }]
      : []),
  ];
}

export function summarizeFamily(
  family: SystemRuleFamily,
  values: readonly string[],
  labels: Record<string, string>,
): string {
  const label = FAMILY_LABELS[family];
  const selected = values.map((value) => labels[value] ?? value);
  return selected.length ? `${label} · ${selected.join(", ")}` : label;
}

function stable(value: unknown): string {
  return JSON.stringify(value);
}

export function isMeaningfulChange(
  before: SystemBuilderDraft,
  after: SystemBuilderDraft,
): boolean {
  return (
    before.name.trim() !== after.name.trim() ||
    stable(before.rules) !== stable(after.rules) ||
    stable(before.overrideIntent) !== stable(after.overrideIntent)
  );
}
