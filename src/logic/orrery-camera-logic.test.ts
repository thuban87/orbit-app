import { describe, expect, it } from "vitest";
import { polarisWorldPoint } from "@/components/orrery/orrery-obstacle-logic";
import {
  ACTIVE_HOME_PROFILE,
  anchorCameraPose,
  basisPerspectiveScale,
  type CameraPose,
  type CameraViewport,
  clampCameraPose,
  collectHitCandidates,
  DOLLY_FOCAL_PX,
  deriveHomePose,
  dollyFocalDistance,
  frameBodies,
  HOME_CAMERA,
  HOME_PROFILES,
  HOME_STRATEGY_TOP_MARGIN,
  HORIZON_EPSILON,
  type HomeProfile,
  MAX_USER_TILT,
  MAX_ZOOM,
  MIN_HIT_RADIUS,
  MIN_READABLE_RADIUS,
  MIN_ZOOM,
  type ProjectedBody,
  type ProjectedFrame,
  panCamera,
  perspectiveScale,
  projectFrame,
  projectionBasis,
  projectWithBasis,
  projectWorldPoint,
  tapIntent,
  traceRingPath,
  tryProjectWorldPoint,
  unprojectToWorldPlane,
  usableCameraRect,
  type WorldBody,
  type WorldPoint,
  worldExtent,
} from "@/logic/orrery-camera-logic";
import { projectSwitchChoreographyFrame } from "@/logic/orrery-frame";
import { hitPolaris, polarisProjection } from "@/logic/orrery-recovery-logic";
import { previewReorder, type ReorderDrag } from "@/logic/orrery-reorder-logic";
import { beginSwitchChoreography } from "@/logic/orrery-switch-choreography";

