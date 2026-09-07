import { describe, expect, it } from "vitest";
import {
  clampCameraPose,
  HOME_CAMERA,
  projectWorldPoint,
} from "./orrery-camera-logic";
import {
  type CameraRecovery,
  createCameraMotion,
  inertiaTarget,
  type MotionRequest,
  northTarget,
  planRecovery,
  polarisProjection,
  recoveryCurve,
  sampleRecovery,
} from "./orrery-recovery-logic";

const extent = 500;
const home = clampCameraPose(HOME_CAMERA, extent);
describe("bounded camera recovery", () => {
  it("new manual input, live Reduced Motion and blur invalidate old completions", () => {
    const pose = { value: home },
      epoch = { value: 0 },
      active = { value: null as MotionRequest | null },
      live = { value: true },
      reduced = { value: false };
    const scheduled: {
      plan: CameraRecovery;
      finish: (finished: boolean) => void;
    }[] = [];
    const camera = createCameraMotion({
      pose,
      epoch,
      active,
      live,
      reduced,
      extent,
      viewport: { width: 400, height: 600 },
      cancel: () => {},
      animate: (plan, finish) => scheduled.push({ plan, finish }),
    });
    camera.recover({ ...home, x: 200 });
    pose.value = sampleRecovery(scheduled[0].plan, 0.2);
    camera.stop();
    const manual = { ...pose.value, x: 30 };
    pose.value = manual;
    scheduled[0].finish(true);
    expect(pose.value).toEqual(manual);
    camera.recover(home);
    reduced.value = true;
    camera.motionChanged();
    expect(scheduled[2].plan.reduced).toBe(true);
    scheduled[1].finish(true);
    expect(pose.value).toEqual(manual);
    scheduled[2].finish(true);
    expect(pose.value).toEqual(home);
    reduced.value = false;
    camera.coast("pan", 200, 0);
    reduced.value = true;
    camera.motionChanged();
    expect(active.value).toBeNull();
    scheduled[3].finish(true);
    expect(pose.value).toEqual(home);
    camera.recover({ ...home, x: 90 });
    live.value = false;
    camera.stop();
    scheduled[4].finish(true);
    expect(pose.value).toEqual(home);
  });
  it("zero/small/large recovery is finite, distance-adaptive, continuous and exact", () => {
    const zero = planRecovery(home, home, extent, false);
    const small = planRecovery({ ...home, x: 2 }, home, extent, false);
    const large = planRecovery(
      { ...home, x: 500, y: -500, zoom: 4, tilt: 1, yaw: 3 },
      home,
      extent,
      false,
    );
    expect(zero.duration).toBeLessThanOrEqual(small.duration);
    expect(small.duration).toBeLessThan(large.duration);
    expect(large.duration).toBeLessThanOrEqual(850);
    for (const plan of [zero, small, large]) {
      expect(sampleRecovery(plan, 0)).toEqual(plan.from);
      expect(sampleRecovery(plan, 1)).toEqual(home);
      let previous = 0;
      for (let i = 0; i <= 1000; i++) {
        const t = i / 1000;
        const progress = recoveryCurve(t);
        expect(progress).toBeGreaterThanOrEqual(previous);
        expect(progress - previous).toBeLessThan(0.01);
        previous = progress;
        expect(
          Object.values(sampleRecovery(plan, t)).every(Number.isFinite),
        ).toBe(true);
      }
    }
  });
  it("north follows the shortest wrap and preserves every other axis", () => {
    const start = {
      ...home,
      x: 30,
      y: 20,
      zoom: 2,
      tilt: 0.5,
      yaw: 2 * Math.PI - 0.2,
    };
    const target = northTarget(start);
    expect(target).toEqual({ ...start, yaw: 0 });
    const plan = planRecovery(start, target, extent, false);
    expect(plan.animatedTarget.yaw).toBeCloseTo(2 * Math.PI);
    expect(sampleRecovery(plan, 0.5).x).toBe(start.x);
    expect(sampleRecovery(plan, 1)).toEqual(target);
  });
  it("Reduced Motion is short/direct and disables pan/yaw continuation; no zoom/tilt coast", () => {
    const target = { ...home, x: 100 };
    const reduced = planRecovery(home, target, extent, true);
    expect(reduced.duration).toBeLessThanOrEqual(120);
    expect(sampleRecovery(reduced, 0.5).x).toBe(50);
    expect(
      inertiaTarget(
        home,
        "pan",
        99999,
        -99999,
        extent,
        { width: 400, height: 600 },
        true,
      ),
    ).toEqual(home);
    for (const kind of ["pan", "yaw"] as const) {
      const next = inertiaTarget(
        home,
        kind,
        99999,
        -99999,
        extent,
        { width: 400, height: 600 },
        false,
      );
      expect(Math.abs(next.x)).toBeLessThanOrEqual(18);
      expect(Math.abs(next.y)).toBeLessThanOrEqual(18);
      expect(
        Math.min(next.yaw ?? 0, 2 * Math.PI - (next.yaw ?? 0)),
      ).toBeLessThanOrEqual(0.08 + 1e-12);
      expect(next.zoom).toBe(home.zoom);
      expect(next.tilt).toBe(home.tilt);
    }
  });
  it("Polaris projects canonical north through the same finite camera at extreme legal poses", () => {
    const viewport = { width: 400, height: 600 };
    const north = polarisProjection(
      {
        generation: 1,
        pose: home,
        viewport,
        bodies: [],
        center: { x: 200, y: 300 },
      },
      extent,
    );
    expect(north.y).toBeLessThan(300);
    const yaw = polarisProjection(
      {
        generation: 1,
        pose: { ...home, yaw: Math.PI / 2 },
        viewport,
        bodies: [],
        center: { x: 200, y: 300 },
      },
      extent,
    );
    expect(yaw.x).toBeGreaterThan(200);
    for (const e of [1, 20, 500, 10000]) {
      const pose = clampCameraPose(
        { x: e, y: e, zoom: 4, tilt: Math.PI / 3, yaw: Math.PI },
        Math.max(e, 32),
      );
      const point = polarisProjection(
        {
          generation: 1,
          pose,
          viewport,
          bodies: [],
          center: projectWorldPoint({ x: 0, y: 0 }, pose, viewport),
        },
        e,
      );
      expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
    }
  });
});
