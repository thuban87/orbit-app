/**
 * Motion token invariants (THEME-06, UI-SPEC Motion Tokens).
 *
 * Pure-data assertions — motion.ts imports nothing from react-native and carries
 * no colour literal. Durations are ms; `ambient` is a per-second SPEED constant
 * (a drift/angular RATE the Orrery worklet multiplies into useDerivedValue),
 * deliberately NOT a duration, so the Plan 04↔Plan 06 seam cannot mismatch.
 */
import { describe, expect, it } from "vitest";
import { EASING, MOTION } from "./motion";

describe("MOTION", () => {
  it("exposes the semantic durations fast(120)/base(200)/slow(320) in ms", () => {
    expect(MOTION.fast).toBe(120);
    expect(MOTION.base).toBe(200);
    expect(MOTION.slow).toBe(320);
  });

  it("orders fast < base < slow", () => {
    expect(MOTION.fast).toBeLessThan(MOTION.base);
    expect(MOTION.base).toBeLessThan(MOTION.slow);
  });

  it("exposes `ambient` as a positive per-second SPEED (a rate, not a duration)", () => {
    expect(typeof MOTION.ambient).toBe("number");
    expect(MOTION.ambient).toBeGreaterThan(0);
    // A rate, not a ms duration — must be far below the fast-tap duration.
    expect(MOTION.ambient).toBeLessThan(MOTION.fast);
  });

  it("carries no colour literal in any value", () => {
    for (const v of Object.values(MOTION)) {
      expect(typeof v).toBe("number");
    }
  });
});

describe("EASING", () => {
  it("exposes standard + decelerate as pure-data descriptors", () => {
    expect(Object.keys(EASING).sort()).toEqual(["decelerate", "standard"]);
    expect(EASING.standard).toBe("inOut");
    expect(EASING.decelerate).toBe("out");
  });
});
