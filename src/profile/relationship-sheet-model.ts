import {
  type CustomIntervalResult,
  shouldShowCustomError,
} from "@/components/frequency-picker-logic";
import { RARELY_RESPONDS } from "@/constants/glossary";
import type { ContactMethodRow } from "@/db/contact-methods-dao";
import type { ContactMethodGroups } from "@/db/contact-methods-read";
import type { SnoozePreset } from "@/db/snooze-dao";
import { GRAVITY_TIERS } from "@/services/impact";
import type {
  ProfileGravityMetric,
  ProfileIntensityMetric,
  ProfileStatusMetric,
} from "@/services/profile-metrics";
import { FREQUENCY_DAYS } from "@/types";
import {
  formatDateTimeMinuteOrFallback,
  formatDisplayDateOrFallback,
  formatLocalDate,
} from "@/utils/dates";
import { plural } from "@/utils/plural";

export type RelationshipExplanation = {
  title: string;
  /** Plain explanation of the term, shown first under the title (38.11 D-75). */
  definition: string;
  summary: string;
  details: string[];
  routes?: Array<"history" | "insights">;
};

export type RelationshipExplanationInput =
  | {
      kind: "status";
      metric: ProfileStatusMetric;
      insightsAvailable: boolean;
      /**
       * The Profile layout shows History, so "View history" can reveal it
       * (38.3 RG-021, D-11). When false the History route is omitted.
       */
      historyAvailable: boolean;
    }
  | { kind: "gravity"; metric: ProfileGravityMetric }
  | { kind: "intensity"; metric: ProfileIntensityMetric };

function gravityTierList(): string {
  const names = GRAVITY_TIERS.map(
    (tier) => `${tier.name.charAt(0).toUpperCase()}${tier.name.slice(1)}`,
  );
  return names.length < 2
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}

/**
 * Plain explanations of the stat terms (38.11 D-75): Orbit Status about one
 * line, Intensity a little more, Gravity the most. Each claim is checked
 * against the code: Status progress is elapsed / frequency
 * (`resolveProfileStatus`); Intensity counts outbound or mutual rows in one
 * contact frequency for Bound contacts, else the calendar month
 * (`resolveProfileIntensityWindow`, `intensity-logic.ts`); Gravity is a sum of
 * recency weights that decay toward a floor, shown as a tier, connected-only
 * for Rarely Responds (`impact.ts`, `gravity-logic.ts`). Copy is reviewed by
 * the owner at the device check (38.11-14).
 */
export const RELATIONSHIP_DEFINITIONS = {
  status:
    "Orbit Status shows how far along you are toward your contact frequency since you last spoke.",
  gravity: `Gravity is how much shared history you have with this person. Every logged interaction adds to it, and recent ones weigh more than old ones, so it grows as you keep in touch and fades slowly when you don't. Old history never fades away completely. It shows as a tier (${gravityTierList()}), not a score. For people marked ${RARELY_RESPONDS}, only interactions that connected count.`,
  intensity:
    "Intensity counts the times you reached out recently: within one contact frequency (the last 30 days for Monthly), or this calendar month when the contact is Unbound or has no frequency. With a frequency, reaching out once in that time reads as At pace and more often reads as Active. Interactions they started don't count.",
} as const;

