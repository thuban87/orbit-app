import type { StatusDisplayState } from "@/components/contact-card-ring";
import { statusDisplayLabel } from "@/components/icons/status-display-label";
import { FAVORITE, NEVER_CONTACTED, UNBOUND } from "@/constants/glossary";
import { MEMORY_TYPE_REGISTRY } from "@/db/memory-registry";
import type {
  DashboardSearchMatch,
  DashboardSearchResult,
  DashboardSearchSourceKind,
} from "@/logic/dashboard-search-match";
import { PROFILE_MODULE_REGISTRY } from "@/profile/module-registry";
import {
  calendarDaysBetween,
  formatLocalDate,
  parseLocalMs,
} from "@/utils/dates";

/** Compact, local-calendar recency copy for the dashboard List row. */
export function formatListRecency(
  lastContact: string | null,
  now: string,
): string {
  if (lastContact === null) return "No interactions yet";

  try {
    const contactMs = parseLocalMs(lastContact);
    const nowMs = parseLocalMs(now);
    if (
      formatLocalDate(new Date(contactMs)) === formatLocalDate(new Date(nowMs))
    ) {
      return "Today";
    }

    const days = calendarDaysBetween(contactMs, nowMs);
    if (days === 1) return "Yesterday";
    if (days <= 0) return "Today";
    return `${days}d ago`;
  } catch {
    return "No interactions yet";
  }
}

/**
 * The Card view's visible recency (38.13 D-33): "Never Contacted" for a person
 * with no interactions, so it fits one card line where "No interactions yet"
 * truncated; every other value equals the List recency. The card's
 * accessibility description keeps `formatListRecency`'s full text. The wording
 * is this plan's choice (D-33 names no string).
 */
export function formatCardRecency(
  lastContact: string | null,
  now: string,
): string {
  if (lastContact === null) return NEVER_CONTACTED;
  return formatListRecency(lastContact, now);
}

/** Compose the single category label onto compact recency when available. */
export function formatLine2(recency: string, category: string | null): string {
  return category === null ? recency : `${recency} · ${category}`;
}

/**
 * UI-SPEC names for the closed shared corpus descriptor kinds. The section kinds
 * use their Things to Remember section names (D-44), read from the registries.
 * An identity match has no generic label: it reads its own field label (Name,
 * Phone, Email, Category; 38.13 D-37), so `identity` is not in this table.
 */
export const DASHBOARD_SEARCH_CATEGORY_LABELS: Record<
  Exclude<DashboardSearchSourceKind, "identity">,
  string
> = {
  relationship: "Relationship",
  "last-talked-about": PROFILE_MODULE_REGISTRY["last-talked-about"].label,
  "current-location": PROFILE_MODULE_REGISTRY["current-location"].label,
  "memory-or-custom-field": "Memory",
  "thought-of-them": MEMORY_TYPE_REGISTRY.thought_of_them.displayName,
  "gift-idea": MEMORY_TYPE_REGISTRY.gift_idea.displayName,
  "off-limits": PROFILE_MODULE_REGISTRY["off-limits"].label,
  "note-or-body": "Note",
};

/** One match's plain label: an identity match's own field, else its section. */
export function searchMatchLabel(
  match: Pick<DashboardSearchMatch, "sourceKind" | "fieldLabel">,
): string {
  return match.sourceKind === "identity"
    ? match.fieldLabel
    : DASHBOARD_SEARCH_CATEGORY_LABELS[match.sourceKind];
}

/** Map descriptor-priority matches to distinct, render-ready labels. */
export function formatMatchCategories(
  matches: readonly Pick<DashboardSearchMatch, "sourceKind" | "fieldLabel">[],
): string[] {
  return [...new Set(matches.map(searchMatchLabel))];
}

/** Compact, action-free search explanation shared by corpus and name-only rows. */
export function formatMatchExplanation(
  matchCount: number,
  categories: readonly string[],
  moreMatchesLabel?: string,
): string {
  const count = `${matchCount} ${matchCount === 1 ? "match" : "matches"}`;
  const parts = [count];
  if (categories.length > 0) parts.push(categories.join(", "));
  if (moreMatchesLabel) parts.push(moreMatchesLabel);
  return parts.join(" · ");
}

