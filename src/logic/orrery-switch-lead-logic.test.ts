/**
 * 38.7-15 (D-76): the switch lead-in — motion from the tap, and a hand-off to
 * the real switch that is continuous in position, spin speed, signal and
 * camera, and still lands exactly at the destination (Plan 13's guarantees).
 */
import { describe, expect, it, vi } from "vitest";

// The runtime module's samplers are pure; its hooks are not used here.
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
  sampleOrrerySwitchCamera,
  sampleSwitchLeadCamera,
} from "@/components/orrery/use-orrery-switch-runtime";
import type { CameraPose, WorldBody } from "./orrery-camera-logic";
import {
  ACCELERATE_END,
  beginSettledSwitchChoreography,
  beginSwitchChoreography,
  sampleSwitchChoreography,
} from "./orrery-switch-choreography";
import { switchVelocity } from "./orrery-switch-fx-logic";
import {
  beginSwitchLead,
  NO_SWITCH_LEAD,
  rotateSwitchWorld,
  SWITCH_LEAD_COAST,
  SWITCH_LEAD_INTENSITY,
  SWITCH_LEAD_MAX_MS,
  SWITCH_LEAD_REST_MS,
  sampleSwitchLead,
  sampleSwitchSignalWithLead,
  sampleSwitchWorld,
  switchLeadCarry,
  switchLeadCoastOffset,
  switchLeadCoastStart,
  switchLeadMoving,
  switchLeadPlateau,
  switchLeadVelocity,
} from "./orrery-switch-lead-logic";

const D = NORMAL_SWITCH_DURATION_MS;
const source: WorldBody[] = [
  { id: 0, kind: "sun", x: 0, y: 0, radius: 18, ringRadius: 0 },
  { id: 1, kind: "contact", x: 0, y: -80, radius: 12, ringRadius: 80 },
  { id: 2, kind: "contact", x: 90, y: 0, radius: 12, ringRadius: 90 },
];
const destination: WorldBody[] = [
  { id: 0, kind: "sun", x: 0, y: 0, radius: 18, ringRadius: 0 },
  { id: 2, kind: "contact", x: 0, y: 96, radius: 12, ringRadius: 96 },
  { id: 3, kind: "contact", x: -110, y: 0, radius: 12, ringRadius: 110 },
];
const pose: CameraPose = {
  x: 4,
  y: -6,
  zoom: 1.3,
  tilt: 0.9,
  yaw: 0.2,
  focalDistance: 300,
  lensShift: 1,
};
const home: CameraPose = { ...pose, x: 0, y: 0, zoom: 1, yaw: 0 };
const angle = (b: { x: number; y: number }) => Math.atan2(b.x, -b.y);
const visible = <B extends { opacity: number }>(world: readonly B[]): B[] =>
  world.filter((body) => body.opacity > 0);

/** The switch that takes over a lead-in at `clockMs` (as `publish` builds it). */
function handOff(clockMs: number) {
  const settled = beginSettledSwitchChoreography(source, 1, false);
  const lead = beginSwitchLead(SWITCH_LEAD_INTENSITY);
  const now = sampleSwitchLead(lead, clockMs, D);
  const drawn = rotateSwitchWorld(
    sampleSwitchChoreography(settled, 1).world,
    now.rotation,
  );
  const carry = switchLeadCarry(now);
  const next = beginSwitchChoreography(
    rotateSwitchWorld(
      sampleSwitchChoreography(settled, 1).world,
      now.rotation + switchLeadCoastStart(carry),
    ),
    destination,
    2,
    { intensity: 0.5, reducedMotion: false },
  );
  return { settled, lead, now, drawn, switch: { ...next, lead: carry } };
}

