import { describe, expect, it } from "vitest";
import {
  anchorCameraPose,
  clampCameraPose,
  deriveFocalDistance,
  deriveHomePose,
  frameBodies,
  HOME_CAMERA,
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
  it("keeps a positive perspective denominator and round trips all legal extremes within 1e-6 world units", () => {
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
                expect(scale).toBeLessThanOrEqual(1 / 0.55 + 1e-9);
                const recovered = unprojectToWorldPlane(
                  projectWorldPoint(point, pose, viewport),
                  pose,
                  viewport,
                );
                expect(
                  Math.hypot(recovered.x - point.x, recovered.y - point.y),
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
  it("Home fits complete rings until exact readability floor, with zero/one/many finite and no count branch", () => {
    expect(deriveHomePose([], viewport)).toMatchObject({
      x: 0,
      y: 0,
      zoom: 1,
      tilt: 0,
      yaw: 0,
    });
    for (const count of [1, 6, 10, 100]) {
      const world = Array.from({ length: count }, (_, i) =>
        body(0, -58 - i * 34, 16, i + 1),
      );
      const pose = deriveHomePose(world, viewport)!;
      expect(pose.zoom * 16).toBeGreaterThanOrEqual(MIN_READABLE_RADIUS);
      expect(pose).toMatchObject({ x: 0, y: 0, tilt: 0, yaw: 0 });
    }
    const floor = MIN_READABLE_RADIUS / 16;
    const radius = 200 / floor - 16;
    for (const delta of [-1e-6, 0, 1e-6]) {
      const pose = deriveHomePose([body(0, -radius - delta)], viewport)!;
      expect(pose.zoom).toBeCloseTo(
        Math.max(floor, 200 / (radius + delta + 16)),
        10,
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

describe("projectFrame ringPaths (ORRERY LAB B WP-2.1 perf)", () => {
  const world = [
    { id: 0, kind: "sun" as const, x: 0, y: 0, radius: 30, ringRadius: 0 },
    {
      id: 1,
      kind: "contact" as const,
      x: 0,
      y: -80,
      radius: 16,
      ringRadius: 80,
    },
    {
      id: 2,
      kind: "contact" as const,
      x: 120,
      y: 0,
      radius: 16,
      ringRadius: 120,
    },
  ];
  const vp = { width: 400, height: 700 };
  it("projects every ring by default and none / one on request, nothing else changes", () => {
    const all = projectFrame(world, HOME_CAMERA, vp, 1);
    const none = projectFrame(world, HOME_CAMERA, vp, 1, false);
    const one = projectFrame(world, HOME_CAMERA, vp, 1, 2);
    expect(all.bodies[1].ringPath).toHaveLength(128);
    expect(none.bodies.every((b) => b.ringPath.length === 0)).toBe(true);
    expect(one.bodies[1].ringPath).toHaveLength(0);
    expect(one.bodies[2].ringPath).toEqual(all.bodies[2].ringPath);
    const strip = (f: typeof all) =>
      f.bodies.map(({ ringPath: _r, ...rest }) => rest);
    expect(strip(none)).toEqual(strip(all));
  });
});

describe("projectFrame hoisted constants (ORRERY LAB B R1 perf)", () => {
  it("is bit-identical to per-body projectWorldPoint / perspectiveScale", () => {
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const vp = {
      width: 412,
      height: 860,
      usable: { x: 0, y: 40, width: 412, height: 760 },
      obstacles: [{ x: 300, y: 600, width: 112, height: 200 }],
    };
    for (let run = 0; run < 25; run++) {
      const world = Array.from({ length: 40 }, (_, i) => ({
        id: i,
        kind: i === 0 ? ("sun" as const) : ("contact" as const),
        x: (rand() - 0.5) * 600,
        y: (rand() - 0.5) * 600,
        radius: 4 + rand() * 20,
        ringRadius: rand() * 300,
      }));
      const pose = {
        ...HOME_CAMERA,
        x: (rand() - 0.5) * 100,
        y: (rand() - 0.5) * 100,
        zoom: 0.3 + rand() * 3,
        tilt: rand() * 0.9,
        yaw: rand() * 6.28,
      };
      const frame = projectFrame(world, pose, vp, 1, false);
      const current = frame.pose;
      frame.bodies.forEach((b, i) => {
        const p = projectWorldPoint(world[i], current, vp);
        const scale = current.zoom * perspectiveScale(world[i], current);
        expect(b.x).toBe(p.x);
        expect(b.y).toBe(p.y);
        expect(b.radius).toBe(world[i].radius * scale);
      });
    }
  });
});
