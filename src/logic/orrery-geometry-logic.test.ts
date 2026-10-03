/**
 * Pure orrery geometry math — proof (ORR-01).
 *
 * angle↔time anchors + wrap, clockwise polar projection and the shortest-path
 * angular delta. D-12 (38.7) retired the legacy screen-space metrics, drift
 * and hit-test helpers together with their tests.
 */
import { describe, expect, it } from "vitest";
import * as geometry from "@/logic/orrery-geometry-logic";
import {
  PLANET_RADIUS,
  polarToXY,
  progressToAngle,
  SUN_RADIUS,
  shortestAngleDelta,
} from "@/logic/orrery-geometry-logic";

const HALF_PI = Math.PI / 2;

describe("single canonical world contract", () => {
  it("does not export a relationship resting-angle or mode-morph duration", () => {
    expect("evenSpreadAngle" in geometry).toBe(false);
    expect("MORPH_MS" in geometry).toBe(false);
    // D-12: the drift spans and the legacy screen-space helpers are gone; the
    // module exports exactly the on-ring geometry primitives.
    expect(Object.keys(geometry).sort()).toEqual([
      "HIT_RADIUS",
      "PLANET_RADIUS",
      "SUN_GLOW_RADIUS",
      "SUN_RADIUS",
      "polarToXY",
      "progressToAngle",
      "shortestAngleDelta",
    ]);
    expect(PLANET_RADIUS).toBeGreaterThan(0);
    expect(SUN_RADIUS).toBeGreaterThan(PLANET_RADIUS);
  });

  it("repeating a timestamp snapshot preserves clockwise 0/half/full interval placement", () => {
    const locate = () =>
      [0, 0.25, 0.5, 1].map((progress) =>
        polarToXY(0, 0, 100, progressToAngle(progress)),
      );
    const first = locate();
    expect(locate()).toEqual(first);
    expect(first[0].y).toBe(-100);
    expect(first[1].x).toBeCloseTo(100);
    expect(first[2].y).toBe(100);
    expect(first[3]).toEqual(first[0]);
  });
});

describe("progressToAngle — 0 at top (12 o'clock), clockwise, wraps each interval", () => {
  it("0 → 0 rad (top)", () => {
    expect(progressToAngle(0)).toBeCloseTo(0);
  });
  it("0.25 → π/2 (3 o'clock)", () => {
    expect(progressToAngle(0.25)).toBeCloseTo(HALF_PI);
  });
  it("0.5 → π (bottom / 6 o'clock)", () => {
    expect(progressToAngle(0.5)).toBeCloseTo(Math.PI);
  });
  it("1.0 wraps back to 0 (top)", () => {
    expect(progressToAngle(1)).toBeCloseTo(0);
  });
  it("1.5 wraps to π (bottom)", () => {
    expect(progressToAngle(1.5)).toBeCloseTo(Math.PI);
  });
  it("is negative-safe via floor: -0.25 ≡ 0.75", () => {
    expect(progressToAngle(-0.25)).toBeCloseTo(progressToAngle(0.75));
    expect(progressToAngle(-0.25)).toBeCloseTo(1.5 * Math.PI);
  });
});

describe("polarToXY — clockwise-from-top on a y-grows-down screen", () => {
  const cx = 100;
  const cy = 100;
  const r = 10;
  it("angle 0 → (cx, cy−r) (top)", () => {
    const { x, y } = polarToXY(cx, cy, r, 0);
    expect(x).toBeCloseTo(cx);
    expect(y).toBeCloseTo(cy - r);
  });
  it("angle π/2 → (cx+r, cy) (right)", () => {
    const { x, y } = polarToXY(cx, cy, r, HALF_PI);
    expect(x).toBeCloseTo(cx + r);
    expect(y).toBeCloseTo(cy);
  });
  it("angle π → (cx, cy+r) (bottom)", () => {
    const { x, y } = polarToXY(cx, cy, r, Math.PI);
    expect(x).toBeCloseTo(cx);
    expect(y).toBeCloseTo(cy + r);
  });
});

describe("shortestAngleDelta — the short way round the wrap (Pitfall 2)", () => {
  it("350° → 10° goes +20°, not −340°", () => {
    const from = (350 * Math.PI) / 180;
    const to = (10 * Math.PI) / 180;
    expect(shortestAngleDelta(from, to)).toBeCloseTo((20 * Math.PI) / 180);
  });
  it("normalises to [−π, π]: 0 → 3π/2 is −π/2 (short way)", () => {
    expect(shortestAngleDelta(0, 1.5 * Math.PI)).toBeCloseTo(-HALF_PI);
  });
  it("a within-range delta is unchanged", () => {
    expect(shortestAngleDelta(0, HALF_PI)).toBeCloseTo(HALF_PI);
  });
});
