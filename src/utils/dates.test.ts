/**
 * Unit tests for src/utils/dates.ts
 */
import { describe, expect, it } from "vitest";
import {
  calendarDaysBetween,
  formatDateTimeMinute,
  formatDateTimeMinuteOrFallback,
  formatLocalDate,
  formatMinuteClock,
  formatTimeMinute,
  formatTimeMinuteOrFallback,
  isSnoozed,
  parseLocalMs,
} from "@/utils/dates";

describe("formatLocalDate", () => {
  it("formats a specific date as YYYY-MM-DD", () => {
    const date = new Date(2026, 0, 15); // Jan 15, 2026
    expect(formatLocalDate(date)).toBe("2026-01-15");
  });

  it("pads single-digit month and day", () => {
    const date = new Date(2026, 1, 3); // Feb 3, 2026
    expect(formatLocalDate(date)).toBe("2026-02-03");
  });

  it("handles December 31", () => {
    const date = new Date(2025, 11, 31); // Dec 31, 2025
    expect(formatLocalDate(date)).toBe("2025-12-31");
  });

  it("handles January 1", () => {
    const date = new Date(2026, 0, 1); // Jan 1, 2026
    expect(formatLocalDate(date)).toBe("2026-01-01");
  });

  it("defaults to current date when no argument provided", () => {
    const result = formatLocalDate();
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(result).toBe(expected);
  });

  it("uses local timezone (not UTC)", () => {
    // Create a date at 11:30 PM local time — toISOString would flip to next day
    // depending on timezone. formatLocalDate should always return local date.
    const date = new Date(2026, 5, 15, 23, 30, 0); // June 15, 2026 11:30 PM local
    expect(formatLocalDate(date)).toBe("2026-06-15");
  });

  it("handles leap year Feb 29", () => {
    const date = new Date(2028, 1, 29); // Feb 29, 2028 (leap year)
    expect(formatLocalDate(date)).toBe("2028-02-29");
  });
});

describe("minute-precision display timestamps", () => {
  it("formats stored local timestamps with a month name, 12-hour clock, and no seconds", () => {
    expect(formatDateTimeMinute("2026-09-19 19:14:37")).toBe(
      "Sep 19, 2026, 7:14 PM",
    );
  });

  it.each([
    ["2026-09-19 00:05:59", "Sep 19, 2026, 12:05 AM"],
    ["2026-09-19 12:00:01", "Sep 19, 2026, 12:00 PM"],
  ])("renders 12-hour boundaries for %s", (stored, expected) => {
    expect(formatDateTimeMinute(stored)).toBe(expected);
  });

  it("exercises the 24-hour clock branch without mutable formatter state", () => {
    expect(formatMinuteClock({ hour: 19, minute: 14 }, "24h")).toBe("19:14");
  });

  it("defaults the shared display formatter to the 12-hour clock", () => {
    expect(formatDateTimeMinute("2026-09-19 19:14:37")).toContain("7:14 PM");
  });

  it("returns a neutral display label rather than the raw timestamp when parsing fails", () => {
    expect(formatDateTimeMinuteOrFallback("not a timestamp")).toBe(
      "Unknown time",
    );
    expect(formatDateTimeMinuteOrFallback("")).toBe("Unknown time");
  });
});

/**
 * RG-038 (ui-accessibility/AUD-UIA-018, D-07, ADR-152): the identical fixture
 * set used across event, Digest, History and form consumers. Time-only and
 * date-time displays share one clock contract, so they can never disagree.
 */
const SHARED_CLOCK_FIXTURES: ReadonlyArray<readonly [string, string]> = [
  ["2026-09-16 00:00:00", "12:00 AM"],
  ["2026-09-16 12:00:00", "12:00 PM"],
  ["2026-09-16 23:59:59", "11:59 PM"],
  ["2026-09-16 09:05:59", "9:05 AM"],
  ["2026-09-16 09:06:00", "9:06 AM"],
];

