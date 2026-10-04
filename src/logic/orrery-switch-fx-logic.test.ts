import { describe, expect, it, vi } from "vitest";

vi.mock("react-native-reanimated", () => ({
  cancelAnimation: vi.fn(),
  ReduceMotion: { Never: "never" },
  runOnJS: (fn: unknown) => fn,
  runOnUI: (fn: unknown) => fn,
  useAnimatedReaction: vi.fn(),
  useSharedValue: (value: unknown) => ({ value }),
  withTiming: (value: unknown) => value,
}));

import {
  NORMAL_SWITCH_DURATION_MS,
  REDUCED_SWITCH_DURATION_MS,
  sampleOrrerySwitchCamera,
} from "@/components/orrery/use-orrery-switch-runtime";
import {
  SWITCH_BREATH_PULLBACK,
  SWITCH_BREATH_TILT,
} from "@/components/orrery/v2/visual-tunables";
import type { CameraPose } from "./orrery-camera-logic";
import {
  beginSwitchChoreography,
  INTERACTION_READY_PROGRESS,
  type SwitchChoreography,
} from "./orrery-switch-choreography";
import {
  SKY_HUE_START,
  sampleSwitchSignal,
  switchBreath,
  switchSkyHueWeight,
  switchSwirlYaw,
  switchVelocity,
} from "./orrery-switch-fx-logic";

const world = [
  { id: 0, kind: "sun" as const, x: 0, y: 0, radius: 18, ringRadius: 0 },
  { id: 1, kind: "contact" as const, x: 0, y: -80, radius: 12, ringRadius: 80 },
];
const other = [
  world[0],
  { id: 2, kind: "contact" as const, x: 90, y: 0, radius: 12, ringRadius: 90 },
];
const switchOf = (intensity: number, reducedMotion = false) =>
  beginSwitchChoreography(world, other, 2, { intensity, reducedMotion });
const STEPS = Array.from({ length: 101 }, (_, i) => i / 100);
const TAU = Math.PI * 2;
const wrap = (a: number) => ((a % TAU) + TAU) % TAU;

describe("the switch signal (38.7-13: D-24, D-32, D-53)", () => {
  it("keeps the production durations and readiness unchanged", () => {
    expect(NORMAL_SWITCH_DURATION_MS).toBe(2100);
    expect(REDUCED_SWITCH_DURATION_MS).toBe(180);
    expect(INTERACTION_READY_PROGRESS).toBe(0.82);
  });

  it("every spectacle envelope is zero at progress 0 and 1, rises mid-switch, and is finite", () => {
    const transition = switchOf(1);
    for (const p of [0, 1]) {
      const s = sampleSwitchSignal(transition, p, NORMAL_SWITCH_DURATION_MS);
      expect([s.warp, s.trail, s.breath, s.swirl, s.angularSpeed]).toEqual([
        0, 0, 0, 0, 0,
      ]);
    }
    const mid = sampleSwitchSignal(transition, 0.5, NORMAL_SWITCH_DURATION_MS);
    expect(mid.warp).toBeCloseTo(1, 12); // full spin, intensity 1 (Lab B)
    expect(mid.trail).toBe(1);
    expect(mid.breath).toBeCloseTo(1, 12);
    expect(mid.angularSpeed).toBeGreaterThan(0);
    for (const p of STEPS) {
      const s = sampleSwitchSignal(transition, p, NORMAL_SWITCH_DURATION_MS);
      for (const v of Object.values(s))
        if (typeof v === "number") expect(Number.isFinite(v)).toBe(true);
      expect(s.warp).toBeGreaterThanOrEqual(0);
      expect(s.warp).toBeLessThanOrEqual(1);
    }
  });

  it("the warp follows the spin's speed with Lab B's intensity floor (0.35 + 0.65·i)", () => {
    const p = 0.4; // on the plateau
    expect(switchVelocity(p)).toBe(1);
    for (const intensity of [0.2, 0.6, 1])
      expect(
        sampleSwitchSignal(switchOf(intensity), p, NORMAL_SWITCH_DURATION_MS)
          .warp,
      ).toBeCloseTo(0.35 + 0.65 * intensity, 12);
    // Grows through ACCELERATE, relaxes through SETTLE.
    expect(switchVelocity(0.1)).toBeCloseTo(0.25, 12);
    expect(switchVelocity(0.86)).toBeCloseTo(0.25, 12);
  });

  it("reduced motion and a spinless (zero-intensity) switch carry no spectacle at any progress", () => {
    for (const transition of [switchOf(1, true), switchOf(0)])
      for (const p of STEPS) {
        const s = sampleSwitchSignal(transition, p, NORMAL_SWITCH_DURATION_MS);
        expect([s.warp, s.trail, s.breath, s.swirl, s.angularSpeed]).toEqual([
          0, 0, 0, 0, 0,
        ]);
      }
  });

  it("the sky hue crossfades over [0.55, 1] (Lab B); reduced motion over the whole switch", () => {
    expect(switchSkyHueWeight(0, false)).toBe(0);
    expect(switchSkyHueWeight(SKY_HUE_START, false)).toBe(0);
    expect(switchSkyHueWeight(0.775, false)).toBeCloseTo(0.5, 12);
    expect(switchSkyHueWeight(1, false)).toBe(1);
    expect(switchSkyHueWeight(0.5, true)).toBeCloseTo(0.5, 12);
    expect(switchSkyHueWeight(0, true)).toBe(0);
    // Settled: the incoming hue.
    expect(
      sampleSwitchSignal(switchOf(1), 1, NORMAL_SWITCH_DURATION_MS).skyHue,
    ).toBe(1);
  });

  it("the breath (Lab C) is sin²(πp): zero at both ends", () => {
    expect(switchBreath(0)).toBe(0);
    expect(switchBreath(1)).toBeCloseTo(0, 12);
    expect(switchBreath(0.5)).toBeCloseTo(1, 12);
  });
});

