/**
 * fuel-age — pure relative-age formatter proof (FUEL-04).
 *
 * Proves "today / N days ago / N months ago / N years ago" computed from LOCAL
 * wall-clock components (never toISOString / UTC — the CLAUDE.md evening
 * off-by-one), and that a clock-skew FUTURE createdAt never yields a negative age
 * (it reads "today"). Age is DISPLAY + RANK only — this module mutates nothing.
 *
 * All `now` values are fixed local strings so the boundaries are deterministic.
 */
import { describe, expect, it } from "vitest";
import { formatFuelAge } from "@/services/fuel-age";

const NOW = "2026-08-15 12:00:00";

describe("formatFuelAge — today / days / months / years, local wall-clock", () => {
  it("same calendar day → 'today'", () => {
    expect(formatFuelAge("2026-08-15 00:30:00", NOW)).toBe("today");
    expect(formatFuelAge("2026-08-15 23:59:00", NOW)).toBe("today");
  });

  it("under a month → 'N days ago' (singular at 1)", () => {
    expect(formatFuelAge("2026-08-14 09:00:00", NOW)).toBe("1 day ago");
    expect(formatFuelAge("2026-08-12 09:00:00", NOW)).toBe("3 days ago");
    expect(formatFuelAge("2026-07-27 09:00:00", NOW)).toBe("19 days ago");
  });

  it("~30 days crosses into months → '1 month ago'", () => {
    // 2026-07-15 → 2026-08-15 is 31 days, one calendar month.
    expect(formatFuelAge("2026-07-15 09:00:00", NOW)).toBe("1 month ago");
    expect(formatFuelAge("2026-05-15 09:00:00", NOW)).toBe("3 months ago");
  });

  it("12 months or more → 'N years ago'", () => {
    // 13 calendar months back.
    expect(formatFuelAge("2025-07-15 09:00:00", NOW)).toBe("1 year ago");
    // 24 calendar months back.
    expect(formatFuelAge("2024-08-15 09:00:00", NOW)).toBe("2 years ago");
  });

  it("a future createdAt (clock skew) never goes negative → 'today'", () => {
    expect(formatFuelAge("2026-09-01 09:00:00", NOW)).toBe("today");
    expect(formatFuelAge("2027-01-01 09:00:00", NOW)).toBe("today");
  });

  it("parses LOCAL components — an evening created_at is still 'today'", () => {
    // 22:00 local on the same day must not roll to 'yesterday'/'tomorrow' via a
    // UTC conversion. Fixed same-day now proves the local parse.
    expect(formatFuelAge("2026-08-15 22:00:00", "2026-08-15 23:00:00")).toBe(
      "today",
    );
  });
});
