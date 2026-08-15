/**
 * Unit tests for src/components/touchpoint-refine-logic.ts (LOG-01).
 *
 * The Android two-dialog date+time carry-state math is the correctness-critical
 * pure part of the refine flow: the combined value must be a LOCAL
 * `YYYY-MM-DD HH:MM:SS` with NO UTC shift (an evening time must not roll a day),
 * the parse-back must preserve TIME-OF-DAY (types.ts parseDate drops it), and a
 * future combined datetime must be flagged. Tested here (node Vitest) since the
 * .tsx component imports react-native + the native picker and cannot load here.
 */
import { describe, expect, it } from "vitest";
import {
  combineDateAndTime,
  isCombinedInFuture,
  parseLocalDateTime,
} from "@/components/touchpoint-refine-logic";

describe("combineDateAndTime", () => {
  it("takes Y-M-D from the date part and H:M:S from the time part (two Dates)", () => {
    const datePart = new Date(2026, 7, 14, 9, 0, 0); // Aug 14, morning
    const timePart = new Date(2026, 0, 1, 22, 30, 15); // Jan 1, evening time
    expect(combineDateAndTime(datePart, timePart)).toBe("2026-08-14 22:30:15");
  });

  it("produces a LOCAL string with no UTC shift for an evening time", () => {
    // 23:30 local: a toISOString() build would roll the calendar day forward.
    const datePart = new Date(2026, 7, 14, 0, 0, 0);
    const timePart = new Date(2026, 7, 14, 23, 30, 0);
    expect(combineDateAndTime(datePart, timePart)).toBe("2026-08-14 23:30:00");
  });

  it("zero-pads month, day, hour, minute and second", () => {
    const datePart = new Date(2026, 0, 3, 0, 0, 0); // Jan 3
    const timePart = new Date(2026, 0, 1, 4, 5, 6);
    expect(combineDateAndTime(datePart, timePart)).toBe("2026-01-03 04:05:06");
  });

  it("carries a chosen time through a new date pick (time preserved)", () => {
    // A time was chosen first; the user then picks a different date. The carried
    // time survives.
    const chosenTime = new Date(2026, 0, 1, 18, 45, 0);
    const newDate = new Date(2026, 2, 9, 0, 0, 0); // Mar 9
    expect(combineDateAndTime(newDate, chosenTime)).toBe("2026-03-09 18:45:00");
  });

  it("carries a chosen date through a new time pick (date preserved)", () => {
    const chosenDate = new Date(2026, 4, 20, 0, 0, 0); // May 20
    const newTime = new Date(2026, 0, 1, 7, 15, 30);
    expect(combineDateAndTime(chosenDate, newTime)).toBe("2026-05-20 07:15:30");
  });

  it("accepts stored strings for either part", () => {
    expect(
      combineDateAndTime("2026-08-14 22:30:00", "2026-01-01 09:15:45"),
    ).toBe("2026-08-14 09:15:45");
  });
});

describe("parseLocalDateTime", () => {
  it("parses a stored YYYY-MM-DD HH:MM:SS into a local Date preserving time-of-day", () => {
    const d = parseLocalDateTime("2026-08-14 22:30:00");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // August (0-indexed)
    expect(d.getDate()).toBe(14);
    expect(d.getHours()).toBe(22);
    expect(d.getMinutes()).toBe(30);
    expect(d.getSeconds()).toBe(0);
  });

  it("round-trips an evening stored datetime byte-identically (no UTC shift)", () => {
    const stored = "2026-08-14 22:30:00";
    const parsed = parseLocalDateTime(stored);
    // Seeding both dialogs from the same parsed Date reproduces the stored value.
    expect(combineDateAndTime(parsed, parsed)).toBe(stored);
  });

  it("round-trips a near-midnight stored datetime byte-identically", () => {
    const stored = "2026-12-31 23:59:59";
    const parsed = parseLocalDateTime(stored);
    expect(combineDateAndTime(parsed, parsed)).toBe(stored);
  });

  it("defaults time to 00:00:00 when only a date is stored", () => {
    const d = parseLocalDateTime("2026-08-14");
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getDate()).toBe(14);
  });
});

describe("isCombinedInFuture", () => {
  const NOW = "2026-08-14 12:00:00";

  it("flags a combined datetime strictly after now", () => {
    expect(isCombinedInFuture("2026-08-14 12:00:01", NOW)).toBe(true);
    expect(isCombinedInFuture("2026-09-01 09:00:00", NOW)).toBe(true);
  });

  it("does not flag now itself or a past datetime (equal is not future)", () => {
    expect(isCombinedInFuture(NOW, NOW)).toBe(false);
    expect(isCombinedInFuture("2026-08-14 11:59:59", NOW)).toBe(false);
    expect(isCombinedInFuture("2026-01-01 00:00:00", NOW)).toBe(false);
  });
});
