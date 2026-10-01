import { describe, expect, it, vi } from "vitest";

vi.mock("@shopify/react-native-skia", () => ({ Skia: {} }));

import {
  type CameraPose,
  clampCameraPose,
  MAX_TILT,
  projectWorldPoint,
} from "@/logic/orrery-camera-logic";
import { orreryRingStyle } from "@/logic/orrery-ring-logic";
import { THEME_PRESETS } from "@/theme/theme-presets";
import {
  applyHomography,
  compassChevron,
  northTick,
  planeHomography,
  RING_CLUTTER_FLOOR,
  RING_CLUTTER_GAP_DP,
  ringDensityFade,
  ringInstrumentClass,
  ringUniforms,
  scaleTicks,
  tetherRect,
  tetherSegment,
  tiltDepth,
  typicalRingGap,
  wakeAngle,
  wakeUniforms,
} from "./labb-rings-logic";

const colors = THEME_PRESETS.galaxy.dark;

describe("planeHomography (ring geometry = static world circle × one matrix)", () => {
  const viewports = [
    { width: 400, height: 800 },
    {
      width: 412,
      height: 860,
      usable: { x: 0, y: 120, width: 412, height: 600 },
    },
  ];
  const poses: CameraPose[] = [
    { x: 0, y: 0, zoom: 1 },
    { x: 40, y: -25, zoom: 2.2, tilt: 0.5, yaw: 0.9 },
    { x: -80, y: 60, zoom: 0.4, tilt: MAX_TILT, yaw: Math.PI },
    { x: 10, y: 5, zoom: 4, tilt: 0.3, yaw: 4.4 },
  ];
  it("matches projectWorldPoint exactly for points on the plane", () => {
    for (const viewport of viewports)
      for (const raw of poses) {
        const pose = clampCameraPose(raw, 600);
        const m = planeHomography(pose, viewport);
        expect(m).not.toBeNull();
        if (!m) continue;
        for (const [x, y] of [
          [0, 0],
          [120, 0],
          [0, -300],
          [-210, 170],
          [333, 333],
        ]) {
          const want = projectWorldPoint({ x, y }, pose, viewport);
          const got = applyHomography(m, x, y);
          expect(got.x).toBeCloseTo(want.x, 6);
          expect(got.y).toBeCloseTo(want.y, 6);
        }
      }
  });
  it("is affine (no perspective row) at tilt 0, projective under tilt", () => {
    const flat = planeHomography(
      { x: 3, y: 4, zoom: 1.5, yaw: 1 },
      viewports[0],
    );
    expect(flat?.[6]).toBeCloseTo(0, 12);
    expect(flat?.[7]).toBeCloseTo(0, 12);
    expect(flat?.[8]).toBeCloseTo(1, 12);
    const tilted = planeHomography(
      clampCameraPose({ x: 0, y: 0, zoom: 1, tilt: 0.6 }, 400),
      viewports[0],
    );
    expect(Math.abs(tilted?.[7] ?? 0)).toBeGreaterThan(0);
  });
  it("returns null without a usable measurement", () => {
    expect(
      planeHomography({ x: 0, y: 0, zoom: 1 }, { width: 0, height: 0 }),
    ).toBeNull();
  });
  it("tilt depth is 0 flat and 1 at max tilt", () => {
    expect(tiltDepth({ x: 0, y: 0, zoom: 1 })).toBe(0);
    expect(tiltDepth({ x: 0, y: 0, zoom: 1, tilt: MAX_TILT })).toBeCloseTo(
      1,
      9,
    );
  });
});

describe("wake angle (ADR-011: north = 0, clockwise)", () => {
  it("north 0, east π/2, south π, west 3π/2", () => {
    expect(wakeAngle(0, -10)).toBeCloseTo(0, 12);
    expect(wakeAngle(10, 0)).toBeCloseTo(Math.PI / 2, 12);
    expect(wakeAngle(0, 10)).toBeCloseTo(Math.PI, 12);
    expect(wakeAngle(-10, 0)).toBeCloseTo((3 * Math.PI) / 2, 12);
    expect(wakeAngle(0, 0)).toBe(0);
  });
  it("wake uniforms carry the body angle, ring radius and a zoom-scaled half width", () => {
    const u = wakeUniforms(
      [1, 0.5, 0, 1],
      0.3,
      Math.PI / 2,
      120,
      2.6,
      0.3,
      [1, 0, 0.4, 2],
    );
    expect(u.uColor).toEqual([1, 0.5, 0, 0.3]);
    expect(u.uWake).toEqual([Math.PI / 2, 120, 0.65, 0.3]);
    expect(u.uCam).toEqual([1, 0, 0.4, 0]);
  });
});

