import type { StatusDisplayState } from "@/components/contact-card-ring";
import { statusDisplayLabel } from "@/components/icons/status-display-label";
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
