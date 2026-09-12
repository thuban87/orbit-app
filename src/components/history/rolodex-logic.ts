/**
 * Pure date + marker logic for the Rolodex History Browser (HIST-08/09/18).
 *
 * The wheel's correctness-critical math lives HERE, in a node-testable `.ts`,
 * not in `RolodexWheel.tsx`/`RolodexBrowser.tsx` (which cannot load under
 * vitest). It owns: Month/Day/Year date rolling with boundary carry,
 * conventional (leap-aware) invalid-date clamping, the today-as-max clamp, and
 * marker classification derived from Plan 03's date-indexed `HistoryDateMarker`s
 * (this module CONSUMES that aggregation — it never re-derives per-date counts).
 *
 * DATE DISCIPLINE (CLAUDE.md, dates.ts): every date is a local calendar triple
 * `{year, month, day}` (month/day 1-based) or a local `YYYY-MM-DD` string built
 * by zero-padding those parts. Arithmetic that must cross month/year boundaries
 * goes through a local `Date` on local components. UTC ISO slicing is NEVER
 * used — it produces the evening off-by-one that has bitten this project before
 * (that banned API is deliberately unnamed to keep the source-discipline grep
 * gate empty). Zero-padded `YYYY-MM-DD`
 * strings compare chronologically under `<=`, so the today-as-max clamp is a
 * string comparison.
 */
import type { HistoryDateMarker } from "@/db/history-read";

/** A local calendar date as 1-based parts (never a UTC instant). */
export interface WheelDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/** Which wheel is being turned. Day is the primary axis (rolls Month/Year). */
export type WheelAxis = "day" | "month" | "year";

/** How the selected date renders as a pre-selection marker. */
export type WheelMarkerKind = "none" | "interaction" | "lifecycle" | "multiple";

/** A classified marker for one date: silhouette kind + counts + a11y summary. */
export interface WheelMarker {
  readonly kind: WheelMarkerKind;
  readonly interactionCount: number;
  readonly lifecycleCount: number;
  /** Human/assistive-tech summary of the actual counts ("" when none). */
  readonly a11yLabel: string;
}

/** The drawer's one-line summary of the selected date. */
export interface DrawerSummary {
  readonly text: string;
  readonly hasRecords: boolean;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local `YYYY-MM-DD` from a WheelDate — zero-pad only, no UTC conversion. */
export function formatWheelDate(wd: WheelDate): string {
  return `${wd.year}-${pad2(wd.month)}-${pad2(wd.day)}`;
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse a local `YYYY-MM-DD` into its 1-based parts. */
export function parseWheelDate(ymd: string): WheelDate {
  const match = YMD.exec(ymd.trim());
  if (!match) {
    throw new Error(`rolodex-logic: expected YYYY-MM-DD, got "${ymd}"`);
  }
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Whole days in a 1-based month (leap-aware via the local Date rollover). */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Conventional invalid-date clamp: keep the year/month, clamp the day down to the
 * last valid day of that month (leap-aware). Aug 31 -> Feb yields Feb 28/29; a
 * 31st in a 30-day month yields the 30th. A valid date is returned unchanged.
 */
export function clampDate(wd: WheelDate): WheelDate {
  const maxDay = daysInMonth(wd.year, wd.month);
  return wd.day > maxDay ? { year: wd.year, month: wd.month, day: maxDay } : wd;
}

/** Clamp a date to today when it would fall strictly after today (today = max). */
export function clampToToday(wd: WheelDate, today: WheelDate): WheelDate {
  return formatWheelDate(wd) > formatWheelDate(today) ? today : wd;
}

/**
 * Roll the selected date along one wheel axis by `delta` steps, then apply the
 * conventional invalid-date clamp and the today-as-max clamp.
 *
 * - `day`: crosses month/year boundaries via local Date arithmetic (Jan 31 +1 ->
 *   Feb 1; Dec 31 +1 -> next Jan 1).
 * - `month`: shifts the month with a Year carry at the Dec/Jan seam, then clamps
 *   the day to the target month's length (Aug 31 -> Feb -> 28/29).
 * - `year`: shifts the year, then clamps the day (Feb 29 -> non-leap -> Feb 28).
 */
export function rollDate(
  current: WheelDate,
  axis: WheelAxis,
  delta: number,
  today: WheelDate,
): WheelDate {
  let next: WheelDate;
  switch (axis) {
    case "day": {
      const base = new Date(current.year, current.month - 1, current.day);
      base.setDate(base.getDate() + delta);
      next = {
        year: base.getFullYear(),
        month: base.getMonth() + 1,
        day: base.getDate(),
      };
      break;
    }
    case "month": {
      const monthIndex = current.month - 1 + delta;
      const year = current.year + Math.floor(monthIndex / 12);
      const month = ((monthIndex % 12) + 12) % 12 + 1;
      next = clampDate({ year, month, day: current.day });
      break;
    }
    case "year": {
      next = clampDate({ year: current.year + delta, month: current.month, day: current.day });
      break;
    }
  }
  return clampToToday(next, today);
}

/** Pluralize a count against a singular/plural noun pair. */
function countLabel(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * Classify a date's marker from Plan 03's per-date `HistoryDateMarker` map.
 * Counts are interaction-only for saturation elsewhere, but the drawer/a11y
 * summary exposes BOTH interaction and lifecycle counts (silhouette-primary; the
 * actual counts/types reach assistive tech, HIST-18). A date with no records is
 * `none` with a blank label.
 */
export function markerFor(
  date: string,
  markers: ReadonlyMap<string, HistoryDateMarker>,
): WheelMarker {
  const entry = markers.get(date);
  if (!entry) {
    return { kind: "none", interactionCount: 0, lifecycleCount: 0, a11yLabel: "" };
  }
  const kind: WheelMarkerKind =
    entry.kind === "lifecycle-only" ? "lifecycle" : entry.kind;
  const parts: string[] = [];
  if (entry.interactionCount > 0) {
    parts.push(countLabel(entry.interactionCount, "interaction", "interactions"));
  }
  if (entry.lifecycleCount > 0) {
    parts.push(countLabel(entry.lifecycleCount, "event", "events"));
  }
  return {
    kind,
    interactionCount: entry.interactionCount,
    lifecycleCount: entry.lifecycleCount,
    a11yLabel: parts.join(", "),
  };
}

/**
 * The drawer's one-line summary (UI-SPEC Copywriting Contract): a populated date
 * reads "{n interactions · m events}" (counts include lifecycle, unlike the
 * heatmap card); an empty date reads "0 events logged".
 */
export function formatDrawerSummary(marker: WheelMarker): DrawerSummary {
  const hasRecords = marker.interactionCount > 0 || marker.lifecycleCount > 0;
  if (!hasRecords) {
    return { text: "0 events logged", hasRecords: false };
  }
  const interactions = countLabel(marker.interactionCount, "interaction", "interactions");
  const events = countLabel(marker.lifecycleCount, "event", "events");
  return { text: `${interactions} · ${events}`, hasRecords: true };
}
