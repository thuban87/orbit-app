/**
 * Your Week period geometry (Phase 38, D-05).
 *
 * Pure date construction stays separate from the runtime locale resolver so
 * node tests can inject both `today` and the locale's first weekday.
 */
import { getCalendars } from "expo-localization";
import type { HistoryWindow, WindowCell } from "@/services/history/window";
import { buildWindow } from "@/services/history/window";
import { formatLocalDate } from "@/utils/dates";

export type YourWeekPeriod = "rolling7" | "calendar_week";

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

function localDate(date: string): Date {
  const match = YMD.exec(date);
  if (!match) {
    throw new Error(`history/week-window: expected YYYY-MM-DD, got "${date}"`);
  }
  const value = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  if (formatLocalDate(value) !== date) {
    throw new Error(`history/week-window: invalid local date "${date}"`);
  }
  return value;
}

function addLocalDays(date: string, delta: number): string {
  const value = localDate(date);
  value.setDate(value.getDate() + delta);
  return formatLocalDate(value);
}

/** Read the device locale's 1-based weekday value, if Expo provides one. */
export function resolveFirstWeekday(): number | undefined {
  return getCalendars()[0]?.firstWeekday ?? undefined;
}

/** Build the standard HistoryWindow used by the Your Week heatmap. */
export function buildYourWeekWindow(
  period: YourWeekPeriod,
  today: string,
  firstWeekday?: number,
): HistoryWindow {
  if (period === "rolling7") {
    return buildWindow("7days", today, today);
  }

  const todayDate = localDate(today);
  // Expo is 1-based (1=Sunday..7=Saturday); Date#getDay is 0-based.
  const weekStartDay =
    Number.isInteger(firstWeekday) &&
    firstWeekday !== undefined &&
    firstWeekday >= 1 &&
    firstWeekday <= 7
      ? firstWeekday - 1
      : 0;
  const daysSinceStart = (todayDate.getDay() - weekStartDay + 7) % 7;
  const start = addLocalDays(today, -daysSinceStart);
  const end = addLocalDays(start, 6);
  const cells: WindowCell[] = Array.from({ length: 7 }, (_, index) => {
    const date = addLocalDays(start, index);
    return { date, isPlaceholder: false, isFuture: date > today };
  });

  return { lens: "7days", ref: today, start, end, cells };
}