describe("instrument class keeps the ring semantics", () => {
  const cls = (s: Parameters<typeof orreryRingStyle>[0]) =>
    ringInstrumentClass(s, orreryRingStyle(s, colors));
  it("keeps hue, weight ORDER and stroke style per status", () => {
    const stable = cls("stable");
    const wobble = cls("wobble");
    const decay = cls("decay");
    const rogue = cls("rogue");
    const neutral = cls(null);
    expect(stable.color).toBe(colors.statusStable);
    expect(wobble.color).toBe(colors.statusWobble);
    expect(decay.color).toBe(colors.statusDecay);
    expect(rogue.color).toBe(colors.rogue);
    expect(neutral.color).toBe(colors.border);
    // weight is the redundant CVD channel: stable < wobble = rogue < decay
    expect(stable.widthDp).toBeLessThan(wobble.widthDp);
    expect(wobble.widthDp).toBe(rogue.widthDp);
    expect(wobble.widthDp).toBeLessThan(decay.widthDp);
    for (const c of [stable, wobble, decay, rogue, neutral])
      expect(c.widthDp).toBeLessThanOrEqual(2);
    // style: solid / dashed / faded / faint trace / neutral half alpha
    expect(stable.dashPeriod).toBe(0);
    expect(wobble.dashPeriod).toBeGreaterThan(0);
    expect(decay.dashPeriod).toBe(0);
    expect(decay.alpha).toBeLessThan(1);
    expect(rogue.dashPeriod).toBeGreaterThan(0);
    expect(rogue.dashDuty).toBeLessThan(wobble.dashDuty);
    expect(rogue.alpha).toBeLessThan(decay.alpha);
    expect(neutral.alpha).toBe(0.5);
    // wake for real statuses only; tether only for drifted bodies
    expect(neutral.wake).toBe(false);
    expect([stable, wobble, decay, rogue].every((c) => c.wake)).toBe(true);
    expect([decay.tether, rogue.tether]).toEqual([true, true]);
    expect([stable.tether, wobble.tether, neutral.tether]).toEqual([
      false,
      false,
      false,
    ]);
  });
});

describe("static world geometry", () => {
  it("tether runs from the rail to the body limb, or nothing when on the rail", () => {
    const t = tetherSegment(100, 0, -150, 10);
    expect(t).toEqual({ x0: 0, y0: -100, x1: 0, y1: -140 });
    expect(tetherSegment(100, 0, -105, 10)).toBeNull();
    // As a rect: rotate north onto the body (east = π/2), span rail → limb.
    expect(tetherRect(100, 150, 0, 10)).toEqual({
      angle: Math.PI / 2,
      inner: 100,
      outer: 140,
    });
  });
  it("ticks straddle the rail; the scale has 12 marks; compass sits outside", () => {
    expect(northTick(50, 4)).toEqual({ x0: 0, y0: -48, x1: 0, y1: -52 });
    expect(scaleTicks(80)).toHaveLength(12);
    const [left, right] = compassChevron(200);
    expect(Math.min(left.y0, left.y1, right.y0, right.y1)).toBeLessThan(-200);
  });
});

describe("ringInstrument uniform contract (a missing uniform THROWS on device)", () => {
  it("supplies every declared uniform with finite values", async () => {
    const { LAB_EFFECT_SOURCES } = await import("./labb-effects");
    const names = Array.from(
      LAB_EFFECT_SOURCES.ringInstrument.matchAll(
        /uniform\s+(?:float|float2|float3|float4|half4)\s+(\w+);/g,
      ),
      (m) => m[1],
    );
    // WP-2.1 added uSpin (switch spool-up).
    expect(names.length).toBe(6);
    const u = ringUniforms(
      [1, 0, 0, 1],
      [1, 1, 1, 1],
      [1, 0, 0.5, 2],
      [3, 1, 70, 36, 1, 2.5, 0.8],
      {
        mode: 0,
        alpha: 0.5,
        dashPeriod: 11,
        dashDuty: 0.6,
        farAlpha: 0.3,
        flowStrength: 0.7,
        flowOn: true,
      },
    );
    for (const name of names) expect(u).toHaveProperty(name);
    for (const v of Object.values(u)) {
      expect(v).toHaveLength(4);
      for (const n of v) expect(Number.isFinite(n)).toBe(true);
    }
    const off = ringUniforms(
      [1, 0, 0, 1],
      [1, 1, 1, 1],
      [1, 0, 0, 1],
      [3, 1, 70, 36, 1],
      {
        mode: 1,
        alpha: 0.1,
        dashPeriod: 0,
        dashDuty: 1,
        farAlpha: 0.3,
        flowStrength: 0.7,
        flowOn: false,
      },
    );
    expect(off.uFlow[1]).toBe(0);
    // Spool defaults to 0 when the flow array has no switch terms.
    expect(off.uSpin).toEqual([0, 0, 0, 0]);
    expect(u.uSpin).toEqual([2.5, 0.8, 0, 0]);
    const wakeNames = Array.from(
      LAB_EFFECT_SOURCES.ringWake.matchAll(
        /uniform\s+(?:float|float2|float3|float4|half4)\s+(\w+);/g,
      ),
      (m) => m[1],
    );
    const w = wakeUniforms([1, 1, 1, 1], 0.3, 1, 100, 2.6, 0.3, [1, 0, 0, 1]);
    expect(wakeNames).toHaveLength(3);
    for (const name of wakeNames) expect(w).toHaveProperty(name);
  });
});

describe("density fade (far zoom on dense Systems)", () => {
  it("median gap of the ring radii", () => {
    expect(typicalRingGap([100, 122, 144, 166, 400])).toBe(22);
    expect(typicalRingGap([50])).toBe(0);
  });
  it("full alpha when rings are far enough apart, floored when crowded", () => {
    expect(ringDensityFade(22, 1)).toBe(1);
    expect(ringDensityFade(22, 0.4)).toBeCloseTo(
      (22 * 0.4) / RING_CLUTTER_GAP_DP,
      9,
    );
    expect(ringDensityFade(22, 0.05)).toBe(RING_CLUTTER_FLOOR);
    expect(ringDensityFade(0, 1)).toBe(1);
  });
});
