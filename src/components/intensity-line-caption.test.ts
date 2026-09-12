/**
 * IntensityLine caption / cadence-label tests (Phase 32 review #1).
 *
 * The "…intended" caption must describe the CONTACT'S configured cadence, NOT
 * the measurement window. The load-bearing regression: a 7-Days lens over a
 * MONTHLY contact must read "Monthly intended" (the contact's cadence), never
 * "Weekly" / "every 7 days" (the window span). The in-window count/period stay
 * window-scoped. Node-pure: the caption logic lives in the RN-free sibling so it
 * is testable without loading react-native.
 */
import { describe, expect, it } from "vitest";
import type { ImpactInputs } from "@/db/impact-read";
import {
  intendedCaption,
  intendedLabel,
} from "@/components/intensity-line-caption";
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

describe("intendedLabel / intendedCaption — the cadence describes the CONTACT", () => {
  it("names an exact FREQUENCY_DAYS interval", () => {
    expect(intendedLabel(FREQUENCY_DAYS.Monthly)).toBe("Monthly");
    expect(intendedLabel(FREQUENCY_DAYS.Weekly)).toBe("Weekly");
    expect(intendedLabel(FREQUENCY_DAYS.Yearly)).toBe("Yearly");
  });

  it("falls back to 'every N days' for a non-preset interval", () => {
    expect(intendedLabel(45)).toBe("every 45 days");
  });

  it("appends the trailing-average clause only when known", () => {
    expect(intendedCaption(FREQUENCY_DAYS.Monthly, null)).toBe("Monthly intended");
    expect(intendedCaption(FREQUENCY_DAYS.Monthly, 12.4)).toBe(
      "Monthly intended · 12-day average",
    );
  });
});

describe("window-scoped caption reports the contact's TRUE cadence (Phase 32 #1)", () => {
  it("a 7-Days lens over a MONTHLY contact reads 'Monthly intended', not the window span", () => {
    // 7-day window 2020-03-09..2020-03-15, contact configured Monthly (30d).
    const window = buildWindow("7days", "2020-03-15", "2020-03-15");
    const inputs = boundInputs(
      [
        { occurredAt: "2020-03-10 10:00:00", connected: 1, direction: "outbound" },
        { occurredAt: "2020-03-14 10:00:00", connected: 1, direction: "mutual" },
        { occurredAt: "2020-02-01 10:00:00", connected: 1, direction: "outbound" }, // outside the window
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

    const caption = intendedCaption(result.cadenceDays, result.trailingAvgGapDays);
    expect(caption).toContain("Monthly intended"); // the CONTACT'S cadence
    expect(caption).not.toContain("Weekly"); // NOT the 7-day window span
    expect(caption).not.toContain("every 7 days");

    // Contrast — the pre-fix bug read the window span as the cadence: periodDays
    // 7 labels as "Weekly", which is exactly what the caption must NOT show.
    expect(intendedLabel(result.periodDays)).toBe("Weekly");
  });
});
