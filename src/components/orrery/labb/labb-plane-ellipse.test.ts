import { describe, expect, it, vi } from "vitest";

vi.mock("@shopify/react-native-skia", () => ({ Skia: {} }));

import {
  type CameraPose,
  clampCameraPose,
  MAX_TILT,
  MAX_ZOOM,
  MIN_ZOOM,
  projectWorldPoint,
  unprojectToWorldPlane,
} from "@/logic/orrery-camera-logic";
import {
  ellipseOnScreen,
  ellipsePoint,
  hasPerspective,
  mul3,
  ovalCtm,
  ovalLocalMatrix,
  planeInverseRows,
  projectedCircleEllipse,
} from "./labb-plane-ellipse";
import { applyHomography, planeHomography } from "./labb-rings-logic";

const EXTENT = 600;
const viewports = [
  { width: 412, height: 892 },
  {
    width: 412,
    height: 860,
    usable: { x: 0, y: 120, width: 412, height: 600 },
  },
];

/** Screen distance from p to the ellipse along the ray from its centre. */
function radialError(
  e: { x: number; y: number; a: number; b: number; theta: number },
  p: { x: number; y: number },
): number {
  const c = Math.cos(e.theta);
  const s = Math.sin(e.theta);
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const u = (dx * c + dy * s) / e.a;
  const v = (-dx * s + dy * c) / e.b;
  const rho = Math.sqrt(u * u + v * v);
  return Math.hypot(dx, dy) * Math.abs(1 - 1 / rho);
}

function poses(): CameraPose[] {
  const out: CameraPose[] = [];
  const tilts = [0, 0.2, 0.56, 0.9, MAX_TILT];
  const yaws = [0, 0.7, 2.1, Math.PI, 4.4, 5.9];
  const zooms = [MIN_ZOOM, 0.6, 1, 2, MAX_ZOOM];
  const pans = [
    [0, 0],
    [EXTENT, -EXTENT],
    [-0.6 * EXTENT, 0.4 * EXTENT],
  ];
  for (const tilt of tilts)
    for (const yaw of yaws)
      for (const zoom of zooms)
        for (const [x, y] of pans)
          out.push(clampCameraPose({ x, y, zoom, tilt, yaw }, EXTENT));
  return out;
}

describe("projectedCircleEllipse (tilt fix: plane circle → screen ellipse)", () => {
  it("lies on projectWorldPoint samples of the ring: < 0.5 px over tilts, yaws, zooms and pans", () => {
    let worst = 0;
    let cases = 0;
    for (const viewport of viewports)
      for (const pose of poses()) {
        const m = planeHomography(pose, viewport);
        expect(m).not.toBeNull();
        if (!m) continue;
        for (const R of [8, 60, 250, EXTENT]) {
          const e = projectedCircleEllipse(m, 0, 0, R);
          expect(e).not.toBeNull();
          if (!e) continue;
          for (let k = 0; k < 48; k++) {
            const a = (k / 48) * Math.PI * 2;
            const p = projectWorldPoint(
              { x: R * Math.sin(a), y: -R * Math.cos(a) },
              pose,
              viewport,
            );
            worst = Math.max(worst, radialError(e, p));
          }
          cases += 1;
        }
      }
    expect(cases).toBeGreaterThan(1000);
    expect(worst).toBeLessThan(0.5);
    // In practice it is exact to floating point.
    expect(worst).toBeLessThan(1e-3);
  });

  it("every ellipse point unprojects onto the world circle (both directions)", () => {
    const viewport = viewports[0];
    for (const pose of poses().filter((_, i) => i % 7 === 0)) {
      const m = planeHomography(pose, viewport);
      if (!m) continue;
      for (const R of [40, 420]) {
        const e = projectedCircleEllipse(m, 0, 0, R);
        if (!e) throw new Error("no ellipse");
        for (let k = 0; k < 24; k++) {
          const p = ellipsePoint(e, (k / 24) * Math.PI * 2);
          const w = unprojectToWorldPlane(p, pose, viewport);
          // World error, converted to screen px through the local scale
          // (≤ zoom · perspective ≤ MAX_ZOOM · 1.9).
          expect(
            Math.abs(Math.hypot(w.x, w.y) - R) * MAX_ZOOM * 2,
          ).toBeLessThan(0.5);
        }
      }
    }
  });

  it("handles off-centre circles (ripples, reticle hulls on the plane)", () => {
    const viewport = viewports[1];
    const pose = clampCameraPose(
      { x: 120, y: -40, zoom: 1.4, tilt: 0.8, yaw: 1.1 },
      EXTENT,
    );
    const m = planeHomography(pose, viewport);
    if (!m) throw new Error("no matrix");
    const [cx, cy, R] = [-150, 210, 35];
    const e = projectedCircleEllipse(m, cx, cy, R);
    if (!e) throw new Error("no ellipse");
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2;
      const p = applyHomography(m, cx + R * Math.cos(a), cy + R * Math.sin(a));
      expect(radialError(e, p)).toBeLessThan(1e-3);
    }
  });

  it("is a circle (a = b) on an untilted plane and flattens with tilt", () => {
    const viewport = viewports[0];
    const flat = planeHomography(
      clampCameraPose({ x: 30, y: 10, zoom: 1.5, yaw: 0.8 }, EXTENT),
      viewport,
    );
    if (!flat) throw new Error("no matrix");
    expect(hasPerspective(flat)).toBe(false);
    const c = projectedCircleEllipse(flat, 0, 0, 100);
    expect(c?.a).toBeCloseTo(150, 6);
    expect(c?.b).toBeCloseTo(150, 6);
    const tilted = planeHomography(
      clampCameraPose({ x: 0, y: 0, zoom: 1.5, tilt: 0.56 }, EXTENT),
      viewport,
    );
    if (!tilted) throw new Error("no matrix");
    expect(hasPerspective(tilted)).toBe(true);
    const t = projectedCircleEllipse(tilted, 0, 0, 100);
    if (!t) throw new Error("no ellipse");
    expect(Math.min(t.a, t.b) / Math.max(t.a, t.b)).toBeLessThan(0.9);
  });

  it("rejects degenerate input", () => {
    const m = planeHomography(
      clampCameraPose({ x: 0, y: 0, zoom: 1, tilt: 0.5 }, EXTENT),
      viewports[0],
    );
    if (!m) throw new Error("no matrix");
    expect(projectedCircleEllipse(m, 0, 0, 0)).toBeNull();
    expect(projectedCircleEllipse(m, 0, 0, -3)).toBeNull();
    // A "camera" whose w is negative at the centre (behind the horizon).
    expect(projectedCircleEllipse([1, 0, 0, 0, 1, 0, 0, -1, -5], 0, 0, 1)).toBe(
      null,
    );
  });
});

