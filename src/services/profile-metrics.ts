/**
 * Node-pure Relationship Overview metric models.
 *
 * Status, Gravity, and Intensity remain derived, read-only projections of their
 * canonical domain inputs. This module adds presentation labels and explanation
 * factors only; it does not introduce a stored score or an editable Health path.
 * ADR-062: cadence is nullable and lifecycle-independent, so every cadence read
 * is guarded before arithmetic. Unbound activity uses one shared local
 * calendar-month contract that Phase 32 can consume directly.
 */

import type { ProfileStatus, RogueReason } from "@/db/contact-status-read";
import type { ImpactInputs } from "@/db/impact-read";
import type { GravityResult } from "@/services/gravity-logic";
import {
  computeContactGravity,
  computeContactIntensity,
} from "@/services/impact";
import {
  calendarDaysBetween,
  formatLocalDate,
  parseLocalMs,
} from "@/utils/dates";

export type ProfileIntensityWindow =
  | { readonly kind: "cadence"; readonly days: number; readonly label: string }
  | {
      readonly kind: "calendar-month";
      readonly start: string;
      readonly endExclusive: string;
      readonly label: "This month";
    };

export interface ProfileStatusInput {
  readonly trackingEnabled: number;
  readonly intervalDays: number | null;
  readonly status: ProfileStatus | null;
  readonly progress: number | null;
  readonly lastContact: string | null;
  readonly rarelyResponds: number;
  readonly rogueReason: RogueReason;
}

export type ProfileStatusMetric =
  | {
      readonly available: false;
      readonly label: "Not tracked";
      readonly context: "Set a contact frequency to see Orbit Status.";
    }
  | {
      readonly available: true;
      readonly label: "Stable" | "Wobbly" | "Decaying" | "Rogue";
      readonly visualValue: number;
      readonly context: string;
      readonly factors: {
        readonly lastContact: string;
        readonly intervalDays: number;
        readonly progress: number;
        readonly rarelyResponds: boolean;
        readonly rogueReason: RogueReason;
      };
    };

export type ProfileGravityMetric =
  | {
      readonly available: false;
      readonly label: "Not available yet";
      readonly context: "Gravity is derived from interaction history.";
    }
  | {
      readonly available: true;
      readonly label: string;
      readonly visualValue: number;
      readonly context: string;
      readonly factors: {
        readonly interactionCount: number;
        readonly tierIndex: number;
        readonly tierCount: number;
      };
    };

export interface ProfileIntensityMetric {
  readonly available: true;
  readonly label: "No activity" | "Some activity" | "At pace" | "Active";
  readonly context: string;
  readonly visualValue: number;
  readonly window: ProfileIntensityWindow;
  readonly cadenceRelative: boolean;
  readonly currentCount: number;
  readonly intendedPerPeriod: number | null;
  readonly multiple: number | null;
  readonly trailingAvgGapDays: number | null;
}

type AvailableProfileStatusMetric = Extract<
  ProfileStatusMetric,
  { available: true }
>;

const STATUS_LABEL: Record<
  ProfileStatus,
  AvailableProfileStatusMetric["label"]
> = {
  stable: "Stable",
  wobble: "Wobbly",
  decay: "Decaying",
  rogue: "Rogue",
};

function parseLocalDateOnly(stored: string): Date {
  const match = stored.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`profile-metrics: invalid local date "${stored}"`);
  }
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  if (formatLocalDate(date) !== stored) {
    throw new Error(`profile-metrics: invalid local date "${stored}"`);
  }
  return date;
}

/** Shared Phase 31/32 cadence-or-current-month resolver. */
export function resolveProfileIntensityWindow(
  trackingEnabled: number,
  intervalDays: number | null,
  todayLocal: string,
): ProfileIntensityWindow {
  if (trackingEnabled === 1 && intervalDays !== null && intervalDays > 0) {
    return {
      kind: "cadence",
      days: intervalDays,
      label: `${intervalDays} ${intervalDays === 1 ? "day" : "days"}`,
    };
  }

  const today = parseLocalDateOnly(todayLocal);
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const endExclusive = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return {
    kind: "calendar-month",
    start: formatLocalDate(start),
    endExclusive: formatLocalDate(endExclusive),
    label: "This month",
  };
}

/** Present canonical query-time Status without adding inputs or editability. */
export function resolveProfileStatus(
  input: ProfileStatusInput,
): ProfileStatusMetric {
  if (
    input.trackingEnabled !== 1 ||
    input.intervalDays === null ||
    input.intervalDays <= 0 ||
    input.status === null ||
    input.progress === null ||
    input.lastContact === null
  ) {
    return {
      available: false,
      label: "Not tracked",
      context: "Set a contact frequency to see Orbit Status.",
    };
  }

  const elapsedDays = Math.round(input.progress * input.intervalDays);
  return {
    available: true,
    label: STATUS_LABEL[input.status],
    visualValue: input.progress,
    context: `${elapsedDays} of ${input.intervalDays} days since the last interaction.`,
    factors: {
      lastContact: input.lastContact,
      intervalDays: input.intervalDays,
      progress: input.progress,
      rarelyResponds: input.rarelyResponds === 1,
      rogueReason: input.rogueReason,
    },
  };
}