describe("time-only minute display (RG-038)", () => {
  it.each(SHARED_CLOCK_FIXTURES)(
    "formats %s as %s with no seconds",
    (stored, expected) => {
      expect(formatTimeMinute(stored)).toBe(expected);
      expect(formatTimeMinuteOrFallback(stored)).toBe(expected);
    },
  );

  it("truncates seconds at the minute boundary (09:05:59 vs 09:06:00)", () => {
    expect(formatTimeMinute("2026-09-16 09:05:59")).toBe("9:05 AM");
    expect(formatTimeMinute("2026-09-16 09:06:00")).toBe("9:06 AM");
  });

  it("accepts the T-separated and minute-only stored forms parseLocalMs accepts", () => {
    expect(formatTimeMinute("2026-09-16T14:30:15")).toBe("2:30 PM");
    expect(formatTimeMinute("2026-09-16 14:30")).toBe("2:30 PM");
  });

  it.each(SHARED_CLOCK_FIXTURES)(
    "agrees with the date-time formatter's clock for %s",
    (stored, expected) => {
      expect(formatDateTimeMinute(stored).endsWith(`, ${expected}`)).toBe(true);
      expect(
        formatDateTimeMinute(stored).endsWith(formatTimeMinute(stored)),
      ).toBe(true);
    },
  );

  it("throws on an unparseable value like formatDateTimeMinute", () => {
    expect(() => formatTimeMinute("garbage")).toThrow(
      "dates: unparseable timestamp",
    );
  });

  it("returns the same neutral label as the date-time fallback", () => {
    expect(formatTimeMinuteOrFallback("garbage")).toBe("Unknown time");
    expect(formatTimeMinuteOrFallback("")).toBe("Unknown time");
    expect(formatTimeMinuteOrFallback("2026-09-16 25:00:00")).toBe(
      formatDateTimeMinuteOrFallback("2026-09-16 25:00:00"),
    );
  });
});

describe("calendar day helpers", () => {
  it("counts local calendar days across US spring-forward", () => {
    const originalTZ = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      expect(
        calendarDaysBetween(
          parseLocalMs("2026-03-08 12:00:00"),
          parseLocalMs("2026-03-09 12:00:00"),
        ),
      ).toBe(1);
    } finally {
      if (originalTZ === undefined) delete process.env.TZ;
      else process.env.TZ = originalTZ;
    }
  });

  it("matches the SQL active-snooze predicate with fail-closed parsing", () => {
    const now = "2026-08-15 12:00:00";
    expect(isSnoozed("2026-08-15", now)).toBe(false);
    expect(isSnoozed("2026-08-14", now)).toBe(false);
    expect(isSnoozed("2026-08-16", now)).toBe(true);
    expect(() => isSnoozed("not a date", now)).not.toThrow();
    expect(isSnoozed("not a date", now)).toBe(false);
  });

  it.each([
    "2026-00-15",
    "2026-13-15",
    "2026-02-29",
    "2026-08-15 99:00:00",
    "2026-08-15 12:60:00",
    "2026-08-15 12:00:60",
  ])("rejects numeric-invalid local timestamp %s", (stored) => {
    expect(() => parseLocalMs(stored)).toThrow("dates: unparseable timestamp");
  });

  it("accepts a real leap day while failing closed for invalid numeric snoozes", () => {
    expect(() => parseLocalMs("2028-02-29 12:00:00")).not.toThrow();

    const now = "2026-08-15 12:00:00";
    expect(isSnoozed("2026-08-16", now)).toBe(true);
    expect(isSnoozed("2026-08-15 99:00:00", now)).toBe(false);
    expect(isSnoozed("2026-13-01", now)).toBe(false);
    expect(isSnoozed("2026-08-16 12:60:00", now)).toBe(false);
    expect(isSnoozed("2026-08-16 12:00:60", now)).toBe(false);
  });
});
