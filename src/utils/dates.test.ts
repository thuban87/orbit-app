/**
 * Unit tests for src/utils/dates.ts
 */
import { describe, expect, it } from "vitest";
import {
  calendarDaysBetween,
  formatLocalDate,
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