/** Present canonical derived Gravity as a named tier plus bounded-render input. */
export function resolveProfileGravity(
  gravity: GravityResult | null,
  interactionCount: number,
): ProfileGravityMetric {
  if (gravity === null || interactionCount === 0) {
    return {
      available: false,
      label: "Not available yet",
      context: "Gravity is derived from interaction history.",
    };
  }
  return {
    available: true,
    label: `${gravity.tierName.charAt(0).toUpperCase()}${gravity.tierName.slice(1)}`,
    visualValue: gravity.raw,
    context: `Derived from ${interactionCount} ${interactionCount === 1 ? "interaction" : "interactions"}, weighted by recency.`,
    factors: {
      interactionCount,
      tierIndex: gravity.tierIndex,
      tierCount: gravity.tierCount,
    },
  };
}

function qualifiesForIntensity(
  input: ImpactInputs,
  occurredAt: string,
  connected: number,
  direction: string | null,
  nowMs: number,
): boolean {
  if (direction !== "outbound" && direction !== "mutual") return false;
  if (input.rarelyResponds === 1 && connected !== 1) return false;
  return parseLocalMs(occurredAt) <= nowMs;
}

function trailingAverageGapDays(timestamps: string[]): number | null {
  if (timestamps.length < 2) return null;
  const times = timestamps.map(parseLocalMs).sort((a, b) => a - b);
  let total = 0;
  for (let index = 1; index < times.length; index += 1) {
    total += calendarDaysBetween(times[index - 1], times[index]);
  }
  return total / (times.length - 1);
}

function intensityLabel(
  currentCount: number,
  cadenceRelative: boolean,
  multiple: number | null,
): ProfileIntensityMetric["label"] {
  if (currentCount === 0) return "No activity";
  if (!cadenceRelative) return currentCount === 1 ? "Some activity" : "Active";
  return (multiple ?? 0) < 1
    ? "Some activity"
    : (multiple ?? 0) === 1
      ? "At pace"
      : "Active";
}

/**
 * Resolve the Overview Intensity model. Bound contacts delegate unchanged to
 * the canonical cadence-relative computation. Unbound/null-cadence contacts
 * count the same qualifying interaction scope inside exact current-month local
 * boundaries and deliberately expose no intended rate or multiple.
 */
export function resolveProfileIntensity(
  input: ImpactInputs,
  now: string,
): ProfileIntensityMetric {
  const todayLocal = formatLocalDate(new Date(parseLocalMs(now)));
  const window = resolveProfileIntensityWindow(
    input.trackingEnabled,
    input.intervalDays,
    todayLocal,
  );

  if (window.kind === "cadence") {
    const result = computeContactIntensity(input, now);
    if ("available" in result) {
      throw new Error(
        "profile-metrics: cadence window resolved without intensity",
      );
    }
    return {
      available: true,
      label: intensityLabel(result.currentCount, true, result.multiple),
      context: `${result.multiple}× this period vs ${window.days}-day contact frequency.`,
      visualValue: result.multiple,
      window,
      cadenceRelative: true,
      currentCount: result.currentCount,
      intendedPerPeriod: result.intendedPerPeriod,
      multiple: result.multiple,
      trailingAvgGapDays: result.trailingAvgGapDays,
    };
  }

  const nowMs = parseLocalMs(now);
  const qualifying = input.interactions.filter((interaction) =>
    qualifiesForIntensity(
      input,
      interaction.occurredAt,
      interaction.connected,
      interaction.direction,
      nowMs,
    ),
  );
  const currentCount = qualifying.filter((interaction) => {
    const localDate = formatLocalDate(
      new Date(parseLocalMs(interaction.occurredAt)),
    );
    return localDate >= window.start && localDate < window.endExclusive;
  }).length;

  return {
    available: true,
    label: intensityLabel(currentCount, false, null),
    context: "No contact frequency — showing this month's activity instead.",
    visualValue: currentCount,
    window,
    cadenceRelative: false,
    currentCount,
    intendedPerPeriod: null,
    multiple: null,
    trailingAvgGapDays: trailingAverageGapDays(
      qualifying.map((interaction) => interaction.occurredAt),
    ),
  };
}

/** Convenience composition for callers that already share one impact snapshot. */
export function resolveProfileImpactMetrics(input: ImpactInputs, now: string) {
  return {
    gravity: resolveProfileGravity(
      computeContactGravity(input, now),
      input.interactions.length,
    ),
    intensity: resolveProfileIntensity(input, now),
  } as const;
}
