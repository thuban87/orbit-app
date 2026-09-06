import type { StatusDisplayState } from "@/components/contact-card-ring";
import { statusDisplayLabel } from "@/components/icons/status-display-label";
import type { DashboardSearchSourceKind } from "@/logic/dashboard-search-match";
import { calendarDaysBetween, formatLocalDate, parseLocalMs } from "@/utils/dates";

/** Compact, local-calendar recency copy for the dashboard List row. */
export function formatListRecency(
  lastContact: string | null,
  now: string,
): string {
  if (lastContact === null) return "No interactions yet";

  const contactMs = parseLocalMs(lastContact);
  const nowMs = parseLocalMs(now);
  if (formatLocalDate(new Date(contactMs)) === formatLocalDate(new Date(nowMs))) {
    return "Today";
  }

  const days = calendarDaysBetween(contactMs, nowMs);
  if (days === 1) return "Yesterday";
  if (days <= 0) return "Today";
  return `${days}d ago`;
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
}

/** A complete, colour-independent summary for a dashboard List row. */
export function buildRowAccessibilityDescription({
  name,
  category,
  recency,
  isFavourite,
  displayState,
}: RowAccessibilityDescriptionInput): string {
  return [
    name,
    category ?? "No category",
    recency,
    isFavourite ? "Favourite" : "Not favourite",
    statusDisplayLabel(displayState),
  ]
    .map((part) => `${part}.`)
    .join(" ");
}
