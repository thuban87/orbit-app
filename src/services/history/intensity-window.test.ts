/**
 * Window-scoped intensity tests (HIST-06, D-09) — RED first.
 *
 * intensityWindow must be genuinely scoped to the SELECTED window, not computed
 * over all interactions with real wall-clock now. The load-bearing regression is
 * a FIXED-VALUE assertion (review cycle-2 HIGH): a PAST window containing exactly
 * N qualifying interactions reports currentCount === N. The same inputs against
 * real now read ~0 — proving effectiveNow = window-end (not real now) is passed.
 */
import { describe, expect, it } from "vitest";
import type { ImpactInputs } from "@/db/impact-read";
import { computeIntensity } from "@/services/intensity-logic";
import { intensityWindow } from "@/services/history/intensity-window";
import { buildWindow } from "@/services/history/window";

const FAR_FUTURE_TODAY = "2026-12-31";

function boundInputs(
  interactions: ImpactInputs["interactions"],
  overrides: Partial<ImpactInputs> = {},
): ImpactInputs {
  return {
    trackingEnabled: 1,
    intervalDays: 30,
    rarelyResponds: 0,
    interactions,
    ...overrides,
  };
}

describe("intensityWindow — window scoping (HIST-06)", () => {
  it("counts exactly the qualifying interactions inside a PAST window (fixed value N)", () => {
    // A Month window over March 2020 — long before real now.
    const window = buildWindow("month", "2020-03-15", FAR_FUTURE_TODAY);
    const inputs = boundInputs([
      { occurredAt: "2020-03-05 10:00:00", connected: 1, direction: "outbound" },
      { occurredAt: "2020-03-15 10:00:00", connected: 1, direction: "mutual" },
      { occurredAt: "2020-03-25 10:00:00", connected: 1, direction: "outbound" },
      { occurredAt: "2020-03-10 10:00:00", connected: 1, direction: "inbound" }, // not "you reached out"
      { occurredAt: "2019-12-01 10:00:00", connected: 1, direction: "outbound" }, // outside the window
    ]);

    const result = intensityWindow(inputs, window);
    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.currentCount).toBe(3); // the 3 outbound/mutual March-2020 rows
    expect(result.periodDays).toBe(31); // March 1..31 inclusive

    // Contrast: the SAME rows against real wall-clock now read ~0 — this is the
    // exact bug (real now bounds computeIntensity to now-periodDays, so a 2020
    // window reads empty). The fixed value above proves effectiveNow=window-end.
    const naive = computeIntensity(inputs.interactions, 31, 0, "2026-09-11 23:59:59");
    expect(naive.currentCount).toBe(0);
  });

  it("returns different results for two different windows over the same interactions", () => {
    const inputs = boundInputs([
      { occurredAt: "2020-02-10 10:00:00", connected: 1, direction: "outbound" },
      { occurredAt: "2020-03-05 10:00:00", connected: 1, direction: "outbound" },
      { occurredAt: "2020-03-15 10:00:00", connected: 1, direction: "outbound" },
      { occurredAt: "2020-03-25 10:00:00", connected: 1, direction: "outbound" },
    ]);
    const feb = intensityWindow(inputs, buildWindow("month", "2020-02-15", FAR_FUTURE_TODAY));
    const mar = intensityWindow(inputs, buildWindow("month", "2020-03-15", FAR_FUTURE_TODAY));
    expect(feb.available && feb.currentCount).toBe(1);
    expect(mar.available && mar.currentCount).toBe(3);
  });
});

describe("intensityWindow — nullable cadence guard (D-09)", () => {
  it("returns { available: false } for an Unbound contact (interval null, tracking off)", () => {
    const window = buildWindow("month", "2020-03-15", FAR_FUTURE_TODAY);
    const unbound = boundInputs(
      [{ occurredAt: "2020-03-05 10:00:00", connected: 1, direction: "outbound" }],
      { trackingEnabled: 0, intervalDays: null },
    );
    expect(intensityWindow(unbound, window)).toEqual({ available: false });
  });

  it("returns { available: false } when interval_days is null even if tracking is on", () => {
    const window = buildWindow("month", "2020-03-15", FAR_FUTURE_TODAY);
    const inputs = boundInputs([], { intervalDays: null });
    expect(intensityWindow(inputs, window)).toEqual({ available: false });
  });
});