describe("the switch camera (D-53, C3-H1)", () => {
  const from: CameraPose = {
    x: 40,
    y: -30,
    zoom: 1.8,
    tilt: 0.9,
    yaw: 6.0, // just short of a full turn
    focalDistance: 300,
    lensShift: 0.7,
  };
  const home: CameraPose = {
    x: 0,
    y: 0,
    zoom: 0.9,
    tilt: 1.08,
    yaw: 0.1,
    focalDistance: 600,
    lensShift: 0.62,
  };
  const motionOf = (t: SwitchChoreography) => t;

  it("the yaw takes the SHORT way across the 0/2π wrap and lands exactly (no swirl authored)", () => {
    // 6.0 → 0.1 is +0.383 rad forward, not −5.9 back round.
    const yaws = STEPS.map((p) => switchSwirlYaw(6.0, 0.1, p, 0, 0));
    for (let i = 1; i < yaws.length; i++)
      expect(yaws[i]).toBeGreaterThanOrEqual(yaws[i - 1] - 1e-12);
    expect(yaws.at(-1)! - yaws[0]).toBeCloseTo(0.1 + TAU - 6.0, 12);
    expect(wrap(yaws.at(-1)!)).toBeCloseTo(0.1, 12);
    // The plain crossfade camera (reduced motion) takes the same short arc:
    // no frame-to-frame step is more than a sliver of a turn (the projection
    // wraps yaw mod 2π, so compare on the circle).
    const reduced = motionOf(switchOf(1, true));
    const travel = STEPS.map(
      (p) => sampleOrrerySwitchCamera(from, home, p, reduced).yaw ?? 0,
    );
    for (let i = 1; i < travel.length; i++) {
      const step = wrap(travel[i] - travel[i - 1]);
      expect(Math.min(step, TAU - step)).toBeLessThan(0.05);
    }
  });

  it("an authored swirl (fractional turns) swings out and back, landing exactly", () => {
    for (const turns of [0.1, 0.25, 0.6]) {
      expect(switchSwirlYaw(1, 2, 0, turns, 0)).toBe(1);
      const end = switchSwirlYaw(1, 2, 1, turns, 0);
      expect(end).toBeCloseTo(2, 12);
      // Mid-switch the swing adds `turns` of a turn at full envelope.
      expect(switchSwirlYaw(1, 1, 0.5, turns, 1)).toBeCloseTo(
        1 + TAU * turns,
        12,
      );
    }
  });

  it("with the spectacle: breath pulls back and flattens mid-switch, and the camera lands exactly at Home", () => {
    const spin = motionOf(switchOf(1));
    expect(sampleOrrerySwitchCamera(from, home, 0, spin)).toEqual(from);
    expect(sampleOrrerySwitchCamera(from, home, 1, spin)).toEqual(home);
    const plain = sampleOrrerySwitchCamera(
      from,
      home,
      0.5,
      motionOf(switchOf(0)),
    );
    const breathing = sampleOrrerySwitchCamera(from, home, 0.5, spin);
    expect(breathing.zoom).toBeCloseTo(
      plain.zoom * (1 - SWITCH_BREATH_PULLBACK),
      12,
    );
    expect(breathing.tilt).toBeCloseTo(
      Math.max(0, (plain.tilt ?? 0) + SWITCH_BREATH_TILT),
      12,
    );
    // Composition, not stacking: x/y/lens shift are the plain crossfade's.
    expect([breathing.x, breathing.y, breathing.lensShift]).toEqual([
      plain.x,
      plain.y,
      plain.lensShift,
    ]);
    // Continuous into both ends (no jump on the first or last frame).
    for (const [p, end] of [
      [1e-6, from],
      [1 - 1e-6, home],
    ] as const) {
      const near = sampleOrrerySwitchCamera(from, home, p, spin);
      expect(near.zoom).toBeCloseTo(end.zoom, 4);
      expect(wrap(near.yaw ?? 0)).toBeCloseTo(wrap(end.yaw ?? 0), 4);
      expect(near.tilt).toBeCloseTo(end.tilt ?? 0, 4);
    }
  });

  it("reduced motion is the plain crossfade: no swirl, no breath", () => {
    const reduced = motionOf(switchOf(1, true));
    const plain = motionOf(switchOf(0));
    for (const p of STEPS)
      expect(sampleOrrerySwitchCamera(from, home, p, reduced)).toEqual(
        sampleOrrerySwitchCamera(from, home, p, plain),
      );
  });
});