/**
 * The search explanation a row or card shows (38.13 D-37). A null result is
 * the name-only case (the contact matched by name alone, no corpus match) and
 * reads "Name"; otherwise the match count, the distinct plain labels and the
 * more-matches label.
 */
export function formatSearchExplanation(
  result: DashboardSearchResult | null,
): string {
  if (result === null) return "Name";
  return formatMatchExplanation(
    result.totalMatchCount,
    formatMatchCategories(result.matches),
    result.moreMatchesLabel,
  );
}

/**
 * The snippet a search row or card shows, or null (38.13 D-37). The name
 * corpus entry's snippet is the contact's name, which the row already shows,
 * so a snippet equal to the name (ignoring case and surrounding spaces) is
 * hidden; a blank snippet is too.
 */
export function searchSnippetToShow(
  snippet: string | null,
  name: string,
): string | null {
  const shown = snippet?.trim() ?? "";
  if (shown.length === 0) return null;
  return shown.toLocaleLowerCase() === name.trim().toLocaleLowerCase()
    ? null
    : snippet;
}

interface RowAccessibilityDescriptionInput {
  name: string;
  category: string | null;
  recency: string;
  isFavourite: boolean;
  displayState: StatusDisplayState;
  /**
   * An Unbound person (38.13 D-59, ADR-233): the status part reads "Unbound"
   * (never the null-status "Never Contacted") and the star is announced off.
   */
  unbound?: boolean;
  /**
   * The distinguishing context the row ACTUALLY renders (search explanation +
   * snippet, or the List-only adaptive line three). Announced after the
   * identity summary; blank/absent context leaves the summary byte-identical.
   * Never pass text the row does not display (RG-031 ui-accessibility/AUD-UIA-007).
   */
  context?: string | null;
}

/** Terminal punctuation that already ends a spoken sentence. */
const SENTENCE_END = /[.!?…]$/;

/**
 * A complete, colour-independent summary for a dashboard List row / Grid
 * card: identity first, then the rendered context (if any) as one final part.
 */
export function buildRowAccessibilityDescription({
  name,
  category,
  recency,
  isFavourite,
  displayState,
  unbound = false,
  context,
}: RowAccessibilityDescriptionInput): string {
  const summary = [
    name,
    category ?? "No category",
    recency,
    isFavourite && !unbound ? FAVORITE : "Not favorite",
    unbound ? UNBOUND : statusDisplayLabel(displayState),
  ]
    .map((part) => `${part}.`)
    .join(" ");
  const trimmed = context?.trim() ?? "";
  if (trimmed.length === 0) return summary;
  return `${summary} ${SENTENCE_END.test(trimmed) ? trimmed : `${trimmed}.`}`;
}

/**
 * The search-mode context a row/card renders: the match explanation, then the
 * displayed snippet (quoted) when one is shown. Null when nothing is shown.
 */
export function buildSearchRowContext(
  explanation: string | null,
  snippet: string | null,
): string | null {
  const parts: string[] = [];
  const shownExplanation = explanation?.trim() ?? "";
  const shownSnippet = snippet?.trim() ?? "";
  if (shownExplanation.length > 0) parts.push(shownExplanation);
  if (shownSnippet.length > 0) parts.push(`"${shownSnippet}"`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * A search-mode row/card description (38.13 D-51): only what is shown — the
 * name, the Unbound marker when it is shown, then the match explanation and the
 * shown snippet. No category, recency, favourite or status parts: search mode
 * does not show them as text (the status glyph stays visible but is not
 * announced here, as D-51 is written).
 */
export function buildSearchRowAccessibilityDescription({
  name,
  unbound,
  context,
}: {
  name: string;
  unbound: boolean;
  context: string | null;
}): string {
  const parts = [`${name}.`];
  if (unbound) parts.push(`${UNBOUND}.`);
  const trimmed = context?.trim() ?? "";
  if (trimmed.length > 0) {
    parts.push(SENTENCE_END.test(trimmed) ? trimmed : `${trimmed}.`);
  }
  return parts.join(" ");
}
