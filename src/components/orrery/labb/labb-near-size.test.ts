import { describe, expect, it } from "vitest";
import {
  MIN_HIT_RADIUS,
  type ProjectedBody,
  type ProjectedFrame,
} from "@/logic/orrery-camera-logic";
import {
  labClampNearSizes,
  labNearPerspectiveScale,
  labSoftCap,
  NEAR_PERSPECTIVE_KNEE,
  NEAR_RADIUS_FRACTION,
} from "./labb-near-size";

function body(
  id: number,
  radius: number,
  depth: number,
  kind: ProjectedBody["kind"] = "contact",
): ProjectedBody {
  return {
    id,
    kind,
    x: 100,
    y: 100,
    radius,
    ringRadius: 0,
    hitRadius: Math.max(MIN_HIT_RADIUS, radius),
    ringPath: [],
    depth,
  };
}

function frame(bodies: ProjectedBody[]): ProjectedFrame {
  return {
    generation: 1,
    pose: { x: 0, y: 0, zoom: 3.2, tilt: 0.56, yaw: 0, focalDistance: 400 },
    viewport: { width: 400, height: 800 },
    bodies,
    center: { x: 200, y: 400 },
  };
}

describe("R3 near-body size clamp", () => {
  it("soft cap is the identity below the knee and never exceeds the cap", () => {
    expect(labSoftCap(10, 20, 30)).toBe(10);
    expect(labSoftCap(25, 20, 30)).toBeGreaterThan(20);
    expect(labSoftCap(25, 20, 30)).toBeLessThan(25);
    expect(labSoftCap(1e6, 20, 30)).toBeLessThanOrEqual(30);
  });

  it("limits perspective growth to the knee and leaves the far side alone", () => {
    expect(labNearPerspectiveScale(-80, 400)).toBe(1);
    const p = 400 / (400 - 120);
    const s = labNearPerspectiveScale(120, 400);
    expect(p * s).toBeLessThanOrEqual(1 + NEAR_PERSPECTIVE_KNEE + 1e-9);
    expect(p * s).toBeGreaterThan(1);
  });

  it("off returns the same frame; on keeps positions/depth, exempts the sun and keeps the hit floor", () => {
    const f = frame([
      body(0, 120, 100, "sun"),
      body(1, 80, 150),
      body(2, 6, -50),
    ]);
    expect(labClampNearSizes(f, false)).toBe(f);
    const out = labClampNearSizes(f, true);
    const cap = 400 * NEAR_RADIUS_FRACTION;
    expect(out.bodies[0]).toBe(f.bodies[0]);
    expect(out.bodies[1].radius).toBeLessThanOrEqual(cap);
    expect(out.bodies[1].hitRadius).toBe(
      Math.max(MIN_HIT_RADIUS, out.bodies[1].radius),
    );
    expect(out.bodies[1].x).toBe(100);
    expect(out.bodies[1].depth).toBe(150);
    expect(out.bodies[2]).toBe(f.bodies[2]);
  });

  it("returns the same frame object when nothing needs clamping", () => {
    const f = frame([body(1, 8, -10), body(2, 9, 0)]);
    expect(labClampNearSizes(f, true)).toBe(f);
  });
});
