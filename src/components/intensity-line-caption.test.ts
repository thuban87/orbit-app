/**
 * IntensityLine caption / cadence-label tests (Phase 32 review #1; 38.14 D-65).
 *
 * The "…intended" caption must describe the CONTACT'S configured cadence, NOT
 * the measurement window. The load-bearing regression: a 7-Days lens over a
 * MONTHLY contact must read "Monthly intended" (the contact's cadence), never
 * "Weekly" / "every 7 days" (the window span). The in-window count/period stay
 * window-scoped. Node-pure: the caption logic lives in the RN-free sibling so it
 * is testable without loading react-native.
 */
import { describe, expect, it } from "vitest";
import {
  averageGapPhrase,
  intendedLabel,
  intensityShare,
  intensityShareCaption,
  rhythmName,
} from "@/components/intensity-line-caption";
import type { ImpactInputs } from "@/db/impact-read";
import { intensityWindow } from "@/services/history/intensity-window";
import { buildWindow } from "@/services/history/window";
import { FREQUENCY_DAYS } from "@/types";

function boundInputs(
  interactions: ImpactInputs["interactions"],
  overrides: Partial<ImpactInputs> = {},
): ImpactInputs {
  return {
    trackingEnabled: 1,
    intervalDays: FREQUENCY_DAYS.Monthly,
    rarelyResponds: 0,
    interactions,
    ...overrides,
  };
}

describe("intendedLabel — the cadence describes the CONTACT", () => {
  it("names an exact FREQUENCY_DAYS interval", () => {
    expect(intendedLabel(FREQUENCY_DAYS.Monthly)).toBe("Monthly");
    expect(intendedLabel(FREQUENCY_DAYS.Weekly)).toBe("Weekly");
    expect(intendedLabel(FREQUENCY_DAYS.Yearly)).toBe("Yearly");
  });

  it("falls back to 'every N days' for a non-preset interval", () => {
    expect(intendedLabel(45)).toBe("every 45 days");
  });
});

describe("rhythmName — the contact's cadence as an adjective (38.14 D-65)", () => {
  it("lower-cases a named cadence", () => {
    expect(rhythmName(FREQUENCY_DAYS.Monthly)).toBe("monthly");
    expect(rhythmName(FREQUENCY_DAYS.Weekly)).toBe("weekly");
    expect(rhythmName(FREQUENCY_DAYS["Bi-Weekly"])).toBe("bi-weekly");
  });

  it("reads Bi-Annually as an adjective", () => {
    expect(rhythmName(FREQUENCY_DAYS["Bi-Annually"])).toBe("twice-yearly");
  });

  it("names a non-preset interval by its days", () => {
    expect(rhythmName(45)).toBe("45-day");
  });
});

describe("intensityShare — the count's share of the contact's rhythm over the window (D-65)", () => {
  it("is count × cadence ÷ window (5 logs expected in 150 days of a monthly rhythm)", () => {
    expect(
      intensityShare({ currentCount: 2, periodDays: 150, cadenceDays: 30 }),
    ).toBeCloseTo(0.4, 10);
  });

  it("is 0 with no logs", () => {
    expect(
      intensityShare({ currentCount: 0, periodDays: 150, cadenceDays: 30 }),
    ).toBe(0);
  });

  it("may exceed 1 when the window is shorter than the cadence (the bar clamps separately)", () => {
    const share = intensityShare({
      currentCount: 1,
      periodDays: 7,
      cadenceDays: 30,
    });
    expect(share).toBeGreaterThan(1);
    expect(Number.isFinite(share)).toBe(true);
  });

  it("is 0 (never NaN or Infinity) when an input is not positive", () => {
    for (const input of [
      { currentCount: 2, periodDays: 0, cadenceDays: 30 },
      { currentCount: 2, periodDays: 30, cadenceDays: 0 },
      { currentCount: -1, periodDays: 30, cadenceDays: 30 },
      { currentCount: 2, periodDays: Number.NaN, cadenceDays: 30 },
    ]) {
      expect(intensityShare(input)).toBe(0);
    }
  });
});