/** A culled body is parked far off-screen; a tap there must never hit it. */
const CULLED_PROBE = -1e4;

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
      { ...HOME_CAMERA, zoom: MIN_ZOOM, tilt: MAX_USER_TILT },
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
    for (const boundary of [0, MAX_USER_TILT])
      for (const delta of [-1e-8, 0, 1e-8])
        expect(
          clampCameraPose({ ...HOME_CAMERA, tilt: boundary + delta }, 1000)
            .tilt,
        ).toBe(Math.max(0, Math.min(MAX_USER_TILT, boundary + delta)));
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
  it("round trips every visible point at all legal extremes within 1e-6 world units; beyond the horizon is culled, not thrown", () => {
    let culled = 0;
    for (const extent of [30, 300, 5000])
      for (const tilt of [0, MAX_USER_TILT / 2, MAX_USER_TILT])
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
                const projected = tryProjectWorldPoint(point, pose, viewport);
                if (!projected) {
                  culled++;
                  continue;
                }
                const scale = perspectiveScale(point, pose);
                expect(scale).toBeGreaterThan(0);
                expect(scale).toBeLessThan(1 / HORIZON_EPSILON + 1e-9);
                expect(projected).toEqual(
                  projectWorldPoint(point, pose, viewport),
                );
                const recovered = unprojectToWorldPlane(
                  projected,
                  pose,
                  viewport,
                );
                expect(
                  Math.hypot(recovered.x - point.x, recovered.y - point.y),
                ).toBeLessThanOrEqual(1e-6);
              }
            }
    // The dolly puts near points of large worlds behind the camera.
    expect(culled).toBeGreaterThan(0);
  });
  it("projects near/far billboard mass, rings and world north through exactly the same camera", () => {
    const world = [body(0, 100), body(0, -100, 16, 2)];
    const pose = clampCameraPose({ ...HOME_CAMERA, tilt: MAX_USER_TILT }, 120);
    const frame = projectFrame(world, pose, viewport, 1);
    expect(frame.bodies[0].radius).toBeGreaterThan(frame.bodies[1].radius);
    expect(frame.bodies[0].ringPath[0]).toEqual(
      projectWorldPoint({ x: 0, y: -100 }, frame.pose, viewport),
    );
    expect(frame.bodies[0].hitRadius).toBeGreaterThanOrEqual(
      frame.bodies[0].radius,
    );
    // D-45 dolly: focal ∝ 1/zoom, independent of the world extent.
    expect(frame.pose.focalDistance).toBe(DOLLY_FOCAL_PX / frame.pose.zoom);
    expect(dollyFocalDistance(2)).toBe(DOLLY_FOCAL_PX / 2);
  });
  it("flat Home fits complete rings until exact readability floor, with zero/one/many finite and no count branch", () => {
    const flat = HOME_PROFILES.flat;
    expect(deriveHomePose([], viewport, flat)).toMatchObject({
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
      const pose = deriveHomePose(world, viewport, flat)!;
      expect(pose.zoom * 16).toBeGreaterThanOrEqual(MIN_READABLE_RADIUS);
      expect(pose).toMatchObject({ x: 0, y: 0, tilt: 0, yaw: 0 });
    }
    const floor = MIN_READABLE_RADIUS / 16;
    const radius = 200 / floor - 16;
    for (const delta of [-1e-6, 0, 1e-6]) {
      const pose = deriveHomePose([body(0, -radius - delta)], viewport, flat)!;
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
      tilt: MAX_USER_TILT,
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
// The pre-38.7 MAX_TILT (60°); the live constant became MAX_USER_TILT.
const LEGACY_MAX_TILT = Math.PI / 3;
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
  ): Omit<ProjectedFrame, "bodies"> & {
    bodies: Omit<
      ProjectedBody,
      "worldRingRadius" | "ringBreaks" | "ringClosed" | "culled"
    >[];
  } => {
    const current = clampCameraPose(
      pose,
      Math.max(
        worldExtent(world),
        ((pose.focalDistance ?? 0) * MAX_DEPTH_FRACTION) /
          ((1 + Math.SQRT2) * Math.sin(LEGACY_MAX_TILT)),
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
          // Far enough that no sampled point crosses the near plane.
          focalDistance: 2000 + random() * 2000,
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
    const steep = { ...pose, tilt: MAX_USER_TILT, focalDistance: 10 };
    expect(() => projectWorldPoint({ x: 0, y: 500 }, steep, viewport)).toThrow(
      "Point outside finite Orrery camera plane",
    );
    expect(() =>
      projectWithBasis(projectionBasis(steep, viewport), 0, 500),
    ).toThrow("Point outside finite Orrery camera plane");
  });

  it("projectFrame equals the frozen old projectFrame wherever nothing is culled; ringPaths:false only empties ring paths", () => {
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
        // Under the dolly (focal = 720 / zoom) zoom ≤ 0.8 keeps every ring
        // sample of this world in front of the camera.
        zoom: MIN_ZOOM + random() * (0.8 - MIN_ZOOM),
        tilt: [0, Math.PI / 6, Math.PI / 4, Math.PI / 3][round % 4],
        yaw: random() * Math.PI * 2,
      };
      const vp = basisViewports[round % basisViewports.length];
      // 38.7-05 adds worldRingRadius (the world ring radius, copied unchanged);
      // everything the frozen copy produced is otherwise identical.
      const frozen = legacy.frame(world, pose, vp, round);
      const expected: ProjectedFrame = {
        ...frozen,
        bodies: frozen.bodies.map((projected, index) => ({
          ...projected,
          worldRingRadius: world[index].ringRadius,
          ringBreaks: [],
          ringClosed: world[index].ringRadius > 0,
          culled: false,
        })),
      };
      const actual = projectFrame(world, pose, vp, round);
      expect(actual).toEqual(expected);
      expectBitExact(actual.center!, expected.center!);
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
          ringClosed: false,
        })),
      });
    }
  });
});