describe("the lead-in opens like a switch (D-76)", () => {
  it("accelerates exactly as a switch's ACCELERATE phase, then holds its plateau", () => {
    for (const p of [0, 0.05, 0.1, 0.15, 0.199])
      expect(switchLeadVelocity(p)).toBeCloseTo(switchVelocity(p), 12);
    expect(switchLeadVelocity(0.5)).toBe(1);
    expect(switchLeadVelocity(3)).toBe(1); // a slow load keeps spinning
  });

  it("moves from the first frames after the tap (well inside 100–200 ms)", () => {
    const lead = beginSwitchLead(SWITCH_LEAD_INTENSITY);
    const at = (ms: number) => sampleSwitchLead(lead, ms, D);
    expect(at(0).rotation).toBe(0);
    // ~120 ms: the outer contact (r = 90) has visibly moved and the camera breathes.
    expect(at(120).rotation * 90).toBeGreaterThan(0.5);
    expect(at(120).breath).toBeGreaterThan(0);
    expect(at(120).warp).toBeGreaterThan(0);
    // The rotation's rate is ω = plateau × velocity.
    const t = 900;
    const h = 1e-3;
    const rate = (at(t + h).rotation - at(t - h).rotation) / ((2 * h) / D);
    expect(rate).toBeCloseTo(switchLeadPlateau(lead.turns), 4);
  });

  it("IN-05: a load slower than the clock's ceiling coasts everything back to rest together — spin, warp, streaks and breath — never a frozen spin under full streaks", () => {
    const lead = beginSwitchLead(SWITCH_LEAD_INTENSITY);
    const at = (ms: number) => sampleSwitchLead(lead, ms, D);
    const restStart = SWITCH_LEAD_MAX_MS - SWITCH_LEAD_REST_MS;
    // The plateau holds until the rest window.
    expect(at(restStart - 1).velocity).toBe(1);
    expect(at(restStart - 1).breath).toBeCloseTo(at(5_000).breath, 12);
    // Inside it every level eases down together, monotonically.
    let previous = at(restStart);
    for (let ms = restStart + 100; ms <= SWITCH_LEAD_MAX_MS; ms += 100) {
      const now = at(ms);
      for (const key of ["velocity", "warp", "trail", "breath"] as const)
        expect(now[key]).toBeLessThanOrEqual(previous[key] + 1e-12);
      // The world keeps turning forward (never backward) while it slows.
      expect(now.rotation).toBeGreaterThanOrEqual(previous.rotation);
      previous = now;
    }
    // At the ceiling (and after it: the clock stops there) all is at rest.
    for (const ms of [SWITCH_LEAD_MAX_MS, SWITCH_LEAD_MAX_MS + 5_000]) {
      const s = at(ms);
      expect([s.velocity, s.omega, s.warp, s.trail, s.breath]).toEqual([
        0, 0, 0, 0, 0,
      ]);
      expect(s.angularSpeed).toBe(0);
      expect(s.rotation).toBeCloseTo(at(SWITCH_LEAD_MAX_MS).rotation, 9);
    }
    // The rotation is continuous and its rate is plateau × velocity throughout.
    const h = 1e-3;
    for (const t of [restStart - 50, restStart + 1, restStart + 900, 59_990]) {
      const rate = (at(t + h).rotation - at(t - h).rotation) / ((2 * h) / D);
      expect(rate).toBeCloseTo(at(t).omega, 3);
    }
    // At rest the lead no longer counts as motion (busy clears).
    expect(switchLeadMoving(lead, restStart)).toBe(true);
    expect(switchLeadMoving(lead, SWITCH_LEAD_MAX_MS)).toBe(false);
    expect(switchLeadMoving(NO_SWITCH_LEAD, 0)).toBe(false);
  });

  it("under reduced motion (still) it holds: no warp, streaks or breath", () => {
    const still = { ...beginSwitchLead(SWITCH_LEAD_INTENSITY), still: true };
    const s = sampleSwitchLead(still, 800, D);
    expect([s.warp, s.trail, s.breath, s.velocity, s.omega]).toEqual([
      0, 0, 0, 0, 0,
    ]);
  });
});

