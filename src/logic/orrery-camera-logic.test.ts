import { describe, expect, it } from "vitest";
import {
  anchorCameraPose,
  type CameraPose,
  type CameraViewport,
  clampCameraPose,
  deriveFocalDistance,
  deriveHomePose,
  frameBodies,
  HOME_CAMERA,
  MAX_TILT,
  MAX_ZOOM,
  MIN_HIT_RADIUS,
  MIN_READABLE_RADIUS,
  MIN_ZOOM,
  type ProjectedFrame,
  panCamera,
  perspectiveScale,
  projectFrame,
  projectionBasis,
  projectWithBasis,
  projectWorldPoint,
  unprojectToWorldPlane,
  usableCameraRect,
  type WorldBody,
  type WorldPoint,
  worldExtent,
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

// ---------------------------------------------------------------------------
// D-52: the hoisted projection basis is bit-exact against FROZEN copies of the
// pre-38.7 per-point projection and projectFrame (do not edit the copies).
// ---------------------------------------------------------------------------
const legacy = (() => {
  const MIN_FOCAL_DISTANCE = 256;
  const MAX_DEPTH_FRACTION = 0.45;
  const RING_SEGMENTS = 128;
  const cameraPlane = (point: WorldPoint, pose: CameraPose): WorldPoint => {
    const yaw = pose.yaw ?? 0,
      c = Math.cos(yaw),
      s = Math.sin(yaw);
    const x = point.x - pose.x,
      y = point.y - pose.y;
    return { x: x * c - y * s, y: x * s + y * c };
  };
  const scaleAt = (point: WorldPoint, pose: CameraPose) => {
    const focal = pose.focalDistance ?? MIN_FOCAL_DISTANCE;
    const denominator =
      focal - cameraPlane(point, pose).y * Math.sin(pose.tilt ?? 0);
    if (!Number.isFinite(denominator) || denominator <= 0)
      throw new Error("Point outside finite Orrery camera plane");
    return focal / denominator;
  };
  const projectPoint = (
    point: WorldPoint,
    pose: CameraPose,
    viewport: CameraViewport,
  ): WorldPoint => {
    if (
      ![
        point.x,
        point.y,
        pose.x,
        pose.y,
        pose.zoom,
        pose.tilt ?? 0,
        pose.yaw ?? 0,
        pose.focalDistance ?? MIN_FOCAL_DISTANCE,
        viewport.width,
        viewport.height,
      ].every(Number.isFinite) ||
      pose.zoom <= 0 ||
      viewport.width <= 0 ||
      viewport.height <= 0
    )
      throw new Error("Invalid Orrery projection input");
    const rect = usableCameraRect(viewport);
    if (!rect) throw new Error("Invalid Orrery usable camera measurement");
    const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    const plane = cameraPlane(point, pose),
      scale = scaleAt(point, pose) * pose.zoom;
    return {
      x: center.x + plane.x * scale,
      y: center.y + plane.y * Math.cos(pose.tilt ?? 0) * scale,
    };
  };
  const frame = (
    world: readonly WorldBody[],
    pose: CameraPose,
    viewport: CameraViewport,
    generation: number,
  ): ProjectedFrame => {
    const current = clampCameraPose(
      pose,
      Math.max(
        worldExtent(world),
        ((pose.focalDistance ?? 0) * MAX_DEPTH_FRACTION) /
          ((1 + Math.SQRT2) * Math.sin(MAX_TILT)),
      ),
    );
    return {
      generation,
      pose: current,
      viewport,
      center: projectPoint({ x: 0, y: 0 }, current, viewport),
      bodies: world.map((body) => {
        const scale = current.zoom * perspectiveScale(body, current);
        const ringPath: WorldPoint[] = [];
        if (body.ringRadius > 0)
          for (let i = 0; i < RING_SEGMENTS; i++) {
            const angle = (i * 2 * Math.PI) / RING_SEGMENTS;
            ringPath.push(
              projectPoint(
                {
                  x: body.ringRadius * Math.sin(angle),
                  y: -body.ringRadius * Math.cos(angle),
                },
                current,
                viewport,
              ),
            );
          }
        return {
          ...body,
          ...projectPoint(body, current, viewport),
          radius: body.radius * scale,
          ringRadius: body.ringRadius * current.zoom,
          hitRadius: Math.max(MIN_HIT_RADIUS, body.radius * scale),
          ringPath,
          depth: cameraPlane(body, current).y * Math.sin(current.tilt ?? 0),
        };
      }),
    };
  };
  return { projectPoint, frame };
})();

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
/** Object.is per coordinate: bit-for-bit, including -0. */
function expectBitExact(actual: WorldPoint, expected: WorldPoint) {
  expect(Object.is(actual.x, expected.x)).toBe(true);
  expect(Object.is(actual.y, expected.y)).toBe(true);
}
const basisViewports: CameraViewport[] = [
  { width: 400, height: 600 },
  { width: 412, height: 780, usable: { x: 0, y: 64, width: 412, height: 640 } },
  {
    width: 412,
    height: 780,
    obstacles: [
      { x: 0, y: 700, width: 412, height: 80 },
      { x: 300, y: 0, width: 112, height: 120 },
    ],
  },
];

describe("D-52 hoisted projection basis", () => {
  it("projectWithBasis equals projectWorldPoint bit-for-bit at every tilt", () => {
    const random = seeded(52);
    for (const tilt of [0, Math.PI / 6, Math.PI / 4, Math.PI / 3]) {
      for (let round = 0; round < 60; round++) {
        const pose: CameraPose = {
          x: (random() - 0.5) * 400,
          y: (random() - 0.5) * 400,
          zoom: MIN_ZOOM + random() * (MAX_ZOOM - MIN_ZOOM),
          tilt,
          yaw: random() * Math.PI * 2,
          focalDistance: deriveFocalDistance(300 + random() * 900),
        };
        const viewport = basisViewports[round % basisViewports.length];
        const basis = projectionBasis(pose, viewport);
        for (let point = 0; point < 25; point++) {
          const x = (random() - 0.5) * 600;
          const y = (random() - 0.5) * 600;
          const expected = legacy.projectPoint({ x, y }, pose, viewport);
          expectBitExact(projectWithBasis(basis, x, y), expected);
          expectBitExact(projectWorldPoint({ x, y }, pose, viewport), expected);
        }
      }
    }
  });

  it("keeps the same throws and their precedence", () => {
    const pose = { ...HOME_CAMERA };
    expect(() =>
      projectWithBasis(projectionBasis(pose, viewport), Number.NaN, 0),
    ).toThrow("Invalid Orrery projection input");
    expect(() => projectionBasis({ ...pose, zoom: 0 }, viewport)).toThrow(
      "Invalid Orrery projection input",
    );
    // A NaN point against an unusable viewport reports the point, as before.
    const unusable = {
      width: 400,
      height: 600,
      usable: { x: 0, y: 0, width: 0, height: 10 },
    };
    expect(() =>
      projectWorldPoint({ x: Number.NaN, y: 0 }, pose, unusable),
    ).toThrow("Invalid Orrery projection input");
    expect(() => projectWorldPoint({ x: 0, y: 0 }, pose, unusable)).toThrow(
      "Invalid Orrery usable camera measurement",
    );
    const steep = { ...pose, tilt: MAX_TILT, focalDistance: 10 };
    expect(() => projectWorldPoint({ x: 0, y: 500 }, steep, viewport)).toThrow(
      "Point outside finite Orrery camera plane",
    );
    expect(() =>
      projectWithBasis(projectionBasis(steep, viewport), 0, 500),
    ).toThrow("Point outside finite Orrery camera plane");
  });

  it("projectFrame equals the frozen old projectFrame; ringPaths:false only empties ring paths", () => {
    const random = seeded(7);
    for (let round = 0; round < 24; round++) {
      const world: WorldBody[] = [
        { id: 0, kind: "sun", x: 0, y: 0, radius: 20, ringRadius: 0 },
        ...Array.from({ length: 12 }, (_, index): WorldBody => {
          const ring = 40 + random() * 500;
          const angle = random() * Math.PI * 2;
          return {
            id: index + 1,
            kind: "contact",
            x: ring * Math.sin(angle),
            y: -ring * Math.cos(angle),
            radius: 6 + random() * 18,
            ringRadius: ring,
          };
        }),
      ];
      const pose: CameraPose = {
        x: (random() - 0.5) * 300,
        y: (random() - 0.5) * 300,
        zoom: MIN_ZOOM + random() * (MAX_ZOOM - MIN_ZOOM),
        tilt: [0, Math.PI / 6, Math.PI / 4, Math.PI / 3][round % 4],
        yaw: random() * Math.PI * 2,
        focalDistance: deriveFocalDistance(worldExtent(world)),
      };
      const vp = basisViewports[round % basisViewports.length];
      const expected = legacy.frame(world, pose, vp, round);
      const actual = projectFrame(world, pose, vp, round);
      expect(actual).toEqual(expected);
      expectBitExact(actual.center, expected.center);
      actual.bodies.forEach((projected, index) => {
        expectBitExact(projected, expected.bodies[index]);
        projected.ringPath.forEach((point, i) => {
          expectBitExact(point, expected.bodies[index].ringPath[i]);
        });
      });
      expect(projectFrame(world, pose, vp, round, { ringPaths: true })).toEqual(
        expected,
      );
      const ringless = projectFrame(world, pose, vp, round, {
        ringPaths: false,
      });
      expect(ringless).toEqual({
        ...expected,
        bodies: expected.bodies.map((projected) => ({
          ...projected,
          ringPath: [],
        })),
      });
    }
  });
});