describe("ellipseOnScreen (exact ring culling)", () => {
  const e = { x: 200, y: 400, a: 150, b: 90, theta: 0.4 };
  it("keeps rings that cross the viewport", () => {
    expect(ellipseOnScreen(e, 2, 412, 892)).toBe(true);
  });
  it("drops rings entirely outside the viewport", () => {
    expect(ellipseOnScreen({ ...e, x: -400 }, 2, 412, 892)).toBe(false);
    expect(ellipseOnScreen({ ...e, y: 1300 }, 2, 412, 892)).toBe(false);
  });
  it("drops rings that enclose the whole viewport", () => {
    expect(
      ellipseOnScreen(
        { x: 206, y: 446, a: 5000, b: 3000, theta: 0.3 },
        2,
        412,
        892,
      ),
    ).toBe(false);
    // …but not one whose stroke crosses a corner.
    expect(
      ellipseOnScreen(
        { x: 206, y: 446, a: 500, b: 480, theta: 0 },
        2,
        412,
        892,
      ),
    ).toBe(true);
  });
});

describe("oval draw variant: shader local matrix keeps WORLD coordinates", () => {
  it("(T·R) · ovalLocalMatrix(e, H) = H", () => {
    const m = planeHomography(
      clampCameraPose({ x: 80, y: 20, zoom: 2, tilt: 0.7, yaw: 2 }, EXTENT),
      viewports[0],
    );
    if (!m) throw new Error("no matrix");
    const e = projectedCircleEllipse(m, 0, 0, 120);
    if (!e) throw new Error("no ellipse");
    const c = Math.cos(e.theta);
    const s = Math.sin(e.theta);
    const ctm = [c, -s, e.x, s, c, e.y, 0, 0, 1];
    const back = mul3(ctm, ovalLocalMatrix(e, m));
    for (let i = 0; i < 9; i++) expect(back[i]).toBeCloseTo(m[i], 6);
  });
});

describe("planeInverseRows (the …Inv ring shaders' screen → plane map)", () => {
  it("maps screen points back onto the plane, also through an oval CTM", () => {
    const m = planeHomography(
      clampCameraPose(
        { x: -60, y: 90, zoom: 0.8, tilt: 0.9, yaw: 3.3 },
        EXTENT,
      ),
      viewports[1],
    );
    if (!m) throw new Error("no matrix");
    const back = (rows: number[], x: number, y: number) => {
      const w = rows[6] * x + rows[7] * y + rows[8];
      return {
        x: (rows[0] * x + rows[1] * y + rows[2]) / w,
        y: (rows[3] * x + rows[4] * y + rows[5]) / w,
      };
    };
    const rows = planeInverseRows(m);
    expect(Math.max(...rows.map(Math.abs))).toBeCloseTo(1, 12);
    for (const [x, y] of [
      [0, 0],
      [150, -320],
      [-410, 77],
    ]) {
      const s = applyHomography(m, x, y);
      const p = back(rows, s.x, s.y);
      expect(p.x).toBeCloseTo(x, 6);
      expect(p.y).toBeCloseTo(y, 6);
    }
    const e = projectedCircleEllipse(m, 0, 0, 200);
    if (!e) throw new Error("no ellipse");
    const viaOval = planeInverseRows(m, ovalCtm(e));
    // Local oval point (a, 0) is on the world circle of radius 200.
    const p = back(viaOval, e.a, 0);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(200, 6);
  });
});
