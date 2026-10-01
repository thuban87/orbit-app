import { describe, expect, it } from "vitest";
import {
  clampCameraPose,
  projectWorldPoint,
} from "@/logic/orrery-camera-logic";
import { projectAnimatedFrame } from "@/logic/orrery-frame";
import { beginSwitchChoreography } from "@/logic/orrery-switch-choreography";
import {
  computeBodyLight,
  computeSwitchFx,
  FX_ROLE_ENTERING,
  FX_ROLE_LEAVING,
  invertHomography,
  mapHomography,
  planeHomography,
  SWITCH_FX_IDLE,
} from "./deep-field-math";

const viewports = [
  { width: 412, height: 840 },
  {
    width: 412,
    height: 840,
    usable: { x: 0, y: 96, width: 412, height: 640 },
    obstacles: [{ x: 0, y: 760, width: 412, height: 80 }],
  },
];
const poses = [
  { x: 0, y: 0, zoom: 1, tilt: 0, yaw: 0 },
  { x: 30, y: -50, zoom: 2.3, tilt: 0.9, yaw: 0.7 },
  { x: -120, y: 80, zoom: 0.4, tilt: Math.PI / 3, yaw: 4.1 },
];
const points = [
  { x: 0, y: 0 },
  { x: 140, y: -60 },
  { x: -200, y: 210 },
  { x: 33, y: 300 },
];

describe("Lab A plane homography (read-only presentation math)", () => {
  it("matches projectWorldPoint exactly for every pose/viewport", () => {
    for (const viewport of viewports)
      for (const raw of poses) {
        const pose = clampCameraPose(raw, 400);
        const H = planeHomography(pose, viewport);
        for (const p of points) {
          const expected = projectWorldPoint(p, pose, viewport);
          const got = mapHomography(H, p.x, p.y);
          expect(got.x).toBeCloseTo(expected.x, 6);
          expect(got.y).toBeCloseTo(expected.y, 6);
          // The inverse recovers the world point (used for trail angles/shadows).
          const back = mapHomography(invertHomography(H), got.x, got.y);
          expect(back.x).toBeCloseTo(p.x, 5);
          expect(back.y).toBeCloseTo(p.y, 5);
        }
      }
  });
});

describe("Lab A switch FX", () => {
  const world = [
    {
      id: 1,
      kind: "contact" as const,
      x: 0,
      y: -60,
      radius: 16,
      ringRadius: 60,
    },
    { id: 0, kind: "sun" as const, x: 0, y: 0, radius: 30, ringRadius: 0 },
  ];
  const next = [
    {
      id: 2,
      kind: "contact" as const,
      x: 90,
      y: 0,
      radius: 16,
      ringRadius: 90,
    },
    { id: 0, kind: "sun" as const, x: 0, y: 0, radius: 30, ringRadius: 0 },
  ];
  const transition = beginSwitchChoreography(world, next, 3, {
    intensity: 1,
    reducedMotion: false,
  });
  it("is idle when settled, under live reduced motion, or for an RM choreography", () => {
    expect(computeSwitchFx(transition, 1, false)).toBe(SWITCH_FX_IDLE);
    expect(computeSwitchFx(transition, 0.5, true)).toBe(SWITCH_FX_IDLE);
    const rm = beginSwitchChoreography(world, next, 3, {
      intensity: 1,
      reducedMotion: true,
    });
    expect(computeSwitchFx(rm, 0.5, false)).toBe(SWITCH_FX_IDLE);
  });
  it("reports bounded velocity/flare and per-entry roles while running", () => {
    const mid = computeSwitchFx(transition, 0.63, false);
    expect(mid.active).toBe(true);
    expect(mid.velocity).toBeGreaterThan(0);
    expect(mid.velocity).toBeLessThanOrEqual(1);
    expect(mid.flare).toBeGreaterThan(0);
    expect(mid.flare).toBeLessThanOrEqual(1);
    const roles = transition.entries.map((e) => e.role);
    expect(mid.roles[roles.indexOf("leaving")]).toBe(FX_ROLE_LEAVING);
    expect(mid.roles[roles.indexOf("entering")]).toBe(FX_ROLE_ENTERING);
    for (const stage of mid.stages) {
      expect(stage).toBeGreaterThanOrEqual(0);
      expect(stage).toBeLessThanOrEqual(1);
    }
  });
});

describe("Lab A body light", () => {
  const bodies = [
    {
      id: 1,
      kind: "contact" as const,
      x: 0,
      y: -80,
      radius: 16,
      ringRadius: 80,
      opacity: 1,
      interactive: true,
    },
    {
      id: 0,
      kind: "sun" as const,
      x: 0,
      y: 0,
      radius: 30,
      ringRadius: 0,
      opacity: 1,
      interactive: true,
    },
  ];
  it("points each body at the sun and has no far tint at tilt 0", () => {
    const frame = projectAnimatedFrame(
      { generation: 1, from: bodies, to: bodies },
      1,
      { x: 0, y: 0, zoom: 1, tilt: 0, yaw: 0 },
      { width: 400, height: 800 },
    );
    const light = computeBodyLight(frame, 100)["contact:1"];
    expect(light[0]).toBeCloseTo(0, 6);
    expect(light[1]).toBeCloseTo(1, 6); // sun is below (screen +y)
    expect(light[2]).toBe(0);
  });
  it("tints the far side when tilted and never mutates the frame", () => {
    const frame = projectAnimatedFrame(
      { generation: 1, from: bodies, to: bodies },
      1,
      { x: 0, y: 0, zoom: 1, tilt: 0.9, yaw: 0 },
      { width: 400, height: 800 },
    );
    const before = JSON.stringify(frame);
    expect(computeBodyLight(frame, 100)["contact:1"][2]).toBeGreaterThan(0);
    expect(JSON.stringify(frame)).toBe(before);
  });
});
