/**
 * Pure digest logic — behavioural proof (DGST-02 / DGST-03).
 *
 * React-native-free unit tests over the transforms that shape the three digest
 * reads into the screen's sections. The evening-boundary dayTag assertion IS the
 * UTC-safety proof (a toISOString-based tag would shift a late timestamp a day
 * early); there is no comment-fragile grep here.
 */
import { describe, expect, it } from "vitest";
import {
  capGroup,
  dayTag,
  EFFORTFUL_MIN_FRACTION,
  EFFORTFUL_MIN_HARD,
  EFFORTFUL_WINDOW_DAYS,
  GROUP_CAP,
  isAllQuiet,
  RETROSPECTIVE_WINDOW_DAYS,
  shouldShowEffortful,
  WEEKDAY_LABELS,
  windowModifier,
} from "@/logic/digest-logic";

describe("tunables", () => {
  it("exposes the owner-tunable constants at documented defaults", () => {
    expect(RETROSPECTIVE_WINDOW_DAYS).toBe(6); // 7-day inclusive window
    expect(EFFORTFUL_WINDOW_DAYS).toBe(14); // deliberately wider than "this week"
    expect(GROUP_CAP).toBe(6);
    expect(EFFORTFUL_MIN_HARD).toBe(3);
    expect(EFFORTFUL_MIN_FRACTION).toBe(0.5);
  });

  it("provides Sun..Sat weekday labels aligned to Date.getDay()", () => {
    expect(WEEKDAY_LABELS).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
  });
});

describe("windowModifier", () => {
  it("builds a minus-N-days SQLite modifier from an integer tunable", () => {
    expect(windowModifier(6)).toBe("-6 days");
    expect(windowModifier(14)).toBe("-14 days");
    expect(windowModifier(0)).toBe("-0 days");
  });

  it("throws on a non-integer or negative value (no user input reaches SQL)", () => {
    expect(() => windowModifier(6.5)).toThrow();
    expect(() => windowModifier(-1)).toThrow();
    expect(() => windowModifier(Number.NaN)).toThrow();
    // @ts-expect-error — a string must never reach the SQL modifier builder
    expect(() => windowModifier("6")).toThrow();
  });
});

describe("dayTag", () => {
  it("returns the local weekday abbreviation of a stored wall-clock value", () => {
    expect(dayTag("2026-08-18 09:12:00")).toBe("Tue");
    expect(dayTag("2026-08-17 09:12:00")).toBe("Mon");
    expect(dayTag("2026-08-16 09:12:00")).toBe("Sun");
  });

  it("does not shift a day on a late-evening timestamp (UTC-safety proof)", () => {
    // A toISOString-based tag would render this Aug-18 23:59 local value as the
    // NEXT day in most positive-UTC-offset zones. Parsing local Y-M-D cannot.
    expect(dayTag("2026-08-18 23:59:00")).toBe("Tue");
    // A bare YYYY-MM-DD (no time component) is equally stable.
    expect(dayTag("2026-08-18")).toBe("Tue");
  });
});

describe("capGroup", () => {
  it("returns all rows with zero overflow at or below the cap", () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({ id: i }));
    const { shown, overflow } = capGroup(rows);
    expect(shown).toHaveLength(6);
    expect(overflow).toBe(0);
  });

  it("caps at GROUP_CAP and reports the overflow beyond it", () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({ id: i }));
    const { shown, overflow } = capGroup(rows);
    expect(shown).toHaveLength(6);
    expect(shown.map((r) => r.id)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(overflow).toBe(3);
  });

  it("never returns a negative overflow", () => {
    expect(capGroup([]).overflow).toBe(0);
  });
});

describe("shouldShowEffortful (conservative dual gate)", () => {
  it("does not fire on a single hard mark", () => {
    expect(shouldShowEffortful(1, 1)).toBe(false);
    expect(shouldShowEffortful(1, 2)).toBe(false);
  });

  it("fires only when BOTH the absolute floor and the fraction are met", () => {
    expect(shouldShowEffortful(3, 3)).toBe(true); // 3 >= 3 and 1.0 >= 0.5
    expect(shouldShowEffortful(3, 6)).toBe(true); // 3 >= 3 and 0.5 >= 0.5
  });

  it("errs toward NOT showing when the fraction floor fails", () => {
    expect(shouldShowEffortful(3, 20)).toBe(false); // 3 >= 3 but 0.15 < 0.5
  });

  it("errs toward NOT showing when the absolute floor fails even at 100%", () => {
    expect(shouldShowEffortful(2, 2)).toBe(false); // fraction fine, count short
  });

  it("treats a zero total as not-showing (no divide-by-zero blow-up)", () => {
    expect(shouldShowEffortful(0, 0)).toBe(false);
  });
});

describe("isAllQuiet", () => {
  it("is true only when every count is 0 AND no gentle line fires", () => {
    expect(
      isAllQuiet({
        reachedCount: 0,
        driftingCount: 0,
        goneQuietCount: 0,
        backlogCount: 0,
        effortfulShown: false,
      }),
    ).toBe(true);
  });

  it("is false when any section has content", () => {
    const base = {
      reachedCount: 0,
      driftingCount: 0,
      goneQuietCount: 0,
      backlogCount: 0,
      effortfulShown: false,
    };
    expect(isAllQuiet({ ...base, reachedCount: 1 })).toBe(false);
    expect(isAllQuiet({ ...base, driftingCount: 1 })).toBe(false);
    expect(isAllQuiet({ ...base, goneQuietCount: 1 })).toBe(false);
    expect(isAllQuiet({ ...base, backlogCount: 1 })).toBe(false);
    expect(isAllQuiet({ ...base, effortfulShown: true })).toBe(false);
  });
});
