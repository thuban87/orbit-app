import { describe, expect, it, vi } from "vitest";
import { chartRadii, niceStep } from "./LabChart";
import {
  BRACKET_MIN_R,
  bracketRadius,
  focusBodyValue,
  focusDimFactor,
  hullCircle,
  northFlare,
  PING_GROW,
  pingRings,
  pingTarget,
  reorderSlot,
  reticleSegments,
  reticleState,
  rippleRings,
  SEEK_ALPHA,
  seekAmount,
  slotFlash,
} from "./labb-focus-logic";

// LabChart imports Skia components; the pure helpers need none of it.
vi.mock("@shopify/react-native-skia", () => ({}));
vi.mock("react-native-reanimated", () => ({}));

describe("WP-2.2 world response", () => {
  it("focused worlds get +mix, others −mix, nothing at rest", () => {
    expect(focusBodyValue([], "contact:1", 1)).toBe(0);
    expect(focusBodyValue(["contact:1"], "contact:1", 0)).toBe(0);
    expect(focusBodyValue(["contact:1"], "contact:1", 0.5)).toBe(0.5);
    expect(focusBodyValue(["contact:1"], "contact:2", 0.5)).toBe(-0.5);
  });
  it("dim factor fades others to the floor and never dims the focus", () => {
    expect(focusDimFactor(["a"], "a", 1, 0.35)).toBe(1);
    expect(focusDimFactor(["a"], "b", 1, 0.35)).toBeCloseTo(0.35, 6);
    expect(focusDimFactor(["a"], "b", 0, 0.35)).toBe(1);
    expect(focusDimFactor([], "b", 1, 0.35)).toBe(1);
  });
});

describe("WP-2.2 reticle", () => {
  it("is never smaller than the minimum and grows with the body", () => {
    expect(bracketRadius(0)).toBe(BRACKET_MIN_R);
    expect(bracketRadius(40)).toBeGreaterThan(40);
  });
  it("seeks while the body is off-centre and locks to a static frame", () => {
    const seeking = reticleState(0, 1, false);
    expect(seeking.scale).toBeGreaterThan(1);
    expect(seeking.rot).toBeGreaterThan(0);
    expect(seeking.alpha).toBeCloseTo(SEEK_ALPHA, 6);
    const locked = reticleState(1, 1, false);
    expect(locked).toEqual({
      scale: 1,
      rot: 0,
      alpha: 1,
      flashScale: expect.any(Number),
      flashAlpha: 0,
    });
    // The lock flash exists only in the tail of the lock animation.
    expect(reticleState(0.3, 0, false).flashAlpha).toBe(0);
    expect(reticleState(0.7, 0, false).flashAlpha).toBeGreaterThan(0);
  });
  it("reduced motion is locked immediately: no seek, spin or flash", () => {
    expect(reticleState(0, 1, true)).toEqual({
      scale: 1,
      rot: 0,
      alpha: 1,
      flashScale: 1,
      flashAlpha: 0,
    });
  });
  it("seek is the remaining on-screen travel, clamped", () => {
    expect(seekAmount(50, 50, 50, 50, 100)).toBe(0);
    expect(seekAmount(150, 50, 50, 50, 100)).toBe(1);
    expect(seekAmount(500, 50, 50, 50, 100)).toBe(1);
    expect(seekAmount(0, 0, 0, 0, 0)).toBe(0);
  });
  it("draws 12 segments symmetric about the centre", () => {
    const seg = reticleSegments(10, 20, 30, 0);
    expect(seg).toHaveLength(48);
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < seg.length; i += 2) {
      sx += seg[i] - 10;
      sy += seg[i + 1] - 20;
    }
    expect(sx).toBeCloseTo(0, 6);
    expect(sy).toBeCloseTo(0, 6);
    // Corners sit on the reticle square.
    expect(Math.abs(seg[0] - 10)).toBeCloseTo(30, 6);
    expect(Math.abs(seg[1] - 20)).toBeCloseTo(30, 6);
  });
  it("hull encloses every member's reticle", () => {
    const h = hullCircle([
      { x: 0, y: 0, r: 10 },
      { x: 100, y: 0, r: 10 },
    ]);
    expect(h?.x).toBe(50);
    expect(h?.r).toBeCloseTo(50 + bracketRadius(10), 6);
    expect(hullCircle([])).toBeNull();
  });
});

describe("WP-2.2 feedback", () => {
  it("pings grow then end; reduced motion only fades a fixed ring", () => {
    expect(pingRings(1, false)).toEqual([]);
    const mid = pingRings(0.5, false);
    expect(mid.length).toBe(2);
    expect(mid[0].grow).toBeGreaterThan(mid[1].grow);
    expect(mid[0].grow).toBeLessThanOrEqual(PING_GROW);
    const rm = pingRings(0.5, true);
    expect(rm).toHaveLength(1);
    expect(rm[0].grow).toBe(pingRings(0.9, true)[0].grow);
    expect(rippleRings(0.5, true)[0].grow).toBe(rippleRings(0.1, true)[0].grow);
  });
  it("is pure in its timer", () => {
    expect(pingRings(0.37, false)).toEqual(pingRings(0.37, false));
    expect(rippleRings(0.61, false)).toEqual(rippleRings(0.61, false));
    expect(northFlare(0.4, false)).toEqual(northFlare(0.4, false));
    expect(northFlare(1, false)).toBeNull();
    expect(slotFlash(1, false)).toBeNull();
  });
  it("finds the pinged body and the held slot", () => {
    const body = (id: number, x: number) => ({
      id,
      kind: "contact" as const,
      x,
      y: 0,
      hitRadius: 20,
      visible: true,
      interactive: true,
    });
    const bodies = [body(1, 0), body(2, 30)] as never[];
    expect(pingTarget(bodies, 25, 0)).toBe("contact:2");
    expect(pingTarget(bodies, 200, 0)).toBeNull();
    expect(reorderSlot({ id: 3, reorderedVisibleIds: [1, 3, 2] })).toBe(1);
    expect(reorderSlot(null)).toBe(-1);
  });
});

describe("WP-2.2 Standard chart", () => {
  it("chooses nice steps and stays inside the extent", () => {
    expect(niceStep(17)).toBe(20);
    expect(niceStep(3)).toBe(2.5);
    expect(niceStep(0)).toBe(1);
    const radii = chartRadii(300, 6);
    expect(radii[0]).toBe(50);
    expect(radii.at(-1)).toBeLessThanOrEqual(315);
  });
});
