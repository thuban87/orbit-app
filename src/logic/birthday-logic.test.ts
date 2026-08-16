import { describe, expect, it } from "vitest";
import { daysUntilBirthday, FEB_29_OBSERVED_DAY } from "./birthday-logic";

/** Local-midnight-agnostic date builder (avoids UTC parsing surprises). */
function localDate(
  y: number,
  m1: number, // 1-based month for readability
  d: number,
  hh = 0,
  mm = 0,
): Date {
  return new Date(y, m1 - 1, d, hh, mm, 0, 0);
}

describe("daysUntilBirthday — null / empty / malformed contract", () => {
  const today = localDate(2026, 8, 15, 14, 0);

  it("returns null for null input (contacts.birthday is nullable)", () => {
    expect(daysUntilBirthday(null, today)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(daysUntilBirthday("", today)).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(daysUntilBirthday("   ", today)).toBeNull();
  });

  it("returns null (never throws) for arbitrary malformed strings", () => {
    for (const bad of [
      "not-a-date",
      "8-15",
      "2026/08/15",
      "2026-8-5",
      "08-15-2026",
      "202-08-15",
      "0815",
      "08-15 ",
      " 08-15",
    ]) {
      expect(daysUntilBirthday(bad, today)).toBeNull();
    }
  });
});

describe("daysUntilBirthday — strict calendar validation (MEDIUM-1: no silent normalization)", () => {
  const today = localDate(2026, 8, 15, 14, 0);

  it("02-30 → null (NOT silently normalized to Mar 2)", () => {
    expect(daysUntilBirthday("02-30", today)).toBeNull();
  });

  it("13-01 → null (month out of range)", () => {
    expect(daysUntilBirthday("13-01", today)).toBeNull();
  });

  it("00-10 → null (month zero)", () => {
    expect(daysUntilBirthday("00-10", today)).toBeNull();
  });

  it("08-00 → null (day zero)", () => {
    expect(daysUntilBirthday("08-00", today)).toBeNull();
  });

  it("08-32 → null (day out of range)", () => {
    expect(daysUntilBirthday("08-32", today)).toBeNull();
  });

  it("04-31 → null (April has 30 days)", () => {
    expect(daysUntilBirthday("04-31", today)).toBeNull();
  });

  it("non-leap YYYY 2021-02-29 → null (validated against that year)", () => {
    expect(daysUntilBirthday("2021-02-29", today)).toBeNull();
  });

  it("leap YYYY 2020-02-29 → valid (not null)", () => {
    expect(daysUntilBirthday("2020-02-29", today)).not.toBeNull();
  });

  it("year-unknown 02-29 (MM-DD) → valid (leap-permissive, year unknown)", () => {
    expect(daysUntilBirthday("02-29", today)).not.toBeNull();
  });
});

describe("daysUntilBirthday — Bug 1: day-of drop is fixed (local-midnight vs local-midnight)", () => {
  it("today IS the birthday → 0 at 00:01 local", () => {
    expect(daysUntilBirthday("08-15", localDate(2026, 8, 15, 0, 1))).toBe(0);
  });

  it("today IS the birthday → 0 at 12:00 local", () => {
    expect(daysUntilBirthday("08-15", localDate(2026, 8, 15, 12, 0))).toBe(0);
  });

  it("today IS the birthday → 0 at 23:59 local", () => {
    expect(daysUntilBirthday("08-15", localDate(2026, 8, 15, 23, 59))).toBe(0);
  });

  it("today IS the birthday (YYYY-MM-DD stored) → 0 regardless of stored year", () => {
    expect(
      daysUntilBirthday("1990-08-15", localDate(2026, 8, 15, 23, 59)),
    ).toBe(0);
  });
});

describe("daysUntilBirthday — future / past / rollover", () => {
  const today = localDate(2026, 8, 15, 14, 0);

  it("two days ahead → 2", () => {
    expect(daysUntilBirthday("08-17", today)).toBe(2);
  });

  it("one day past → rolls to next year (positive, never negative)", () => {
    const d = daysUntilBirthday("08-14", today);
    expect(d).not.toBeNull();
    expect(d).toBeGreaterThan(0);
    // Aug 15 2026 → Aug 14 2027 is 364 days (no Feb-29 in that span).
    expect(d).toBe(364);
  });

  it("the stored year does NOT change the next-occurrence math", () => {
    expect(daysUntilBirthday("08-14", today)).toBe(
      daysUntilBirthday("1975-08-14", today),
    );
  });
});

describe("daysUntilBirthday — MM-DD vs YYYY-MM-DD parity", () => {
  const today = localDate(2026, 8, 15, 14, 0);

  it("both formats extract the same month/day (future case)", () => {
    expect(daysUntilBirthday("12-25", today)).toBe(
      daysUntilBirthday("2001-12-25", today),
    );
  });

  it("both formats extract the same month/day (day-of case)", () => {
    expect(daysUntilBirthday("08-15", today)).toBe(
      daysUntilBirthday("2001-08-15", today),
    );
  });
});

describe("daysUntilBirthday — Bug 2: Feb-29 overflow is fixed (explicit observation)", () => {
  it("observation-day constant is Feb-28 (day 28), the flagged owner default", () => {
    expect(FEB_29_OBSERVED_DAY).toBe(28);
  });

  it("Feb-29 in a NON-leap year is observed on Feb-28, not Mar-1", () => {
    // 2027 is not a leap year. From 2027-02-27, Feb-28 is +1, Mar-1 would be +2.
    expect(daysUntilBirthday("02-29", localDate(2027, 2, 27, 14, 0))).toBe(1);
  });

  it("Feb-29 non-leap: on the observed day itself → 0", () => {
    expect(daysUntilBirthday("02-29", localDate(2027, 2, 28, 9, 0))).toBe(0);
  });

  it("Feb-29 in a LEAP year is used exactly (Feb-29)", () => {
    // 2028 is a leap year. From 2028-02-27, Feb-29 is +2.
    expect(daysUntilBirthday("02-29", localDate(2028, 2, 27, 14, 0))).toBe(2);
  });

  it("Feb-29 leap-year day-of (2028-02-29) → 0", () => {
    expect(daysUntilBirthday("02-29", localDate(2028, 2, 29, 18, 0))).toBe(0);
  });

  it("Feb-29 rollover recomputes observation for the NEXT year's leap status", () => {
    // From 2027-03-01, this year's Feb already passed → roll to 2028 (leap),
    // so the target is Feb-29 2028, not Feb-28.
    const d = daysUntilBirthday("02-29", localDate(2027, 3, 1, 10, 0));
    expect(d).not.toBeNull();
    // 2027-03-01 → 2028-02-29 = 365 days (2027 is non-leap; span excludes any Feb-29 before target).
    expect(d).toBe(365);
  });
});