export function relationshipExplanation(
  input: RelationshipExplanationInput,
): RelationshipExplanation {
  if (input.kind === "status") {
    const history: Array<"history"> = input.historyAvailable ? ["history"] : [];
    if (!input.metric.available) {
      return {
        title: "Orbit Status",
        definition: RELATIONSHIP_DEFINITIONS.status,
        summary: input.metric.label,
        details: [input.metric.context],
        routes: history,
      };
    }
    const details = [
      `Last interaction: ${formatDateTimeMinuteOrFallback(input.metric.factors.lastContact)}`,
      `Contact frequency: every ${plural(input.metric.factors.intervalDays, "day")}`,
      `Elapsed progress: ${Math.round(input.metric.factors.progress * 100)}%`,
    ];
    if (input.metric.factors.rarelyResponds) {
      details.push(
        `${RARELY_RESPONDS}: only connected interactions reset the orbit`,
      );
    }
    return {
      title: "Orbit Status",
      definition: RELATIONSHIP_DEFINITIONS.status,
      summary: input.metric.label,
      details,
      routes: input.insightsAvailable ? [...history, "insights"] : history,
    };
  }
  if (input.kind === "gravity") {
    return input.metric.available
      ? {
          title: "Gravity",
          definition: RELATIONSHIP_DEFINITIONS.gravity,
          summary: input.metric.label,
          details: [
            plural(input.metric.factors.interactionCount, "interaction"),
            "Weighted by recency",
            `Tier ${input.metric.factors.tierIndex + 1} of ${input.metric.factors.tierCount}`,
          ],
        }
      : {
          title: "Gravity",
          definition: RELATIONSHIP_DEFINITIONS.gravity,
          summary: input.metric.label,
          details: [input.metric.context],
        };
  }
  return {
    title: "Intensity",
    definition: RELATIONSHIP_DEFINITIONS.intensity,
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

/** The Profile Frequency sheet's custom row (38.11 D-54). */
export const CUSTOM_FREQUENCY_LABEL = "Custom…";

export type FrequencySheetSelection =
  | { kind: "preset"; days: number }
  | { kind: "custom"; days: number }
  | { kind: "none" };

/**
 * Which Frequency sheet row is selected (38.11 D-54): the matching preset, the
 * Custom… row for any other positive value (e.g. 45 days), or none.
 */
export function frequencySheetSelection(
  intervalDays: number | null,
): FrequencySheetSelection {
  if (intervalDays === null || intervalDays <= 0) return { kind: "none" };
  return FREQUENCY_CHOICES.some((choice) => choice.days === intervalDays)
    ? { kind: "preset", days: intervalDays }
    : { kind: "custom", days: intervalDays };
}

/**
 * The Custom… days box's Apply state (38.11 D-54). Apply is enabled only for a
 * positive whole number of days (`parseCustomInterval(raw, "days")`, T-38.11-06);
 * the error shows only after the user types (D-36, the 38.9 validation rule).
 */
export function customFrequencyApplyState(
  parsed: CustomIntervalResult,
  touched: boolean,
): { canApply: boolean; days: number | null; showError: boolean } {
  const canApply = parsed.valid && parsed.intervalDays !== null;
  return {
    canApply,
    days: canApply ? parsed.intervalDays : null,
    showError: shouldShowCustomError({
      valid: parsed.valid,
      touched,
      forced: false,
      afterTyping: true,
    }),
  };
}

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

/**
 * The custom snooze date's default and earliest pickable value (38.11 D-37):
 * tomorrow, the first date `validateCustomSnoozeDate` accepts. Local date
 * parts only, never a UTC slice; `Date` rolls the month and year over.
 */
export function snoozeCustomDateDefault(todayLocal: string): string {
  const [year, month, day] = todayLocal.slice(0, 10).split("-").map(Number);
  return formatLocalDate(new Date(year, month - 1, day + 1));
}

/** What a single-contact snooze operation did (38.11 review V-03). */
export type SnoozeOutcome =
  | { kind: "preset"; preset: SnoozePreset }
  | { kind: "until"; until: string }
  | { kind: "unsnooze" };

/**
 * The single-contact snooze confirmation (38.9 D-39 feedback rule, D-46 copy:
 * verb first, then whom). A preset's end date is resolved in SQLite, so the
 * copy names the preset; Choose date names the date. Draft copy, "this plan
 * only" (38.11-10); the owner sees it at the 38.11-14 snooze checkpoint.
 */
export function snoozeConfirmationLabel(
  name: string,
  outcome: SnoozeOutcome,
): string {
  if (outcome.kind === "unsnooze") return `Unsnoozed ${name}`;
  if (outcome.kind === "until") {
    return `Snoozed ${name} until ${formatDisplayDateOrFallback(outcome.until)}`;
  }
  const choice = SNOOZE_CHOICES.find(
    (entry) => entry.kind === "preset" && entry.preset === outcome.preset,
  );
  return `Snoozed ${name} for ${choice?.label ?? outcome.preset}`;
}

/** Undo's confirmation after a single-contact snooze change (draft copy). */
export function snoozeUndoneLabel(name: string): string {
  return `Snooze undone for ${name}`;
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

/** Hero Message reason for an archived contact, in any Profile host (D-09; "Bin" wording 38.11 D-69). */
export const PROFILE_MESSAGE_ARCHIVED_REASON =
  "Contacts in the Bin can't be messaged.";

/**
 * Hero Message reason for a Profile hosted in the Settings stack (D-25): Compose
 * is never registered under Settings, so messaging opens from Contacts instead.
 */
export const PROFILE_MESSAGE_SETTINGS_HOST_REASON =
  "Open this contact from Contacts to send a message.";

/**
 * Where a Profile is shown and what it is, as far as hero Message eligibility
 * cares. Lifecycle (Bound/Unbound, trackingEnabled) is deliberately absent: a
 * live Unbound contact can still be messaged (dossier Cluster N).
 */
export interface ProfileHeroMessageContext {
  archived: boolean;
  settingsHosted: boolean;
}

/**
 * Which method kinds the contact has saved at all, actionable or not (38.11
 * D-27). With `actionableMethods` it tells "no number" from "a number that
 * can't be used".
 */
export interface SavedMethodKinds {
  phone: boolean;
  email: boolean;
}

export function savedMethodKinds(
  groups: ContactMethodGroups,
): SavedMethodKinds {
  return { phone: groups.phone.length > 0, email: groups.email.length > 0 };
}

const CALL_NO_PHONE_REASON = "Add a phone number to call this contact.";
const CALL_UNUSABLE_PHONE_REASON =
  "This phone number can't be used to call. Check it in Edit Contact.";
const MESSAGE_NO_METHOD_REASON =
  "Add a phone number or email to message this contact.";

/**
 * Message reason when nothing is actionable, naming only the kinds the contact
 * actually has (38.11 D-27, T-20). Copy drafts; the owner reviews at 38.11-14.
 */
function messageUnusableReason(phone: boolean, email: boolean): string {
  if (phone && email) {
    return "This contact's number and email can't be used to message. Check them in Edit Contact.";
  }
  if (phone) {
    return "This contact's number can't be used to message. Check it in Edit Contact.";
  }
  if (email) {
    return "This contact's email can't be used to message. Check it in Edit Contact.";
  }
  return MESSAGE_NO_METHOD_REASON;
}

/**
 * Fixed hero action capability. Message is disabled (never hidden) for an
 * archived contact in every host (D-09) and for any Settings-hosted Profile
 * (D-25), evaluated in that order, before method availability — RG-021 keeps
 * archived messaging prohibited and Compose unregistered under Settings. Call
 * follows the phone rule only; archive/host never change it (D-27).
 *
 * 38.11 D-27 (ADR-109): `methods` keeps its actionable-primary semantics; a
 * kind counts as saved-but-unusable when `saved` says it exists (or a
 * non-actionable row was passed) and nothing of that kind is actionable.
 */
export function profileHeroActionState(
  methods: {
    phone: ContactMethodRow | null;
    email: ContactMethodRow | null;
  },
  context: ProfileHeroMessageContext,
  saved: SavedMethodKinds = { phone: false, email: false },
) {
  const phone = methods.phone?.is_actionable === 1;
  const email = methods.email?.is_actionable === 1;
  const unusablePhone = !phone && (saved.phone || methods.phone !== null);
  const unusableEmail = !email && (saved.email || methods.email !== null);
  const messageBlockedReason = context.archived
    ? PROFILE_MESSAGE_ARCHIVED_REASON
    : context.settingsHosted
      ? PROFILE_MESSAGE_SETTINGS_HOST_REASON
      : !phone && !email
        ? messageUnusableReason(unusablePhone, unusableEmail)
        : null;
  return {
    message:
      messageBlockedReason === null
        ? { enabled: true as const, route: "compose" as const, reason: null }
        : {
            enabled: false as const,
            route: null,
            reason: messageBlockedReason,
          },
    call: phone
      ? { enabled: true as const, route: "call" as const, reason: null }
      : {
          enabled: false as const,
          route: null,
          reason: unusablePhone
            ? CALL_UNUSABLE_PHONE_REASON
            : CALL_NO_PHONE_REASON,
        },
  };
}