describe("the hand-off to the real switch is continuous and lands exactly", () => {
  it.each([[150], [420], [2400]])(
    "at %s ms: the switch's first frame is the lead's last (position)",
    (ms) => {
      const h = handOff(ms);
      const first = visible(sampleSwitchWorld(h.switch, 0));
      for (const body of visible(h.drawn)) {
        const twin = first.find((b) => b.id === body.id);
        expect(twin?.x).toBeCloseTo(body.x, 9);
        expect(twin?.y).toBeCloseTo(body.y, 9);
      }
    },
  );

  it("the spin speed carries through the hand-off (no stop-and-restart)", () => {
    const h = handOff(2400); // on the plateau
    const retained = (p: number) =>
      sampleSwitchWorld(h.switch, p).find((b) => b.id === 2) as WorldBody;
    const dp = 1e-4;
    const after = (angle(retained(dp)) - angle(retained(0))) / dp;
    expect(after).toBeCloseTo(h.now.omega, 2);
    // Mid-window the inherited coast and the switch's own spin share the load.
    expect(switchLeadCoastOffset(switchLeadCarry(h.now), 0)).toBeCloseTo(
      -switchLeadCoastStart(switchLeadCarry(h.now)),
      12,
    );
  });

  it("the coast is exactly zero from the end of the accelerate window, so the landing is unchanged", () => {
    const h = handOff(1200);
    const carry = h.switch.lead;
    for (const p of [SWITCH_LEAD_COAST, 0.5, 0.99, 1])
      expect(switchLeadCoastOffset(carry, p)).toBe(0);
    const landed = visible(sampleSwitchWorld(h.switch, 1));
    expect(landed.map(({ id, x, y }) => ({ id, x, y }))).toEqual(
      destination.map(({ id, x, y }) => ({ id, x, y })),
    );
    expect(SWITCH_LEAD_COAST).toBe(ACCELERATE_END);
  });

  it("warp, streaks and breath continue from the lead's levels into the switch's", () => {
    const h = handOff(2400);
    const lead = sampleSwitchSignalWithLead(h.settled, 1, D, h.lead, 2400);
    const first = sampleSwitchSignalWithLead(h.switch, 0, D, NO_SWITCH_LEAD, 0);
    expect(first.warp).toBeCloseTo(lead.warp, 9);
    expect(first.trail).toBeCloseTo(lead.trail, 9);
    expect(first.breath).toBeCloseTo(lead.breath, 9);
    expect(first.angularSpeed).toBeCloseTo(lead.angularSpeed, 9);
    expect(lead.running).toBe(true);
    // After the window only the switch's own signal remains.
    const plain = { ...h.switch, lead: undefined };
    expect(
      sampleSwitchSignalWithLead(h.switch, 0.5, D, NO_SWITCH_LEAD, 0),
    ).toEqual(sampleSwitchSignalWithLead(plain, 0.5, D, NO_SWITCH_LEAD, 0));
  });

  it("the camera: the switch starts at the lead's breathing camera and lands exactly at Home", () => {
    const h = handOff(2400);
    const leadCamera = sampleSwitchLeadCamera(pose, h.now.breath);
    const start = sampleOrrerySwitchCamera(pose, home, 0, h.switch);
    for (const key of [
      "x",
      "y",
      "zoom",
      "tilt",
      "yaw",
      "focalDistance",
    ] as const)
      expect(start[key]).toBeCloseTo(leadCamera[key] as number, 9);
    expect(sampleOrrerySwitchCamera(pose, home, 1, h.switch)).toEqual(home);
  });

  it("a switch with no lead is sampled exactly as before", () => {
    const plain = beginSwitchChoreography(source, destination, 2, {
      intensity: 0.7,
      reducedMotion: false,
    });
    for (const p of [0, 0.1, 0.5, 1])
      expect(sampleSwitchWorld(plain, p)).toEqual(
        sampleSwitchChoreography(plain, p).world,
      );
  });
});
