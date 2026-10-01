/** Lab C strategy-map camera: one-finger orbit, orbit inertia, two-finger pan bounds. */
import { describe, expect, it } from "vitest";
import { type CameraPose, HOME_CAMERA, MAX_TILT } from "./orrery-camera-logic";
import {
  cameraGestureStep,
  ORBIT_TILT_PER_POINT,
  ORBIT_YAW_PER_POINT,
} from "./orrery-gesture-logic";
import {
  inertiaTarget,
  ORBIT_COAST_MAX_TILT,
  ORBIT_COAST_MAX_YAW,
} from "./orrery-recovery-logic";

const viewport = { width: 412, height: 800 };
const start: CameraPose = { ...HOME_CAMERA, zoom: 1, tilt: 1, yaw: 1 };

describe("strategy-map orbit camera", () => {
  it("one-finger drag orbits yaw/tilt about the pivot without moving it", () => {
    const next = cameraGestureStep(
      start,
      { kind: "orbit", dx: 10, dy: -10 },
      viewport,
      500,
    );
    expect(next.x).toBe(0);
    expect(next.y).toBe(0);
    expect(next.yaw).toBeCloseTo(1 - 10 * ORBIT_YAW_PER_POINT, 9);
    expect(next.tilt).toBeCloseTo(1 + 10 * ORBIT_TILT_PER_POINT, 9);
    const far = cameraGestureStep(
      start,
      { kind: "orbit", dx: 0, dy: -10_000 },
      viewport,
      500,
    );
    expect(far.tilt).toBe(MAX_TILT);
    expect(
      cameraGestureStep(
        start,
        { kind: "orbit", dx: Number.NaN, dy: 0 },
        viewport,
        500,
      ),
    ).toBe(start);
  });
  it("orbit inertia is capped and disabled under Reduced Motion", () => {
    const flick = inertiaTarget(
      start,
      "orbit",
      -1e6,
      -1e6,
      500,
      viewport,
      false,
    );
    expect(flick.yaw).toBeCloseTo(1 + ORBIT_COAST_MAX_YAW, 9);
    expect(flick.tilt).toBeCloseTo(
      Math.min(MAX_TILT, 1 + ORBIT_COAST_MAX_TILT),
      9,
    );
    expect(inertiaTarget(start, "orbit", 500, 0, 500, viewport, true)).toBe(
      start,
    );
  });
  it("two-finger pan keeps the pivot inside the system bounds", () => {
    let pose = start;
    for (let i = 0; i < 200; i++)
      pose = cameraGestureStep(
        pose,
        { kind: "pan", dx: 400, dy: 400 },
        viewport,
        300,
      );
    expect(Math.abs(pose.x)).toBeLessThanOrEqual(300);
    expect(Math.abs(pose.y)).toBeLessThanOrEqual(300);
  });
});
