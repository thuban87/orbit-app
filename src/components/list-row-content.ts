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