describe("intensityShareCaption — count and share in plain words (D-65)", () => {
  it("reads about ⅕ for a fifth of a monthly rhythm", () => {
    // 1 log over 150 days of a monthly rhythm = 0.2.
    expect(
      intensityShareCaption({
        currentCount: 1,
        periodDays: 150,
        cadenceDays: 30,
      }),
    ).toBe("1 log · about ⅕ of your monthly rhythm");
  });

  it("uses the plural for more than one log", () => {
    // 2 logs over 300 days of a monthly rhythm = 0.2.
    expect(
      intensityShareCaption({
        currentCount: 2,
        periodDays: 300,
        cadenceDays: 30,
      }),
    ).toBe("2 logs · about ⅕ of your monthly rhythm");
  });

  it("reads about your rhythm near 1", () => {
    expect(
      intensityShareCaption({
        currentCount: 5,
        periodDays: 150,
        cadenceDays: 30,
      }),
    ).toBe("5 logs · about your monthly rhythm");
    expect(
      intensityShareCaption({ currentCount: 1, periodDays: 7, cadenceDays: 7 }),
    ).toBe("1 log · about your weekly rhythm");
  });

  it("reads about N× above the rhythm, never as a scold", () => {
    const caption = intensityShareCaption({
      currentCount: 10,
      periodDays: 150,
      cadenceDays: 30,
    });
    expect(caption).toBe("10 logs · about 2× your monthly rhythm");
    expect(caption).not.toMatch(/too|over|behind|only/i);
  });

  it("uses a half step between whole multiples", () => {
    expect(
      intensityShareCaption({
        currentCount: 3,
        periodDays: 60,
        cadenceDays: 30,
      }),
    ).toBe("3 logs · about 1½× your monthly rhythm");
  });

  it("reads under ⅛ for a very small share", () => {
    expect(
      intensityShareCaption({
        currentCount: 1,
        periodDays: 365,
        cadenceDays: 7,
      }),
    ).toBe("1 log · under ⅛ of your weekly rhythm");
  });

  it("states no logs plainly", () => {
    expect(
      intensityShareCaption({
        currentCount: 0,
        periodDays: 30,
        cadenceDays: 30,
      }),
    ).toBe("No logs in this period");
  });

  it("a window shorter than the cadence still reads sensibly", () => {
    const caption = intensityShareCaption({
      currentCount: 1,
      periodDays: 7,
      cadenceDays: 30,
    });
    expect(caption).toBe("1 log · about 4½× your monthly rhythm");
    expect(caption).not.toMatch(/NaN|Infinity|undefined/);
  });

  it("names a non-preset rhythm by its days", () => {
    expect(
      intensityShareCaption({
        currentCount: 1,
        periodDays: 90,
        cadenceDays: 45,
      }),
    ).toBe("1 log · about ½ of your 45-day rhythm");
  });
});

describe("averageGapPhrase — the average gap in plain words, never 0-day (D-65)", () => {
  it("reads a sub-day gap as the same day", () => {
    expect(averageGapPhrase(0.4)).toBe("usually on the same day");
    expect(averageGapPhrase(0)).toBe("usually on the same day");
    expect(averageGapPhrase(0.4)).not.toContain("0-day");
  });

  it("rounds to whole days apart", () => {
    expect(averageGapPhrase(6.6)).toBe("usually about 7 days apart");
    expect(averageGapPhrase(1.2)).toBe("usually about 1 day apart");
  });

  it("reads long gaps in months", () => {
    expect(averageGapPhrase(91)).toBe("usually about 3 months apart");
    expect(averageGapPhrase(45)).toBe("usually about 45 days apart");
  });

  it("gives no clause when the gap is unknown or not a number", () => {
    expect(averageGapPhrase(null)).toBeNull();
    expect(averageGapPhrase(Number.NaN)).toBeNull();
    expect(averageGapPhrase(-3)).toBeNull();
  });
});

describe("window-scoped caption reports the contact's TRUE cadence (Phase 32 #1)", () => {
  it("a 7-Days lens over a MONTHLY contact names the monthly rhythm, not the window span", () => {
    // 7-day window 2020-03-09..2020-03-15, contact configured Monthly (30d).
    const window = buildWindow("7days", "2020-03-15", "2020-03-15");
    const inputs = boundInputs(
      [
        {
          occurredAt: "2020-03-10 10:00:00",
          connected: 1,
          direction: "outbound",
        },
        {
          occurredAt: "2020-03-14 10:00:00",
          connected: 1,
          direction: "mutual",
        },
        {
          occurredAt: "2020-02-01 10:00:00",
          connected: 1,
          direction: "outbound",
        }, // outside the window
      ],
      { intervalDays: FREQUENCY_DAYS.Monthly },
    );

    const result = intensityWindow(inputs, window);
    expect(result.available).toBe(true);
    if (!result.available) return;

    // The in-window count/period stay scoped to the SELECTED window.
    expect(result.currentCount).toBe(2); // the 2 outbound/mutual rows inside the 7-day window
    expect(result.periodDays).toBe(7); // window day-span, NOT the cadence

    // The contact's TRUE cadence is threaded through, decoupled from periodDays.
    expect(result.cadenceDays).toBe(FREQUENCY_DAYS.Monthly);

    const caption = intensityShareCaption({
      currentCount: result.currentCount,
      periodDays: result.periodDays,
      cadenceDays: result.cadenceDays,
    });
    expect(caption).toContain("monthly rhythm"); // the CONTACT'S cadence
    expect(caption).not.toContain("weekly"); // NOT the 7-day window span
    expect(caption).toMatch(/^2 logs · /);
    const gap = averageGapPhrase(result.trailingAvgGapDays);
    expect(gap ?? "").not.toContain("0-day");
  });
});
