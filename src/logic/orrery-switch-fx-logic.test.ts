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
  SWITCH_BREATH_YAW,
  SWITCH_YAW_PATH,
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
  switchBaseYaw,
  switchBreath,
  switchSkyHueWeight,
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
      expect([s.warp, s.trail, s.breath, s.angularSpeed]).toEqual([0, 0, 0, 0]);
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
        expect([s.warp, s.trail, s.breath, s.angularSpeed]).toEqual([
          0, 0, 0, 0,
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

describe("the switch camera is Lab C's (owner S-SWIRL pick; D-53, C3-H1)", () => {
  // Dolly-consistent poses (focal = 720 / zoom), as every V2 pose writer makes.
  const from: CameraPose = {
    x: 40,
    y: -30,
    zoom: 1.8,
    tilt: 0.9,
    yaw: 6.0, // just short of a full turn (stored yaw is in [0, 2π))
    focalDistance: 720 / 1.8,
    lensShift: 0.7,
  };
  const home: CameraPose = {
    x: 0,
    y: 0,
    zoom: 0.9,
    tilt: 1.08,
    yaw: 0, // Home's yaw
    focalDistance: 720 / 0.9,
    lensShift: 0.62,
  };
  const motionOf = (t: SwitchChoreography) => t;
  const smooth = (p: number) => p * p * (3 - 2 * p);

  /**
   * Lab C's switch camera, transcribed from its code
   * (orbit-orrery-lab-c `use-orrery-switch-runtime.ts` interpolateCamera +
   * `OrreryWorld3D.tsx` breath, SWITCH_PULLBACK 0.24 / SWITCH_YAW 0.38 /
   * SWITCH_TILT −0.1, labFocalDistance = 720 / zoom).
   */
  const labC = (p: number, intensity: number) => {
    const t = smooth(p);
    const mix = (a: number, b: number) => a + (b - a) * t;
    const s = Math.sin(Math.PI * p);
    const b = s * s * (0.5 + 0.5 * intensity);
    const zoom = mix(from.zoom, home.zoom) * (1 - 0.24 * b);
    return {
      x: mix(from.x, home.x),
      y: mix(from.y, home.y),
      zoom,
      focalDistance: 720 / zoom,
      yaw: mix(from.yaw!, home.yaw!) + 0.38 * b,
      tilt: Math.max(0, mix(from.tilt!, home.tilt!) - 0.1 * b),
    };
  };

  it("ships Lab C's numbers and Lab C's raw linear base yaw path", () => {
    expect(SWITCH_YAW_PATH).toBe("lab-c");
    expect(SWITCH_BREATH_PULLBACK).toBe(0.24);
    expect(SWITCH_BREATH_YAW).toBe(0.38);
    expect(SWITCH_BREATH_TILT).toBe(-0.1);
  });

  it("the camera matches Lab C's formula mid-switch (every axis Lab C draws)", () => {
    for (const intensity of [0.3, 1])
      for (const p of [0.1, 0.25, 0.5, 0.75, 0.9]) {
        const got = sampleOrrerySwitchCamera(
          from,
          home,
          p,
          motionOf(switchOf(intensity)),
        );
        const want = labC(p, intensity);
        for (const axis of [
          "x",
          "y",
          "zoom",
          "focalDistance",
          "yaw",
          "tilt",
        ] as const)
          expect(got[axis]).toBeCloseTo(want[axis], 10);
      }
  });

  it('"lab-c" is the raw linear yaw mix (6.0 → 0 travels back nearly a full turn); "shortest" takes the short arc', () => {
    for (const p of [0, 0.2, 0.5, 0.8, 1]) {
      const t = smooth(p);
      expect(switchBaseYaw(6.0, 0, t, "lab-c")).toBeCloseTo(6.0 - 6.0 * t, 12);
      expect(switchBaseYaw(6.0, 0, t, "shortest")).toBeCloseTo(
        6.0 + (TAU - 6.0) * t,
        12,
      );
    }
    expect(switchBaseYaw(6.0, 0, 1, "lab-c")).toBe(0);
    expect(wrap(switchBaseYaw(6.0, 0, 1, "shortest"))).toBeCloseTo(0, 12);
    // The plain crossfade camera (reduced motion) uses the shipped path.
    const reduced = motionOf(switchOf(1, true));
    for (const p of [0.2, 0.5, 0.8])
      expect(sampleOrrerySwitchCamera(from, home, p, reduced).yaw).toBeCloseTo(
        switchBaseYaw(6.0, 0, smooth(p), SWITCH_YAW_PATH),
        12,
      );
  });

  it("the yaw swing is out and back, peaking mid-switch at 0.38 × (0.5 + 0.5·intensity)", () => {
    for (const intensity of [0.3, 1]) {
      const spin = motionOf(switchOf(intensity));
      const plain = motionOf(switchOf(0));
      const swing = STEPS.map(
        (p) =>
          (sampleOrrerySwitchCamera(from, home, p, spin).yaw ?? 0) -
          (sampleOrrerySwitchCamera(from, home, p, plain).yaw ?? 0),
      );
      const peak = SWITCH_BREATH_YAW * (0.5 + 0.5 * intensity);
      expect(swing[50]).toBeCloseTo(peak, 12);
      expect(Math.max(...swing)).toBeCloseTo(peak, 12);
      expect(swing[0]).toBe(0);
      expect(swing[100]).toBe(0);
    }
  });

  it("with the spectacle: starts exactly at the drawn camera, lands exactly at Home, continuous into both ends", () => {
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
    // Composition, not stacking: x/y/lens shift are the plain crossfade's.
    expect([breathing.x, breathing.y, breathing.lensShift]).toEqual([
      plain.x,
      plain.y,
      plain.lensShift,
    ]);
    for (const [p, end] of [
      [1e-6, from],
      [1 - 1e-6, home],
    ] as const) {
      const near = sampleOrrerySwitchCamera(from, home, p, spin);
      expect(near.zoom).toBeCloseTo(end.zoom, 4);
      expect(near.focalDistance).toBeCloseTo(end.focalDistance ?? 0, 2);
      expect(near.yaw).toBeCloseTo(end.yaw ?? 0, 4);
      expect(near.tilt).toBeCloseTo(end.tilt ?? 0, 4);
    }
  });

  it("reduced motion (and a spinless switch) is the plain crossfade: no breath, no swing", () => {
    const reduced = motionOf(switchOf(1, true));
    const plain = motionOf(switchOf(0));
    for (const p of STEPS) {
      const r = sampleOrrerySwitchCamera(from, home, p, reduced);
      expect(r).toEqual(sampleOrrerySwitchCamera(from, home, p, plain));
      if (p > 0 && p < 1) {
        const t = smooth(p);
        expect(r.zoom).toBeCloseTo(from.zoom + (home.zoom - from.zoom) * t, 12);
        expect(r.yaw).toBeCloseTo(
          switchBaseYaw(6.0, 0, t, SWITCH_YAW_PATH),
          12,
        );
      }
    }
  });
});
