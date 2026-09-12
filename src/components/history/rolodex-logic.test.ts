/**
 * Node tests for the Rolodex Browser's pure date + marker logic (HIST-08/18).
 *
 * These pin the wheel's correctness-critical math OUTSIDE the un-loadable .tsx:
 * Month/Day/Year boundary rolls, conventional (leap-aware) invalid-date clamping,
 * the today-as-max clamp, and marker classification from Plan 03's date-indexed
 * markers. `today` is always injected so the suite is deterministic.
 */
import { describe, expect, it } from "vitest";
import type { HistoryDateMarker } from "@/db/history-read";
import {
  clampDate,
  clampToMinYear,
  formatDrawerSummary,
  formatWheelDate,
  markerFor,
  minBrowseYear,
  parseWheelDate,
  rollDate,
} from "./rolodex-logic";

// A `today` chosen so NEITHER clamp interferes with the boundary-carry tests
// below: it is after every rolled result (upper clamp inert) yet within
// BROWSE_YEARS_BACK of the ~2020-2022 dates they roll (min-year floor inert).
const NEUTRAL_TODAY = { year: 2035, month: 12, day: 31 };

describe("rolodex-logic date roll", () => {
  it("rolls Day past a month boundary into the next month", () => {
    const from = parseWheelDate("2021-01-31");
    expect(rollDate(from, "day", 1, NEUTRAL_TODAY)).toEqual({
      year: 2021,
      month: 2,
      day: 1,
    });
  });

  it("rolls Day across the year boundary (Dec 31 -> Jan 1)", () => {
    const from = parseWheelDate("2021-12-31");
    expect(rollDate(from, "day", 1, NEUTRAL_TODAY)).toEqual({
      year: 2022,
      month: 1,
      day: 1,
    });
    const back = parseWheelDate("2021-01-01");
    expect(rollDate(back, "day", -1, NEUTRAL_TODAY)).toEqual({
      year: 2020,
      month: 12,
      day: 31,
    });
  });

  it("rolls Month and carries the Year at the Dec/Jan seam", () => {
    expect(rollDate(parseWheelDate("2021-12-15"), "month", 1, NEUTRAL_TODAY)).toEqual({
      year: 2022,
      month: 1,
      day: 15,
    });
    expect(rollDate(parseWheelDate("2021-01-15"), "month", -1, NEUTRAL_TODAY)).toEqual({
      year: 2020,
      month: 12,
      day: 15,
    });
  });

  it("clamps the day conventionally when a Month roll lands on a shorter month", () => {
    // Aug 31 -> Feb clamps to 29 in a leap year, 28 otherwise.
    expect(rollDate(parseWheelDate("2020-08-31"), "month", -6, NEUTRAL_TODAY)).toEqual({
      year: 2020,
      month: 2,
      day: 29,
    });
    expect(rollDate(parseWheelDate("2021-08-31"), "month", -6, NEUTRAL_TODAY)).toEqual({
      year: 2021,
      month: 2,
      day: 28,
    });
  });

  it("clamps Feb 29 down to Feb 28 when a Year roll lands on a non-leap year", () => {
    expect(rollDate(parseWheelDate("2020-02-29"), "year", 1, NEUTRAL_TODAY)).toEqual({
      year: 2021,
      month: 2,
      day: 28,
    });
  });
});

describe("rolodex-logic clampDate (conventional invalid-date clamp)", () => {
  it("clamps Feb 31 to the leap-aware last day of February", () => {
    expect(clampDate({ year: 2020, month: 2, day: 31 })).toEqual({
      year: 2020,
      month: 2,
      day: 29,
    });
    expect(clampDate({ year: 2021, month: 2, day: 31 })).toEqual({
      year: 2021,
      month: 2,
      day: 28,
    });
  });

  it("clamps a 31st in a 30-day month to the 30th", () => {
    expect(clampDate({ year: 2021, month: 4, day: 31 })).toEqual({
      year: 2021,
      month: 4,
      day: 30,
    });
  });

  it("leaves a valid date untouched", () => {
    expect(clampDate({ year: 2021, month: 3, day: 15 })).toEqual({
      year: 2021,
      month: 3,
      day: 15,
    });
  });
});

describe("rolodex-logic today-as-max clamp", () => {
  const today = { year: 2026, month: 9, day: 11 };

  it("clamps a forward Day roll that would pass today back to today", () => {
    expect(rollDate({ year: 2026, month: 9, day: 10 }, "day", 5, today)).toEqual(today);
  });

  it("clamps a forward Year roll into the future back to today", () => {
    expect(rollDate({ year: 2026, month: 9, day: 11 }, "year", 10, today)).toEqual(today);
  });

  it("does not clamp a roll that stays in the past", () => {
    expect(rollDate({ year: 2026, month: 9, day: 11 }, "day", -3, today)).toEqual({
      year: 2026,
      month: 9,
      day: 8,
    });
  });
});

