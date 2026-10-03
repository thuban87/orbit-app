import { describe, expect, it } from "vitest";
import {
  type CameraPose,
  type CameraViewport,
  clampCameraPose,
  HOME_PROFILES,
  HORIZON_EPSILON,
  projectWorldPoint,
  tryProjectWorldPoint,
  unprojectToWorldPlane,
} from "./orrery-camera-logic";
import {
  applyHomography,
  discBeyondHorizon,
  homographyDepth,
  horizonScreenY,
  invertHomography,
  minRadialScale,
  planeHomography,
  RING_DENSITY_FLOOR,
  RING_MIN_SPACING_PX,
  ringDensityFade,
  ringScreenPerimeter,
  ringScreenSpacing,
} from "./orrery-plane-logic";

const DEG = Math.PI / 180;
const viewports: CameraViewport[] = [
  { width: 412, height: 780 },
  {
    width: 412,
    height: 780,
    usable: { x: 0, y: 96, width: 412, height: 560 },
    obstacles: [{ x: 300, y: 500, width: 112, height: 120 }],
  },
];

/** Seeded LCG so the "random" points and poses are reproducible. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function apply(h: readonly number[], x: number, y: number) {
  const w = h[6] * x + h[7] * y + h[8];
  return {
    x: (h[0] * x + h[1] * y + h[2]) / w,
    y: (h[3] * x + h[4] * y + h[5]) / w,
    w,
  };
}

describe("planeHomography (D-44): parity with projectWorldPoint", () => {
  const random = rng(38706);
  const tilts = [0, 45 * DEG, 62 * DEG];
  const lensShifts = [1, HOME_PROFILES.tilted.lensShift, 0.3];
  const yaws = [0, 0.7, Math.PI, 4.9];
  it.each(
    tilts.flatMap((tilt) =>
      lensShifts.flatMap((lensShift) =>
        yaws.map((yaw) => ({ tilt, lensShift, yaw })),
      ),
    ),
  )(
    "tilt $tilt, lens $lensShift, yaw $yaw: H·p equals projectWorldPoint within 1e-6",
    ({ tilt, lensShift, yaw }) => {
      for (const viewport of viewports) {
        for (const zoom of [0.25, 0.8, 1.6, 4]) {
          const pose = clampCameraPose(
            {
              x: (random() - 0.5) * 400,
              y: (random() - 0.5) * 400,
              zoom,
              tilt,
              yaw,
              lensShift,
            },
            2000,
          );
          const h = planeHomography(pose, viewport);
          let checked = 0;
          for (let i = 0; i < 40; i++) {
            const p = {
              x: (random() - 0.5) * 1600,
              y: (random() - 0.5) * 1600,
            };
            const expected = tryProjectWorldPoint(p, pose, viewport);
            const got = applyHomography(h, p.x, p.y);
            if (!expected) {
              // Culled by the camera ⇔ culled by the homography.
              expect(got).toBeNull();
              continue;
            }
            expect(got).not.toBeNull();
            if (!got) continue;
            const exact = projectWorldPoint(p, pose, viewport);
            expect(Math.abs(got.x - exact.x)).toBeLessThan(1e-6);
            expect(Math.abs(got.y - exact.y)).toBeLessThan(1e-6);
            checked++;
          }
          expect(checked).toBeGreaterThan(0);
        }
      }
    },
  );
  it("the homogeneous depth is the normalised perspective denominator (cull at HORIZON_EPSILON)", () => {
    const pose = clampCameraPose(
      { x: 0, y: 0, zoom: 1, tilt: 62 * DEG, yaw: 0, lensShift: 0.62 },
      2000,
    );
    const h = planeHomography(pose, viewports[0]);
    // planeY grows toward the camera; at yaw 0 that is +y.
    const focal = pose.focalDistance ?? 0;
    const edge = (focal * (1 - HORIZON_EPSILON)) / Math.sin(62 * DEG);
    expect(homographyDepth(h, 0, edge)).toBeCloseTo(HORIZON_EPSILON, 9);
    expect(applyHomography(h, 0, edge - 1)).not.toBeNull();
    expect(applyHomography(h, 0, edge + 1)).toBeNull();
    expect(
      tryProjectWorldPoint({ x: 0, y: edge + 1 }, pose, viewports[0]),
    ).toBeNull();
  });
});

describe("invertHomography", () => {
  it("round-trips screen ↔ world and matches unprojectToWorldPlane", () => {
    const random = rng(7);
    for (const tilt of [0, 45 * DEG, 62 * DEG]) {
      const pose = clampCameraPose(
        { x: 40, y: -90, zoom: 1.3, tilt, yaw: 1.1, lensShift: 0.62 },
        2000,
      );
      const h = planeHomography(pose, viewports[1]);
      const inverse = invertHomography(h);
      expect(inverse).not.toBeNull();
      if (!inverse) continue;
      for (let i = 0; i < 30; i++) {
        const p = { x: (random() - 0.5) * 600, y: (random() - 0.5) * 600 };
        const screen = applyHomography(h, p.x, p.y);
        if (!screen) continue;
        const back = apply(inverse, screen.x, screen.y);
        expect(back.x).toBeCloseTo(p.x, 6);
        expect(back.y).toBeCloseTo(p.y, 6);
        const ground = unprojectToWorldPlane(screen, pose, viewports[1]);
        expect(ground.x).toBeCloseTo(p.x, 6);
        expect(ground.y).toBeCloseTo(p.y, 6);
      }
      const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
      const product = (a: readonly number[], b: readonly number[]) =>
        [0, 1, 2].flatMap((r) =>
          [0, 1, 2].map(
            (c) =>
              a[r * 3] * b[c] +
              a[r * 3 + 1] * b[3 + c] +
              a[r * 3 + 2] * b[6 + c],
          ),
        );
      for (const [i, v] of product(h, inverse).entries())
        expect(v).toBeCloseTo(identity[i], 9);
    }
  });
  it("returns null for a singular matrix", () => {
    expect(invertHomography([1, 2, 3, 2, 4, 6, 0, 0, 1])).toBeNull();
  });
});

describe("horizonScreenY", () => {
  it("is where the inverse projection's denominator vanishes (and −∞ when flat)", () => {
    for (const tilt of [20 * DEG, 45 * DEG, 62 * DEG]) {
      for (const zoom of [0.5, 1, 3]) {
        const pose = clampCameraPose(
          { x: 0, y: 0, zoom, tilt, yaw: 0.4, lensShift: 0.62 },
          2000,
        );
        const h = planeHomography(pose, viewports[0]);
        const inverse = invertHomography(h);
        if (!inverse) throw new Error("singular");
        const y = horizonScreenY(pose, viewports[0]);
        for (const x of [0, 137, 412]) {
          const back = apply(inverse, x, y);
          expect(Math.abs(back.w)).toBeLessThan(1e-9);
          // Just below the line the inverse is a finite ground point; just
          // above it there is no ground (the sky).
          expect(apply(inverse, x, y + 1).w).toBeGreaterThan(0);
          expect(apply(inverse, x, y - 1).w).toBeLessThan(0);
        }
        // The far side of the plane converges onto the line from below.
        const far = applyHomography(
          h,
          -1e9 * Math.sin(0.4),
          -1e9 * Math.cos(0.4),
        );
        expect(far).not.toBeNull();
        expect((far?.y ?? 0) - y).toBeGreaterThan(0);
        expect((far?.y ?? 0) - y).toBeLessThan(1);
      }
    }
    expect(
      horizonScreenY(
        clampCameraPose({ x: 0, y: 0, zoom: 1, tilt: 0 }, 100),
        viewports[0],
      ),
    ).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe("ring helpers", () => {
  const pose: CameraPose = clampCameraPose(
    { x: 0, y: 0, zoom: 1, tilt: 62 * DEG, yaw: 0, lensShift: 0.62 },
    6000,
  );
  const h = planeHomography(pose, viewports[0]);
  it("discBeyondHorizon only when every point of the disc is culled", () => {
    expect(discBeyondHorizon(h, 400)).toBe(false);
    // Looking from the far rim of a huge disc: its centre is behind the camera.
    const behind = clampCameraPose(
      { x: 0, y: 3000, zoom: 4, tilt: 62 * DEG, yaw: Math.PI, lensShift: 0.62 },
      6000,
    );
    const hb = planeHomography(behind, viewports[0]);
    expect(homographyDepth(hb, 0, 0)).toBeLessThan(HORIZON_EPSILON);
    expect(discBeyondHorizon(hb, 100)).toBe(true);
    expect(discBeyondHorizon(hb, 3000)).toBe(false);
    for (let i = 0; i < 64; i++) {
      const a = (i * 2 * Math.PI) / 64;
      expect(
        tryProjectWorldPoint(
          { x: 100 * Math.sin(a), y: -100 * Math.cos(a) },
          behind,
          viewports[0],
        ),
      ).toBeNull();
    }
  });
  it("minRadialScale is the zoom·cos(tilt)-compressed far side at a tilt, the zoom when flat", () => {
    const flat = planeHomography(
      clampCameraPose({ x: 0, y: 0, zoom: 1.5, tilt: 0 }, 1000),
      viewports[0],
    );
    expect(minRadialScale(flat, 200)).toBeCloseTo(1.5, 9);
    const tilted = minRadialScale(h, 200);
    expect(tilted).toBeGreaterThan(0);
    expect(tilted).toBeLessThan(Math.cos(62 * DEG) * 1.01);
    const behind = clampCameraPose(
      { x: 0, y: 3000, zoom: 4, tilt: 62 * DEG, yaw: Math.PI, lensShift: 0.62 },
      6000,
    );
    expect(minRadialScale(planeHomography(behind, viewports[0]), 50)).toBe(0);
  });
  it("ringScreenPerimeter is 2πRz when flat and counts only the visible arc at the horizon", () => {
    const flat = planeHomography(
      clampCameraPose({ x: 0, y: 0, zoom: 2, tilt: 0 }, 1000),
      viewports[0],
    );
    expect(ringScreenPerimeter(flat, 100)).toBeCloseTo(2 * Math.PI * 200, -1);
    expect(Number.isFinite(ringScreenPerimeter(h, 5000))).toBe(true);
    expect(ringScreenPerimeter(h, 5000)).toBeGreaterThan(0);
  });
  it("ring density fade: 1 when spacious, squared ramp, never below the floor", () => {
    expect(ringScreenSpacing(1000, 10, 1)).toBe(100);
    expect(ringScreenSpacing(0, 0, Number.NaN)).toBe(1);
    expect(ringDensityFade(RING_MIN_SPACING_PX * 3)).toBe(1);
    expect(ringDensityFade(RING_MIN_SPACING_PX)).toBe(1);
    expect(ringDensityFade(RING_MIN_SPACING_PX * 0.8)).toBeCloseTo(0.64, 9);
    expect(ringDensityFade(0)).toBe(RING_DENSITY_FLOOR);
    expect(ringDensityFade(Number.NaN)).toBe(1);
    // All Contacts at the minimum zoom: ~34-unit gaps at 0.25 → faint.
    const packed = ringDensityFade(ringScreenSpacing(34_000, 1000, 0.25));
    expect(packed).toBeLessThan(0.25);
    expect(packed).toBeGreaterThanOrEqual(RING_DENSITY_FLOOR);
  });
});
