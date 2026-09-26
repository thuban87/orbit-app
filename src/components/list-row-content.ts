import type { StatusDisplayState } from "@/components/contact-card-ring";
import { statusDisplayLabel } from "@/components/icons/status-display-label";
import type { DashboardSearchSourceKind } from "@/logic/dashboard-search-match";
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

/** Compose the single category label onto compact recency when available. */
export function formatLine2(recency: string, category: string | null): string {
  return category === null ? recency : `${recency} · ${category}`;
}

/** UI-SPEC names for the closed shared corpus descriptor kinds. */
export const DASHBOARD_SEARCH_CATEGORY_LABELS: Record<
  DashboardSearchSourceKind,
  string
> = {
  identity: "Identity",
  relationship: "Relationship",
  "memory-or-custom-field": "Memory",
  "note-or-body": "Note",
};

/** Map descriptor-priority source kinds to distinct, render-ready labels. */
export function formatMatchCategories(
  sourceKinds: readonly DashboardSearchSourceKind[],
): string[] {
  return [...new Set(sourceKinds)].map(
    (sourceKind) => DASHBOARD_SEARCH_CATEGORY_LABELS[sourceKind],
  );
}

/** Compact, action-free search explanation shared by corpus and fuel fallback. */
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

interface RowAccessibilityDescriptionInput {
  name: string;
  category: string | null;
  recency: string;
  isFavourite: boolean;
  displayState: StatusDisplayState;
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
  context,
}: RowAccessibilityDescriptionInput): string {
  const summary = [
    name,
    category ?? "No category",
    recency,
    isFavourite ? "Favourite" : "Not favourite",
    statusDisplayLabel(displayState),
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