describe("rolodex-logic min-year floor clamp (BROWSE_YEARS_BACK)", () => {
  const today = { year: 2026, month: 9, day: 11 };
  const minYear = minBrowseYear(today); // 1996

  it("floors a Year roll that would drop below minYear back to minYear", () => {
    // At the floor already; stepping one more year back must not go below it.
    const atFloor = { year: minYear, month: 5, day: 10 };
    const rolled = rollDate(atFloor, "year", -1, today);
    expect(rolled.year).toBe(minYear);
    // Month/day preserved; selectedIndex on the Year strip stays non-negative.
    expect(rolled.year - minYear).toBeGreaterThanOrEqual(0);
  });

  it("floors a multi-step Year roll far below minYear back to minYear (onStep delta)", () => {
    const rolled = rollDate({ year: minYear + 2, month: 3, day: 15 }, "year", -10, today);
    expect(rolled.year).toBe(minYear);
    expect(rolled.year - minYear).toBeGreaterThanOrEqual(0);
  });

  it("floors a day-axis roll that carries the year below minYear back to minYear", () => {
    // Jan 1 of the floor year, one day back would land in Dec of minYear-1.
    const rolled = rollDate({ year: minYear, month: 1, day: 1 }, "day", -1, today);
    expect(rolled.year).toBe(minYear);
    expect(rolled.year - minYear).toBeGreaterThanOrEqual(0);
  });

  it("leaves a year at or above minYear untouched", () => {
    expect(rollDate({ year: minYear + 5, month: 6, day: 1 }, "year", -1, today)).toEqual({
      year: minYear + 4,
      month: 6,
      day: 1,
    });
  });

  it("clamps a Feb 29 floor-crossing to a valid day of minYear (leap-aware)", () => {
    // minYear (1996) IS a leap year, so Feb 29 survives; the clamp preserves it.
    expect(clampToMinYear({ year: minYear - 3, month: 2, day: 29 }, today)).toEqual({
      year: minYear,
      month: 2,
      day: 29,
    });
  });
});

describe("rolodex-logic formatWheelDate", () => {
  it("formats a zero-padded local YYYY-MM-DD (no UTC slicing)", () => {
    expect(formatWheelDate({ year: 2026, month: 1, day: 5 })).toBe("2026-01-05");
  });
});

function marker(
  date: string,
  interactionCount: number,
  lifecycleCount: number,
  kind: HistoryDateMarker["kind"],
): HistoryDateMarker {
  return { date, interactionCount, lifecycleCount, kind };
}

describe("rolodex-logic markerFor classification", () => {
  const markers = new Map<string, HistoryDateMarker>([
    ["2026-09-01", marker("2026-09-01", 1, 0, "interaction")],
    ["2026-09-02", marker("2026-09-02", 0, 2, "lifecycle-only")],
    ["2026-09-03", marker("2026-09-03", 3, 1, "multiple")],
  ]);

  it("returns 'none' for a date with no records", () => {
    const m = markerFor("2026-09-10", markers);
    expect(m.kind).toBe("none");
    expect(m.interactionCount).toBe(0);
    expect(m.lifecycleCount).toBe(0);
    expect(m.a11yLabel).toBe("");
  });

  it("classifies an interaction-only date as 'interaction'", () => {
    const m = markerFor("2026-09-01", markers);
    expect(m.kind).toBe("interaction");
    expect(m.interactionCount).toBe(1);
    expect(m.a11yLabel).toBe("1 interaction");
  });

  it("classifies a lifecycle-only date as 'lifecycle' and exposes the event count", () => {
    const m = markerFor("2026-09-02", markers);
    expect(m.kind).toBe("lifecycle");
    expect(m.lifecycleCount).toBe(2);
    expect(m.a11yLabel).toBe("2 events");
  });

  it("classifies a multi-record date as 'multiple' with both counts to a11y", () => {
    const m = markerFor("2026-09-03", markers);
    expect(m.kind).toBe("multiple");
    expect(m.interactionCount).toBe(3);
    expect(m.lifecycleCount).toBe(1);
    expect(m.a11yLabel).toBe("3 interactions, 1 event");
  });
});

describe("rolodex-logic formatDrawerSummary", () => {
  it("summarizes a populated date with interaction + event counts", () => {
    const summary = formatDrawerSummary(markerFor("x", new Map()) && {
      kind: "multiple",
      interactionCount: 2,
      lifecycleCount: 1,
      a11yLabel: "2 interactions, 1 event",
    });
    expect(summary.hasRecords).toBe(true);
    expect(summary.text).toBe("2 interactions · 1 event");
  });

  it("summarizes an empty date as '0 events logged'", () => {
    const summary = formatDrawerSummary({
      kind: "none",
      interactionCount: 0,
      lifecycleCount: 0,
      a11yLabel: "",
    });
    expect(summary.hasRecords).toBe(false);
    expect(summary.text).toBe("0 events logged");
  });
});
