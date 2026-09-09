import type { ContactMethodRow } from "@/db/contact-methods-dao";
import type {
  ProfileGravityMetric,
  ProfileIntensityMetric,
  ProfileStatusMetric,
} from "@/services/profile-metrics";
import { FREQUENCY_DAYS } from "@/types";
import { formatLocalDate } from "@/utils/dates";

export type RelationshipExplanation = {
  title: string;
  summary: string;
  details: string[];
  routes?: Array<"history" | "insights">;
};

export type RelationshipExplanationInput =
  | {
      kind: "status";
      metric: ProfileStatusMetric;
      insightsAvailable: boolean;
    }
  | { kind: "gravity"; metric: ProfileGravityMetric }
  | { kind: "intensity"; metric: ProfileIntensityMetric };

export function relationshipExplanation(
  input: RelationshipExplanationInput,
): RelationshipExplanation {
  if (input.kind === "status") {
    if (!input.metric.available) {
      return {
        title: "Orbit Status",
        summary: input.metric.label,
        details: [input.metric.context],
        routes: ["history"],
      };
    }
    const details = [
      `Last interaction: ${input.metric.factors.lastContact}`,
      `Contact frequency: every ${input.metric.factors.intervalDays} days`,
      `Elapsed progress: ${Math.round(input.metric.factors.progress * 100)}%`,
    ];
    if (input.metric.factors.rarelyResponds) {
      details.push(
        "Rarely Responds: only connected interactions reset the orbit",
      );
    }
    return {
      title: "Orbit Status",
      summary: input.metric.label,
      details,
      routes: input.insightsAvailable ? ["history", "insights"] : ["history"],
    };
  }
  if (input.kind === "gravity") {
    return input.metric.available
      ? {
          title: "Gravity",
          summary: input.metric.label,
          details: [
            `${input.metric.factors.interactionCount} interactions`,
            "Weighted by recency",
            `Tier ${input.metric.factors.tierIndex + 1} of ${input.metric.factors.tierCount}`,
          ],
        }
      : {
          title: "Gravity",
          summary: input.metric.label,
          details: [input.metric.context],
        };
  }
  return {
    title: "Intensity",
    summary: input.metric.label,
    details: [
      input.metric.window.label,
      `${input.metric.currentCount} qualifying ${input.metric.currentCount === 1 ? "interaction" : "interactions"}`,
      input.metric.context,
    ],
  };
}

export const FREQUENCY_CHOICES = Object.entries(FREQUENCY_DAYS).map(
  ([label, days]) => ({
    label,
    days,
    accessibilityLabel: `${label}, every ${days} ${days === 1 ? "day" : "days"}`,
  }),
);

export const SNOOZE_CHOICES = [
  {
    kind: "preset" as const,
    preset: "3d" as const,
    label: "3 days",
    accessibilityLabel: "Snooze for 3 days",
  },
  {
    kind: "preset" as const,
    preset: "1w" as const,
    label: "1 week",
    accessibilityLabel: "Snooze for 1 week",
  },
  {
    kind: "preset" as const,
    preset: "1m" as const,
    label: "1 month",
    accessibilityLabel: "Snooze for 1 month",
  },
  {
    kind: "custom" as const,
    label: "Choose date",
    accessibilityLabel: "Choose a custom snooze date",
  },
] as const;

export function validateCustomSnoozeDate(
  value: string,
  todayLocal: string,
): { valid: true } | { valid: false; error: "Choose a future date." } {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
    );
    if (formatLocalDate(date) === value && value > todayLocal) {
      return { valid: true };
    }
  }
  return { valid: false, error: "Choose a future date." };
}

export interface RelationshipSheetState<T> {
  committed: T;
  draft: T;
  pending: boolean;
  error: string | null;
}

export type RelationshipSheetAction<T> =
  | { type: "submit"; value: T }
  | { type: "success" }
  | { type: "failure" }
  | { type: "retry" }
  | { type: "dismiss" };

export function relationshipSheetReducer<T>(
  state: RelationshipSheetState<T>,
  action: RelationshipSheetAction<T>,
): RelationshipSheetState<T> {
  if (action.type === "submit") {
    return { ...state, draft: action.value, pending: true, error: null };
  }
  if (action.type === "success") {
    return {
      committed: state.draft,
      draft: state.draft,
      pending: false,
      error: null,
    };
  }
  if (action.type === "failure") {
    return {
      ...state,
      pending: false,
      error: "Couldn't save your changes. Nothing was applied. Try again.",
    };
  }
  if (action.type === "retry") {
    return { ...state, pending: true, error: null };
  }
  return {
    committed: state.committed,
    draft: state.committed,
    pending: false,
    error: null,
  };
}

export function profileHeroActionState(methods: {
  phone: ContactMethodRow | null;
  email: ContactMethodRow | null;
}) {
  const phone = methods.phone?.is_actionable === 1;
  const email = methods.email?.is_actionable === 1;
  return {
    message:
      phone || email
        ? { enabled: true as const, route: "compose" as const, reason: null }
        : {
            enabled: false as const,
            route: null,
            reason: "Add a phone number or email to message this contact.",
          },
    call: phone
      ? { enabled: true as const, route: "call" as const, reason: null }
      : {
          enabled: false as const,
          route: null,
          reason: "Add a phone number to call this contact.",
        },
  };
}
