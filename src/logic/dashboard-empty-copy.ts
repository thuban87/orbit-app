/**
 * What each Contacts empty state says (38.13 D-28, D-30, D-65). A pure module
 * with no UI-framework imports, so the copy is node-tested off-device.
 *
 * `dashboard-empty-logic` decides WHICH empty state shows; this module only
 * supplies its icon, heading, help line and action label, which HomeScreen
 * renders through the 38.9 `EmptyState` (D-14; ADR-199/204/205/206). Labels
 * come from the glossary (`src/constants/glossary.ts`) and the dashboard
 * control labels; counts go through `plural()`. The exact wording is this
 * plan's choice within the glossary (38.13 CONTEXT, Claude's discretion).
 */

import {
  AXIS_DEFAULT_LABELS,
  POPULATION_LABELS,
} from "@/components/control-surface/control-labels";
import type { IconName } from "@/components/icons/icon-registry";
import { BIN, NEVER_CONTACTED, UNBOUND } from "@/constants/glossary";
import { pluralWord } from "@/utils/plural";

export interface DashboardEmptyCopy {
  icon: IconName;
  heading: string;
  body: string;
  /** The one action's label; absent when the state offers none. */
  actionLabel?: string;
}

export interface FilterEmptyInput {
  /** At least one filter family has a selected value. */
  filtersActive: boolean;
  /** The Favorites population is selected and there are no favorites at all. */
  favouritesOnlyAndNone: boolean;
}

/**
 * A list filtered to nothing (D-28). The genuine "no favorites exist" case
 * keeps its onboarding copy and no action: clearing filters cannot help it.
 */
export function filterEmptyCopy(input: FilterEmptyInput): DashboardEmptyCopy {
  if (input.favouritesOnlyAndNone) {
    return {
      icon: "favorite",
      heading: "No favorites yet",
      body: "Tap the star on a contact's profile to add them here.",
    };
  }
  return {
    icon: "filter",
    heading: "No contacts match these filters",
    body: "Try fewer filters.",
    ...(input.filtersActive ? { actionLabel: "Clear filters" } : {}),
  };
}

/**
 * The empty populations' one action (38.13 D-82; 38.9 D-20/D-71): switch the
 * Population back to Active Contacts, named as the Population panel names it.
 */
export const SHOW_ACTIVE_CONTACTS_LABEL = `Show ${AXIS_DEFAULT_LABELS.population}`;

/** The populations with their own empty copy (D-30). */
export type DescribedPopulation = "birthdays" | "not-contacted" | "snoozed";

/**
 * An empty Birthdays / Never Contacted / Snoozed population says what that
 * population is (D-30) and offers one action, Show Active Contacts (D-82).
 * The Birthdays window matches the 0–30 day read in
 * `src/db/dashboard-read.ts` (resolveBirthdayWindow).
 */
export function populationEmptyCopy(
  population: DescribedPopulation,
): DashboardEmptyCopy {
  switch (population) {
    case "birthdays":
      return {
        icon: "your-week",
        heading: "No birthdays coming up",
        body: `${POPULATION_LABELS.birthdays} shows people whose birthday is in the next 30 days.`,
        actionLabel: SHOW_ACTIVE_CONTACTS_LABEL,
      };
    case "not-contacted":
      return {
        icon: "contacts",
        heading: "Everyone's been contacted",
        body: `${NEVER_CONTACTED} shows people you haven't logged an interaction with yet.`,
        actionLabel: SHOW_ACTIVE_CONTACTS_LABEL,
      };
    case "snoozed":
      return {
        icon: "snooze",
        heading: "No one is snoozed",
        body: `${POPULATION_LABELS.snoozed} shows people whose check-ins you've paused.`,
        actionLabel: SHOW_ACTIVE_CONTACTS_LABEL,
      };
  }
}

export interface TuckedAwayCounts {
  neverContacted: number;
  unbound: number;
  snoozed: number;
  archived: number;
}

/** One line under "Everyone's tucked away" (D-65; 39 D-98). */
export type TuckedAwayLine =
  | {
      kind: "button";
      target: "never-contacted" | "unbound";
      label: string;
      accessibilityLabel: string;
    }
  | {
      kind: "text";
      target: "snoozed" | "bin";
      label: string;
      accessibilityLabel: string;
    };

function people(n: number): string {
  return `${n} ${pluralWord(n, "person", "people")}`;
}

/**
 * The tucked-away lines, in order, omitting any zero count. Never Contacted
 * and Unbound lead somewhere (the screen wires them); snoozed and the Bin stay
 * text. The visible arrow is left out of the spoken labels.
 */
export function tuckedAwayLines(counts: TuckedAwayCounts): TuckedAwayLine[] {
  const lines: TuckedAwayLine[] = [];
  if (counts.neverContacted > 0) {
    lines.push({
      kind: "button",
      target: "never-contacted",
      label: `${counts.neverContacted} ${NEVER_CONTACTED} →`,
      accessibilityLabel: `Show ${counts.neverContacted} ${NEVER_CONTACTED} ${pluralWord(counts.neverContacted, "person", "people")}`,
    });
  }
  if (counts.unbound > 0) {
    lines.push({
      kind: "button",
      target: "unbound",
      label: `${counts.unbound} ${UNBOUND} →`,
      accessibilityLabel: `Open ${UNBOUND} contacts, ${people(counts.unbound)}`,
    });
  }
  if (counts.snoozed > 0) {
    const label = `${counts.snoozed} snoozed`;
    lines.push({
      kind: "text",
      target: "snoozed",
      label,
      accessibilityLabel: label,
    });
  }
  if (counts.archived > 0) {
    const label = `${counts.archived} in the ${BIN}`;
    lines.push({
      kind: "text",
      target: "bin",
      label,
      accessibilityLabel: label,
    });
  }
  return lines;
}
