/**
 * Baseline tests for src/types.ts
 *
 * Tests the 5 exported utility functions that are used throughout the plugin.
 * These tests lock down existing behavior before the UX Overhaul begins.
 */
import { describe, expect, it } from "vitest";
import {
  calculateDaysSince,
  calculateDaysUntilDue,
  calculateStatus,
  FREQUENCY_DAYS,
  type Frequency,
  isValidFrequency,
  parseDate,
} from "@/types";

// ─── Helpers ────────────────────────────────────────────────────

/** Create a Date that is `daysAgo` days in the past (at local midnight) */
function daysAgo(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

// ═══════════════════════════════════════════════════════════════
// calculateStatus
// ═══════════════════════════════════════════════════════════════

describe("calculateStatus", () => {
  it('returns "decay" when lastContact is null (never contacted)', () => {
    expect(calculateStatus(null, "Monthly")).toBe("decay");
  });

  it('returns "stable" when contact is recent (< 80% of threshold)', () => {
    // Monthly = 30 days, 80% = 24 days. 5 days ago → stable
    expect(calculateStatus(daysAgo(5), "Monthly")).toBe("stable");
  });

  it('returns "wobble" when contact is at 80% of threshold', () => {
    // Monthly = 30 days, 80% = 24 days. 24 days ago → wobble
    expect(calculateStatus(daysAgo(24), "Monthly")).toBe("wobble");
  });

  it('returns "wobble" when contact is between 80% and 100% of threshold', () => {
    // Monthly = 30 days. 28 days ago → wobble (between 24 and 30)
    expect(calculateStatus(daysAgo(28), "Monthly")).toBe("wobble");
  });

  it('returns "decay" when contact is exactly at the threshold', () => {
    // Monthly = 30 days. 30 days ago → decay
    expect(calculateStatus(daysAgo(30), "Monthly")).toBe("decay");
  });

  it('returns "decay" when contact is past the threshold', () => {
    // Monthly = 30 days. 60 days ago → decay
    expect(calculateStatus(daysAgo(60), "Monthly")).toBe("decay");
  });

  it("works correctly with Daily frequency", () => {
    // Daily = 1 day. 0 days ago → stable (< 0.8)
    expect(calculateStatus(daysAgo(0), "Daily")).toBe("stable");
    expect(calculateStatus(daysAgo(1), "Daily")).toBe("decay");
  });

  it("works correctly with Weekly frequency", () => {
    // Weekly = 7 days. 80% = 5.6 days
    expect(calculateStatus(daysAgo(3), "Weekly")).toBe("stable");
    expect(calculateStatus(daysAgo(6), "Weekly")).toBe("wobble");
    expect(calculateStatus(daysAgo(7), "Weekly")).toBe("decay");
  });

  it("works correctly with Yearly frequency", () => {
    // Yearly = 365 days. 80% = 292. 100 days → stable
    expect(calculateStatus(daysAgo(100), "Yearly")).toBe("stable");
    expect(calculateStatus(daysAgo(300), "Yearly")).toBe("wobble");
    expect(calculateStatus(daysAgo(400), "Yearly")).toBe("decay");
  });
});

// ═══════════════════════════════════════════════════════════════
// calculateDaysSince
// ═══════════════════════════════════════════════════════════════

describe("calculateDaysSince", () => {
  it("returns Infinity when lastContact is null", () => {
    expect(calculateDaysSince(null)).toBe(Infinity);
  });

  it("returns 0 for a contact made today", () => {
    expect(calculateDaysSince(daysAgo(0))).toBe(0);
  });

  it("returns correct count for past dates", () => {
    expect(calculateDaysSince(daysAgo(10))).toBe(10);
  });

  it("returns correct count for 1 day ago", () => {
    expect(calculateDaysSince(daysAgo(1))).toBe(1);
  });

  it("returns correct count for large values", () => {
    expect(calculateDaysSince(daysAgo(365))).toBe(365);
  });
});

// ═══════════════════════════════════════════════════════════════
// calculateDaysUntilDue
// ═══════════════════════════════════════════════════════════════

describe("calculateDaysUntilDue", () => {
  it("returns -Infinity when lastContact is null", () => {
    expect(calculateDaysUntilDue(null, "Monthly")).toBe(-Infinity);
  });

  it("returns positive number when within threshold", () => {
    // Monthly = 30 days. 10 days ago → 20 days until due
    const result = calculateDaysUntilDue(daysAgo(10), "Monthly");
    expect(result).toBe(20);
  });

  it("returns 0 when exactly at threshold", () => {
    // Monthly = 30 days. 30 days ago → 0
    const result = calculateDaysUntilDue(daysAgo(30), "Monthly");
    expect(result).toBe(0);
  });

  it("returns negative when past threshold (overdue)", () => {
    // Monthly = 30 days. 40 days ago → -10
    const result = calculateDaysUntilDue(daysAgo(40), "Monthly");
    expect(result).toBe(-10);
  });

  it("returns full threshold when contacted today", () => {
    // Monthly = 30 days. 0 days ago → 30
    const result = calculateDaysUntilDue(daysAgo(0), "Monthly");
    expect(result).toBe(30);
  });

  it("uses correct threshold for each frequency", () => {
    for (const [freq, days] of Object.entries(FREQUENCY_DAYS)) {
      const result = calculateDaysUntilDue(daysAgo(0), freq as Frequency);
      expect(result).toBe(days);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// parseDate
// ═══════════════════════════════════════════════════════════════

describe("parseDate", () => {
  it("returns null for null input", () => {
    expect(parseDate(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseDate(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseDate("")).toBeNull();
  });

  it("parses valid ISO date YYYY-MM-DD", () => {
    const result = parseDate("2025-01-15");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(0); // January = 0
    expect(result!.getDate()).toBe(15);
  });

  it("parses ISO date with timestamp (extracts date portion)", () => {
    const result = parseDate("2025-06-20T14:30:00Z");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2025);
    expect(result!.getMonth()).toBe(5); // June = 5
    expect(result!.getDate()).toBe(20);
  });

  it("returns null for completely invalid string", () => {
    expect(parseDate("not-a-date")).toBeNull();
  });

  it("returns null for gibberish", () => {
    expect(parseDate("abc123xyz")).toBeNull();
  });

  it("parses date at year boundary", () => {
    const result = parseDate("2025-12-31");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getMonth()).toBe(11); // December = 11
    expect(result!.getDate()).toBe(31);
  });

  it("parses date at start of year", () => {
    const result = parseDate("2025-01-01");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getMonth()).toBe(0);
    expect(result!.getDate()).toBe(1);
  });

  it("parses non-ISO date string via native Date fallback", () => {
    // Exercises the fallback branch at types.ts lines 177-179
    // "Jan 15, 2024" does not match the ISO regex, so it falls through
    // to `new Date(dateStr)` which can parse this format
    const result = parseDate("Jan 15, 2024");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(0); // January = 0
    expect(result!.getDate()).toBe(15);
  });
});

// ═══════════════════════════════════════════════════════════════
// isValidFrequency
// ═══════════════════════════════════════════════════════════════

describe("isValidFrequency", () => {
  it("returns true for all valid frequency values", () => {
    const validFrequencies: Frequency[] = [
      "Daily",
      "Weekly",
      "Bi-Weekly",
      "Monthly",
      "Quarterly",
      "Bi-Annually",
      "Yearly",
    ];
    for (const freq of validFrequencies) {
      expect(isValidFrequency(freq)).toBe(true);
    }
  });

  it("returns false for undefined", () => {
    expect(isValidFrequency(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidFrequency("")).toBe(false);
  });

  it("returns false for invalid string", () => {
    expect(isValidFrequency("Every Other Day")).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(isValidFrequency("monthly")).toBe(false);
    expect(isValidFrequency("MONTHLY")).toBe(false);
    expect(isValidFrequency("Monthly")).toBe(true);
  });
});