describe("38.7-05 worldRingRadius (single source of world ring radii, M12)", () => {
  const world: WorldBody[] = [
    { id: 0, kind: "sun", x: 0, y: 0, radius: 30, ringRadius: 0 },
    ...[1, 2, 3, 4].map(
      (id): WorldBody => ({
        id,
        kind: "contact",
        x: (40 + id * 34) * Math.sin(id),
        y: -(40 + id * 34) * Math.cos(id),
        radius: 16,
        ringRadius: 40 + id * 34,
      }),
    ),
  ];
  it("copies the world ring radius unchanged at any zoom, tilt and yaw", () => {
    for (const zoom of [MIN_ZOOM, 1, 2, MAX_ZOOM])
      for (const tilt of [0, Math.PI / 4, 1.0821])
        for (const yaw of [0, 2.1]) {
          const frame = projectFrame(
            world,
            { ...HOME_CAMERA, zoom, tilt, yaw },
            viewport,
            1,
          );
          frame.bodies.forEach((projected, index) => {
            expect(projected.worldRingRadius).toBe(world[index].ringRadius);
          });
        }
  });
  it("previewReorder → projectFrame gives the dragged body its new world ring radius (C-L3)", () => {
    const drag: ReorderDrag = {
      generation: 1,
      id: 1,
      request: {} as ReorderDrag["request"],
      radii: [74, 108, 142, 176],
      offset: { x: 0, y: 0 },
      reorderedVisibleIds: [2, 3, 1, 4],
      active: true,
      origin: { x: 0, y: 0 },
    };
    const preview = previewReorder(world, drag);
    const frame = projectFrame(
      preview,
      { ...HOME_CAMERA, zoom: 1.5, tilt: 1.0821, yaw: 0.4 },
      viewport,
      1,
    );
    const moved = frame.bodies.find((b) => b.id === 1)!;
    expect(moved.worldRingRadius).toBe(142);
    expect(moved.worldRingRadius).not.toBe(world[1].ringRadius);
    // A moved body sits on its new ring along its own angle.
    const movedWorld = preview.find((b) => b.id === 1)!;
    expect(Math.hypot(movedWorld.x, movedWorld.y)).toBeCloseTo(142, 9);
    expect(Math.atan2(movedWorld.x, -movedWorld.y)).toBeCloseTo(1, 9);
    expect(frame.bodies.find((b) => b.id === 2)!.worldRingRadius).toBe(74);
    expect(frame.bodies.find((b) => b.id === 3)!.worldRingRadius).toBe(108);
    // Bodies whose slot did not change, and the sun, keep their own.
    expect(frame.bodies.find((b) => b.id === 4)!.worldRingRadius).toBe(176);
    expect(frame.bodies.find((b) => b.id === 0)!.worldRingRadius).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 38.7-05 Task 2 (D-03/D-45, H2): Home profiles, dolly focal, lens shift and
// horizon-safe projection, each at 0°, 45° and 62°.
// ---------------------------------------------------------------------------
const DEG = Math.PI / 180;
const TILTS = [0, 45 * DEG, HOME_PROFILES.tilted.tilt] as const;
const phone: CameraViewport = {
  width: 412,
  height: 780,
  usable: { x: 0, y: 64, width: 412, height: 620 },
};
/** A ~1,000-ring System at Balanced spacing (ringGap 34), golden-angle spread. */
function ringWorld(count = 1000, seedAngle = 0): WorldBody[] {
  return [
    { id: 0, kind: "sun", x: 0, y: 0, radius: 30, ringRadius: 0 },
    ...Array.from({ length: count }, (_, i): WorldBody => {
      const ring = 58 + i * 34;
      const angle = seedAngle + i * 2.399963229728653;
      return {
        id: i + 1,
        kind: "contact",
        x: ring * Math.sin(angle),
        y: -ring * Math.cos(angle),
        radius: 14.4 + (i % 5) * 0.8,
        ringRadius: ring,
      };
    }),
  ];
}
/** Pre-38.7 deriveHomePose, frozen (flat, telephoto-independent fields). */
function legacyHomeZoom(world: readonly WorldBody[], vp: CameraViewport) {
  const usable = usableCameraRect(vp)!;
  const extent = worldExtent(world);
  const minRadius = world.length
    ? Math.min(...world.map((b) => b.radius))
    : MIN_READABLE_RADIUS;
  const floor = Math.max(MIN_ZOOM, MIN_READABLE_RADIUS / minRadius);
  const fit = Math.min(usable.width, usable.height) / (2 * extent);
  return Math.min(1, Math.max(floor, fit));
}
const tiltedAt = (tilt: number): HomeProfile => ({
  ...HOME_PROFILES.tilted,
  tilt,
});

describe("38.7-05 Home profiles and the dolly camera (D-03/D-45)", () => {
  it("one active profile switch; tilted is the default; max user tilt covers every profile", () => {
    expect(ACTIVE_HOME_PROFILE).toBe("tilted");
    expect(HOME_PROFILES.tilted.tilt).toBeCloseTo(1.0821, 4);
    expect(HOME_CAMERA).toMatchObject({
      x: 0,
      y: 0,
      zoom: 1,
      yaw: 0,
      tilt: HOME_PROFILES.tilted.tilt,
      lensShift: HOME_PROFILES.tilted.lensShift,
      focalDistance: DOLLY_FOCAL_PX,
    });
    for (const profile of Object.values(HOME_PROFILES))
      expect(MAX_USER_TILT).toBeGreaterThanOrEqual(profile.tilt);
  });
  it("the flat profile reproduces the pre-38.7 Home exactly for fixtures", () => {
    for (const vp of [viewport, phone])
      for (const count of [0, 1, 6, 10, 100, 1000]) {
        const world = ringWorld(count).slice(1);
        const pose = deriveHomePose(world, vp, HOME_PROFILES.flat)!;
        expect(pose).toMatchObject({ x: 0, y: 0, tilt: 0, yaw: 0 });
        expect(pose.lensShift).toBe(1);
        expect(pose.zoom).toBe(legacyHomeZoom(world, vp));
        // Same projected positions as the old flat Home (focal is moot at 0°).
        const old = {
          x: 0,
          y: 0,
          zoom: pose.zoom,
          tilt: 0,
          yaw: 0,
          focalDistance: 99999,
        };
        for (const body of world.slice(0, 20))
          expect(projectWorldPoint(body, pose, vp)).toEqual(
            projectWorldPoint(body, old, vp),
          );
      }
  });
  it("the tilted strategy fit puts the far rim inside the top margin, or keeps the readability floor for large Systems", () => {
    for (const vp of [viewport, phone]) {
      const usable = usableCameraRect(vp)!;
      for (const count of [1, 3, 6, 10]) {
        const world = ringWorld(count);
        const pose = deriveHomePose(world, vp)!;
        expect(pose.tilt).toBeCloseTo(HOME_PROFILES.tilted.tilt, 12);
        expect(pose.lensShift).toBe(HOME_PROFILES.tilted.lensShift);
        const extent = worldExtent(world);
        const far = projectWorldPoint({ x: 0, y: -extent }, pose, vp);
        expect(far.y).toBeGreaterThanOrEqual(
          usable.y + HOME_STRATEGY_TOP_MARGIN - 1e-6,
        );
        expect(pose.zoom * 14.4).toBeGreaterThanOrEqual(MIN_READABLE_RADIUS);
      }
      for (const count of [100, 1000]) {
        const world = ringWorld(count);
        const pose = deriveHomePose(world, vp)!;
        expect(pose.zoom).toBe(Math.max(MIN_ZOOM, MIN_READABLE_RADIUS / 14.4));
        const far = projectWorldPoint(
          { x: 0, y: -worldExtent(world) },
          pose,
          vp,
        );
        expect(far.y).toBeLessThan(usable.y); // outer rings run off-screen
      }
    }
  });
  it.each(TILTS)(
    "at tilt %s: lens-shift centre, dolly focal, clamp and round trip",
    (tilt) => {
      const usable = usableCameraRect(phone)!;
      for (const lensShift of [1, 0.62, 0.3]) {
        const pose = clampCameraPose(
          { x: 0, y: 0, zoom: 1.3, tilt, yaw: 0.4, lensShift },
          5000,
        );
        expect(pose.focalDistance).toBe(DOLLY_FOCAL_PX / 1.3);
        const origin = projectWorldPoint({ x: 0, y: 0 }, pose, phone);
        expect(origin.x).toBeCloseTo(usable.x + usable.width / 2, 10);
        expect(origin.y).toBeCloseTo(
          usable.y + (usable.height * lensShift) / 2,
          10,
        );
        for (const point of [
          { x: 0, y: 0 },
          { x: 300, y: -500 },
          { x: -200, y: 150 },
        ]) {
          const projected = tryProjectWorldPoint(point, pose, phone)!;
          const back = unprojectToWorldPlane(projected, pose, phone);
          expect(Math.hypot(back.x - point.x, back.y - point.y)).toBeLessThan(
            1e-6,
          );
        }
      }
      expect(
        clampCameraPose({ ...HOME_CAMERA, lensShift: 0 }, 10).lensShift,
      ).toBe(0.3);
      expect(
        clampCameraPose({ ...HOME_CAMERA, lensShift: 2 }, 10).lensShift,
      ).toBe(1);
      expect(clampCameraPose({ x: 0, y: 0, zoom: 1 }, 10).lensShift).toBe(1);
    },
  );
  it("clampCameraPose keeps 62° and clamps 80° to MAX_USER_TILT", () => {
    expect(clampCameraPose({ ...HOME_CAMERA, tilt: 62 * DEG }, 10).tilt).toBe(
      62 * DEG,
    );
    expect(clampCameraPose({ ...HOME_CAMERA, tilt: 80 * DEG }, 10).tilt).toBe(
      MAX_USER_TILT,
    );
  });
  it.each(TILTS)(
    "at tilt %s: the pinch anchor keeps its world point and frameBodies fits a 3-body set",
    (tilt) => {
      const start = clampCameraPose(
        { ...HOME_CAMERA, tilt, zoom: 0.8, yaw: 0.9 },
        2000,
      );
      const screen = { x: 230, y: 420 };
      const anchor = unprojectToWorldPlane(screen, start, phone);
      for (const zoom of [MIN_ZOOM, 1.6, MAX_ZOOM]) {
        const next = anchorCameraPose(
          start,
          { ...start, zoom },
          screen,
          phone,
          2000,
        );
        const after = projectWorldPoint(anchor, next, phone);
        expect(Math.hypot(after.x - screen.x, after.y - screen.y)).toBeLessThan(
          1e-6,
        );
      }
      const usable = usableCameraRect(phone)!;
      const three = [
        body(-120, -40, 16, 1),
        body(90, 60, 14, 2),
        body(10, -160, 18, 3),
      ];
      const framed = frameBodies(three, phone, 400, start)!;
      expect(framed.fits).toBe(true);
      expect(framed.pose.tilt).toBe(start.tilt);
      expect(framed.pose.lensShift).toBe(start.lensShift);
      const frame = projectFrame(three, framed.pose, phone, 1);
      for (const b of frame.bodies) {
        expect(b.culled).toBe(false);
        expect(b.x - b.hitRadius).toBeGreaterThanOrEqual(usable.x - 1e-6);
        expect(b.x + b.hitRadius).toBeLessThanOrEqual(
          usable.x + usable.width + 1e-6,
        );
        expect(b.y - b.hitRadius).toBeGreaterThanOrEqual(usable.y - 1e-6);
        expect(b.y + b.hitRadius).toBeLessThanOrEqual(
          usable.y + usable.height + 1e-6,
        );
      }
    },
  );
});

describe("38.7-05 horizon safety on a 1,000-ring System (H2)", () => {
  const world = ringWorld(1000);
  const extent = worldExtent(world);
  const beyond = (pose: CameraPose, point: WorldPoint) =>
    basisPerspectiveScale(projectionBasis(pose, phone), point.x, point.y) ===
    null;
  it.each(TILTS)(
    "at tilt %s: Home, MIN_ZOOM and MAX_ZOOM never throw; culled bodies are flagged and never hit",
    (tilt) => {
      const home = deriveHomePose(world, phone, tiltedAt(tilt))!;
      for (const zoom of [home.zoom, MIN_ZOOM, MAX_ZOOM]) {
        const pose = clampCameraPose({ ...home, zoom }, extent);
        const frame = projectFrame(world, pose, phone, 1, { extent });
        // Aggregated per-body checks (one expect per property, not per body).
        const wrong = frame.bodies.filter((b, i) =>
          b.culled
            ? b.radius !== 0 ||
              b.hitRadius !== 0 ||
              b.interactive !== false ||
              !beyond(frame.pose, world[i])
            : beyond(frame.pose, world[i]) ||
              ![b.x, b.y, b.radius, b.hitRadius].every(Number.isFinite),
        );
        expect(wrong).toEqual([]);
        const culledIds = new Set(
          frame.bodies.filter((b) => b.culled).map((b) => b.id),
        );
        if (tilt > 0 && zoom === MAX_ZOOM)
          expect(culledIds.size).toBeGreaterThan(0);
        for (const [x, y] of [
          [206, 300],
          [10, 700],
          [400, 70],
          [CULLED_PROBE, CULLED_PROBE],
        ])
          for (const id of collectHitCandidates(frame, x, y))
            expect(culledIds.has(id)).toBe(false);
      }
    },
  );
  it("the pan/yaw/tilt/zoom matrix never throws: bodies, centre, ring samples, Polaris, hits and taps", () => {
    let gapped = 0,
      culledSeen = 0,
      polarisHidden = 0;
    const samplesOf = (pose: CameraPose, ring: number) => {
      const basis = projectionBasis(pose, phone);
      let visible = 0;
      for (let i = 0; i < 128; i++) {
        const angle = (i * 2 * Math.PI) / 128;
        if (
          basisPerspectiveScale(
            basis,
            ring * Math.sin(angle),
            -ring * Math.cos(angle),
          ) !== null
        )
          visible++;
      }
      return visible;
    };
    for (const [px, py] of [
      [extent, 0],
      [-extent, 0],
      [0, extent],
      [0, -extent],
    ])
      for (const yaw of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2])
        for (const tilt of TILTS) {
          const home = deriveHomePose(world, phone, tiltedAt(tilt))!;
          for (const zoom of [MIN_ZOOM, home.zoom, MAX_ZOOM]) {
            const pose = clampCameraPose(
              { ...home, x: px, y: py, yaw, zoom },
              extent,
            );
            const off = projectFrame(world, pose, phone, 1, {
              extent,
              ringPaths: false,
            });
            expect(off.bodies.every((b) => b.ringPath.length === 0)).toBe(true);
            // Ring samples (128 per ring) dominate the cost: the whole world
            // is projected with ring paths at the Home zoom of the axis-aligned
            // yaws; elsewhere every 97th ring is, which covers the same
            // near/far range.
            const full = zoom === home.zoom && (yaw === 0 || yaw === Math.PI);
            const ringed = full ? world : world.filter((_, i) => i % 97 === 0);
            const on = projectFrame(ringed, pose, phone, 1, { extent });
            expect(on.pose).toEqual(off.pose);
            expect(on.center === null).toBe(beyond(on.pose, { x: 0, y: 0 }));
            if (on.center)
              expect(Number.isFinite(on.center.x + on.center.y)).toBe(true);
            for (let i = 0; i < world.length; i += 97) {
              const b = (full ? on.bodies[i] : on.bodies[i / 97])!;
              expect(b.id).toBe(world[i].id);
              expect(b.culled).toBe(off.bodies[i].culled);
              if (b.culled) culledSeen++;
              if (b.ringRadius === 0) continue;
              const visible = samplesOf(on.pose, world[i].ringRadius);
              expect(b.ringPath.length).toBe(visible);
              expect(b.ringClosed).toBe(visible === 128);
              if (!b.culled && visible < 128 && visible > 0) gapped++;
              expect(
                b.ringPath.every((point) => Number.isFinite(point.x + point.y)),
              ).toBe(true);
            }
            const polaris = polarisProjection(off, extent);
            expect(polaris === null).toBe(
              beyond(off.pose, polarisWorldPoint(extent)),
            );
            if (!polaris) polarisHidden++;
            for (const [x, y] of [
              [206, 300],
              [5, 5],
              [406, 770],
            ]) {
              expect(() => hitPolaris(off, extent, x, y)).not.toThrow();
              expect(() => collectHitCandidates(off, x, y)).not.toThrow();
              expect(() => tapIntent(off, x, y, true)).not.toThrow();
            }
          }
        }
    // The matrix genuinely exercises the horizon.
    expect(culledSeen).toBeGreaterThan(0);
    expect(gapped).toBeGreaterThan(0);
    expect(polarisHidden).toBeGreaterThan(0);
  });
  it("a body in front of the horizon keeps its visible ring arc while far samples are omitted", () => {
    const pose = clampCameraPose(
      { ...HOME_CAMERA, zoom: 2, tilt: HOME_PROFILES.tilted.tilt },
      extent,
    );
    const near = [
      {
        id: 1,
        kind: "contact" as const,
        x: 0,
        y: -400,
        radius: 16,
        ringRadius: 400,
      },
    ];
    const frame = projectFrame(near, pose, phone, 1);
    const b = frame.bodies[0];
    expect(b.culled).toBe(false);
    expect(b.ringClosed).toBe(false);
    expect(b.ringPath.length).toBeGreaterThan(0);
    expect(b.ringPath.length).toBeLessThan(128);
    const pen: string[] = [];
    traceRingPath(
      {
        moveTo: () => pen.push("M"),
        lineTo: () => pen.push("L"),
        close: () => pen.push("Z"),
      },
      b,
    );
    expect(pen).not.toContain("Z");
    expect(pen.filter((c) => c === "M")).toHaveLength(b.ringBreaks.length + 1);
    // A gap in the middle of the samples lifts the pen.
    const split: string[] = [];
    traceRingPath(
      {
        moveTo: () => split.push("M"),
        lineTo: () => split.push("L"),
        close: () => split.push("Z"),
      },
      {
        ringPath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 5, y: 0 },
          { x: 6, y: 0 },
        ],
        ringBreaks: [2],
        ringClosed: false,
      },
    );
    expect(split).toEqual(["M", "L", "M", "L"]);
  });
  it("frameBodies on a mixed visible/culled selection returns a safe pose or null, never throws", () => {
    const pose = clampCameraPose(
      { ...HOME_CAMERA, zoom: MAX_ZOOM, y: 2000 },
      extent,
    );
    const frame = projectFrame(world, pose, phone, 1, { extent });
    const culled = frame.bodies.filter((b) => b.culled).slice(0, 3);
    const visible = frame.bodies
      .filter((b) => !b.culled && b.id > 0)
      .slice(0, 3);
    expect(culled.length).toBe(3);
    expect(visible.length).toBe(3);
    const selection = [...culled, ...visible].map(
      (b) => world.find((w) => w.id === b.id)!,
    );
    for (const orientation of [pose, HOME_CAMERA, { ...pose, yaw: Math.PI }]) {
      const framed = frameBodies(selection, phone, extent, orientation);
      if (framed)
        expect(
          projectFrame(selection, framed.pose, phone, 1, {
            extent,
          }).bodies.every((b) => !b.culled),
        ).toBe(true);
    }
  });
  it("switch intermediates between two 1,000-ring worlds never throw and every drawn body is finite", () => {
    const from = ringWorld(1000, 0.3);
    const to = ringWorld(1000, 1.7).map((b) =>
      b.id > 0 ? { ...b, id: b.id + 400 } : b,
    );
    const choreography = beginSwitchChoreography(from, to, 3, {
      intensity: 1,
      reducedMotion: false,
    });
    const a = clampCameraPose(
      { x: 300, y: -200, zoom: 0.6, tilt: 0, yaw: 0.2, lensShift: 1 },
      extent,
    );
    const b = clampCameraPose(
      {
        x: -500,
        y: 900,
        zoom: 3,
        tilt: HOME_PROFILES.tilted.tilt,
        yaw: 4,
        lensShift: 0.62,
      },
      extent,
    );
    for (let step = 0; step <= 10; step++) {
      const t = step / 10;
      const mix = (p: number, q: number) => p + (q - p) * t;
      const pose: CameraPose = {
        x: mix(a.x, b.x),
        y: mix(a.y, b.y),
        zoom: mix(a.zoom, b.zoom),
        tilt: mix(a.tilt!, b.tilt!),
        yaw: mix(a.yaw!, b.yaw!),
        lensShift: mix(a.lensShift!, b.lensShift!),
        focalDistance: mix(a.focalDistance!, b.focalDistance!),
      };
      const frame = projectSwitchChoreographyFrame(
        choreography,
        t,
        pose,
        phone,
        {
          extent,
        },
      );
      for (const body of frame.bodies)
        if (!body.culled)
          expect(
            [body.x, body.y, body.radius, body.hitRadius].every(
              Number.isFinite,
            ),
          ).toBe(true);
        else expect(body.visible || body.interactive).toBe(false);
    }
  });
});
