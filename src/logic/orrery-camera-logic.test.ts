import { describe, expect, it } from "vitest";
import {
  anchorCameraPose,
  clampCameraPose,
  coreRadius,
  deriveFocalDistance,
  deriveHomePose,
  frameBodies,
  HOME_CAMERA,
  LAB_CORE_FRACTION,
  LAB_CORE_TILT,
  LAB_HOME_TILT,
  MAX_TILT,
  MAX_ZOOM,
  MIN_READABLE_RADIUS,
  MIN_ZOOM,
  panCamera,
  perspectiveScale,
  projectFrame,
  projectWorldPoint,
  unprojectToWorldPlane,
  usableCameraRect,
  type WorldBody,
} from "@/logic/orrery-camera-logic";

const viewport = { width: 400, height: 600 };
const body = (x: number, y: number, radius = 16, id = 1): WorldBody => ({
  x,
  y,
  radius,
  id,
  kind: "contact",
  ringRadius: Math.hypot(x, y),
});
describe("bounded invertible inspection camera", () => {
  it("keeps large drags and pinches on sky finite at maximum tilt and minimum zoom", () => {
    const pose = clampCameraPose(
      { ...HOME_CAMERA, zoom: MIN_ZOOM, tilt: MAX_TILT },
      100,
    );
    for (const dy of [-10000, -600, 0, 600, 10000]) {
      const pan = panCamera(pose, 600, dy, 100, viewport);
      expect(Object.values(pan).every(Number.isFinite)).toBe(true);
      expect(Math.abs(pan.x)).toBeLessThanOrEqual(100);
      expect(Math.abs(pan.y)).toBeLessThanOrEqual(100);
    }
    expect(
      Object.values(
        anchorCameraPose(
          pose,
          { ...pose, zoom: 4 },
          { x: 0, y: 0 },
          viewport,
          100,
        ),
      ).every(Number.isFinite),
    ).toBe(true);
  });
  it("clamps zoom/tilt/pan and wraps yaw at exact boundaries and neighboring epsilon", () => {
    for (const boundary of [MIN_ZOOM, MAX_ZOOM])
      for (const delta of [-1e-8, 0, 1e-8]) {
        const pose = clampCameraPose(
          { ...HOME_CAMERA, zoom: boundary + delta },
          1000,
        );
        expect(pose.zoom).toBe(
          Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, boundary + delta)),
        );
      }
    for (const boundary of [0, MAX_TILT])
      for (const delta of [-1e-8, 0, 1e-8])
        expect(
          clampCameraPose({ ...HOME_CAMERA, tilt: boundary + delta }, 1000)
            .tilt,
        ).toBe(Math.max(0, Math.min(MAX_TILT, boundary + delta)));
    for (const x of [-1000 - 1e-8, -1000, 1000, 1000 + 1e-8])
      expect(
        Math.abs(clampCameraPose({ ...HOME_CAMERA, x }, 1000).x),
      ).toBeLessThanOrEqual(1000);
    expect(
      clampCameraPose({ ...HOME_CAMERA, yaw: Math.PI * 8 }, 1000).yaw,
    ).toBe(0);
    const invalid = clampCameraPose(
      {
        x: NaN,
        y: Infinity,
        zoom: NaN,
        tilt: Infinity,
        yaw: NaN,
        focalDistance: -1,
      },
      1000,
    );
    expect(Object.values(invalid).every(Number.isFinite)).toBe(true);
  });
  // Lab C true-3D camera: zoom is a DOLLY (focal = LAB_FOCAL_PX / zoom), so at
  // close dolly + steep tilt some far points sit at/behind the near plane. The
  // contract is now: the scale stays positive and finite (clamped at 1/0.02,
  // never NaN/negative), and every point in front of the renderer's near-cull
  // plane (orrery-frame-lite NEAR_CULL_FRACTION = 0.12) round-trips exactly.
  it("keeps a positive, bounded perspective scale and round trips every point in front of the near plane", () => {
    for (const extent of [30, 300, 5000])
      for (const tilt of [0, MAX_TILT / 2, MAX_TILT])
        for (const yaw of [0, Math.PI / 2, Math.PI, Math.PI * 2 - 1e-8])
          for (const zoom of [MIN_ZOOM, MAX_ZOOM])
            for (const pan of [-extent, 0, extent]) {
              const pose = clampCameraPose(
                { x: pan, y: pan, zoom, tilt, yaw },
                extent,
              );
              for (const point of [
                { x: 0, y: 0 },
                { x: extent, y: 0 },
                { x: 0, y: -extent },
                { x: 0, y: extent },
              ]) {
                const scale = perspectiveScale(point, pose);
                expect(scale).toBeGreaterThan(0);
                expect(Number.isFinite(scale)).toBe(true);
                expect(scale).toBeLessThanOrEqual(1 / 0.02 + 1e-9);
                if (scale >= 1 / 0.12) continue; // culled by the renderer
                const screen = projectWorldPoint(point, pose, viewport);
                // Near-horizon band: unprojection deliberately clamps sky /
                // grazing rays to a far plane point (no throw), so only rays
                // clear of that guard (denominator ≥ 5% focal) must round trip.
                const focal = pose.focalDistance ?? 1;
                const sy = (screen.y - viewport.height / 2) / pose.zoom;
                const tilt = pose.tilt ?? 0;
                if (focal * Math.cos(tilt) + sy * Math.sin(tilt) < focal * 0.05)
                  continue;
                const recovered = unprojectToWorldPlane(screen, pose, viewport);
                expect(
                  Math.hypot(recovered.x - point.x, recovered.y - point.y),
                  JSON.stringify({ extent, tilt, yaw, zoom, pan, point }),
                ).toBeLessThanOrEqual(1e-6);
              }
            }
  });
  it("projects near/far billboard mass, rings and world north through exactly the same camera", () => {
    const world = [body(0, 100), body(0, -100, 16, 2)];
    const pose = clampCameraPose({ ...HOME_CAMERA, tilt: MAX_TILT }, 120);
    const frame = projectFrame(world, pose, viewport, 1);
    expect(frame.bodies[0].radius).toBeGreaterThan(frame.bodies[1].radius);
    expect(frame.bodies[0].ringPath[0]).toEqual(
      projectWorldPoint({ x: 0, y: -100 }, frame.pose, viewport),
    );
    expect(frame.bodies[0].hitRadius).toBeGreaterThanOrEqual(
      frame.bodies[0].radius,
    );
    expect(deriveFocalDistance(5000)).toBeGreaterThan(deriveFocalDistance(300));
  });
  // Lab C Home: a tilted strategy-map pose (LAB_HOME_TILT) that never drops
  // below the readability floor for normal Systems; Systems with more than
  // LAB_CORE_MIN_CONTACTS frame their populated core at LAB_CORE_TILT instead
  // (Checkpoint D.1 — the one deliberate count branch, legibility then comes
  // from the renderer's minimum on-screen body size).
  it("Home is a tilted strategy map above the readability floor; dense Systems frame their core", () => {
    const empty = deriveHomePose([], viewport)!;
    expect(empty).toMatchObject({ x: 0, y: 0, tilt: LAB_HOME_TILT, yaw: 0 });
    expect(Number.isFinite(empty.zoom)).toBe(true);
    for (const count of [1, 6, 10, 24]) {
      const world = Array.from({ length: count }, (_, i) =>
        body(0, -58 - i * 34, 16, i + 1),
      );
      const pose = deriveHomePose(world, viewport)!;
      expect(pose.zoom * 16).toBeGreaterThanOrEqual(MIN_READABLE_RADIUS);
      expect(pose).toMatchObject({ x: 0, y: 0, tilt: LAB_HOME_TILT, yaw: 0 });
    }
    const dense = Array.from({ length: 100 }, (_, i) =>
      body(0, -58 - i * 34, 16, i + 1),
    );
    const densePose = deriveHomePose(dense, viewport)!;
    expect(densePose).toMatchObject({
      x: 0,
      y: 0,
      tilt: LAB_CORE_TILT,
      yaw: 0,
    });
    const core = coreRadius(dense, LAB_CORE_FRACTION);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const p = projectWorldPoint(
        { x: Math.cos(a) * core, y: Math.sin(a) * core },
        densePose,
        viewport,
      );
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(viewport.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(viewport.height);
    }
    const floor = MIN_READABLE_RADIUS / 16;
    const radius = 200 / floor - 16;
    for (const delta of [-1e-6, 0, 1e-6]) {
      const pose = deriveHomePose([body(0, -radius - delta)], viewport)!;
      // The top-down fit is the floor; the tilted Home may only dolly IN.
      expect(pose.zoom).toBeGreaterThanOrEqual(
        Math.max(floor, 200 / (radius + delta + 16)) - 1e-9,
      );
    }
  });
  it("frames unequal arbitrary body bounds and touch targets in a measured obstacle-free region", () => {
    const measured = {
      ...viewport,
      usable: { x: 10, y: 20, width: 380, height: 550 },
      obstacles: [{ x: 10, y: 420, width: 380, height: 150 }],
    };
    const usable = usableCameraRect(measured)!;
    expect(usable).toEqual({ x: 10, y: 20, width: 380, height: 400 });
    const bodies = [body(-80, 10, 50), body(70, 50, 10, 2)];
    const framed = frameBodies(bodies, measured, 300, {
      ...HOME_CAMERA,
      tilt: MAX_TILT,
      yaw: 0.6,
    })!;
    expect(framed.fits).toBe(true);
    const frame = projectFrame(bodies, framed.pose, measured, 0);
    for (const b of frame.bodies) {
      expect(b.x - b.hitRadius).toBeGreaterThanOrEqual(usable.x - 1e-6);
      expect(b.x + b.hitRadius).toBeLessThanOrEqual(
        usable.x + usable.width + 1e-6,
      );
      expect(b.y - b.hitRadius).toBeGreaterThanOrEqual(usable.y - 1e-6);
      expect(b.y + b.hitRadius).toBeLessThanOrEqual(
        usable.y + usable.height + 1e-6,
      );
    }
    expect(framed.pose.x).not.toBe((-80 + 70) / 2);
  });
  it("rejects invalid measurements, preserves prior pose through the caller's null result, and reports impossible framing", () => {
    for (const bad of [
      { width: 0, height: 600 },
      { width: NaN, height: 600 },
      { width: 400, height: -1 },
    ]) {
      expect(deriveHomePose([body(0, 0)], bad)).toBeNull();
      expect(frameBodies([body(0, 0)], bad, 100)).toBeNull();
    }
    expect(frameBodies([], viewport, 100)).toBeNull();
    expect(
      frameBodies([body(-5000, 0), body(5000, 0)], viewport, 5100)?.fits,
    ).toBe(false);
  });
  it("preserves the pinch world anchor when requested zoom clamps at either end", () => {
    const start = clampCameraPose(
      { ...HOME_CAMERA, tilt: 0.7, yaw: 1.2 },
      1000,
    );
    const screen = { x: 230, y: 320 };
    const anchor = unprojectToWorldPlane(screen, start, viewport);
    for (const zoom of [0.001, MIN_ZOOM, MAX_ZOOM, 100]) {
      const next = anchorCameraPose(
        start,
        { ...start, zoom },
        screen,
        viewport,
        1000,
      );
      const after = projectWorldPoint(anchor, next, viewport);
      expect(Math.hypot(after.x - screen.x, after.y - screen.y)).toBeLessThan(
        1e-6,
      );
    }
  });
});
