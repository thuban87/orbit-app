/**
 * ORRERY LAB A — camera perf pass: the world plane is drawn in WORLD space
 * under the camera homography. These pin the parts that must stay exact:
 *   - the composed matrix H·T·S maps the cached unit polygon onto exactly the
 *     frame's projected ring (`ringPath`) and `projectWorldPoint`;
 *   - the analytic stroke's screen scale (the Jacobian of H) matches a finite
 *     difference of `projectWorldPoint`, and the chosen band strip is wide
 *     enough to contain the widest stroke + AA everywhere on the ring;
 *   - the uniform blocks match their SkSL declarations (RN-Skia throws on a
 *     length mismatch → the render loop would die on device);
 *   - with the world resources present, each ring is ONE drawVertices (no
 *     per-frame polygon, no CPU stroke) and the grid is ONE draw.
 */
import { describe, expect, it, vi } from "vitest";

interface PaintState {
  alpha: number;
  style: number;
  shader?: { uniforms?: number[] };
}
const calls: { op: string; paint?: PaintState; args: unknown[] }[] = [];

vi.mock("@shopify/react-native-skia", () => {
  const Paint = () => {
    const state: PaintState = { alpha: 1, style: 0 };
    return {
      state,
      setAntiAlias: () => {},
      setStyle: (s: number) => (state.style = s),
      setBlendMode: () => {},
      setStrokeWidth: () => {},
      setAlphaf: (a: number) => (state.alpha = a),
      setShader: (sh: { uniforms?: number[] }) => (state.shader = sh),
      setStrokeCap: () => {},
      setColor: () => {},
    };
  };
  const Builder = () => {
    const b = {
      addPoly: () => b,
      addPath: () => b,
      setIsVolatile: () => b,
      build: () => ({}),
    };
    return b;
  };
  return {
    Skia: {
      Paint,
      Matrix: () => ({}),
      Shader: {
        MakeRadialGradient: () => ({}),
        MakeLinearGradient: () => ({}),
      },
      PathBuilder: { Make: Builder },
      MakeVertices: (mode: number, points: unknown[]) => ({ mode, points }),
    },
  };
});

import {
  type CameraPose,
  projectWorldPoint,
  RING_SEGMENTS,
} from "@/logic/orrery-camera-logic";
import { projectAnimatedFrame } from "@/logic/orrery-frame";
import type { DeepFieldInk } from "./deep-field-ink";
import {
  mapHomography,
  planeHomography,
  SWITCH_FX_IDLE,
} from "./deep-field-math";
import { GRID_SKSL, RING_WORLD_SKSL } from "./deep-field-shaders";
import {
  BAND_EPS,
  circleMatrix,
  drawWorldPlane,
  gridUniforms,
  makePlaneShapes,
  minRadialScale,
  type PlaneRing,
  ringBand,
  ringPerimeter,
  ringWorldUniforms,
} from "./world-plane";

function declaredFloats(sksl: string): number {
  const size: Record<string, number> = {
    float: 1,
    float2: 2,
    float3: 3,
    half4: 4,
  };
  let total = 0;
  for (const m of sksl.matchAll(/uniform\s+(\w+)\s+\w+;/g)) {
    expect(size[m[1]]).toBeDefined();
    total += size[m[1]];
  }
  return total;
}

const viewport = { width: 412, height: 840 };
const poses: CameraPose[] = [
  { x: 0, y: 0, zoom: 1, tilt: 0, yaw: 0, focalDistance: 900 },
  { x: 40, y: -25, zoom: 0.6, tilt: Math.PI / 4, yaw: 0.7, focalDistance: 900 },
  { x: -80, y: 60, zoom: 2.4, tilt: 1, yaw: 4, focalDistance: 1200 },
];

describe("world-space plane matrix (homography)", () => {
  it("H·T·S maps the unit ring polygon onto projectWorldPoint and the frame's ringPath", () => {
    for (const pose of poses) {
      const H = planeHomography(pose, viewport);
      for (const [cx, cy, r] of [
        [0, 0, 150],
        [30, -70, 12],
      ]) {
        const M = circleMatrix(H, cx, cy, r);
        for (let i = 0; i < RING_SEGMENTS; i += 7) {
          const a = (i * 2 * Math.PI) / RING_SEGMENTS;
          const mapped = mapHomography(M, Math.sin(a), -Math.cos(a));
          const exact = projectWorldPoint(
            { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) },
            pose,
            viewport,
          );
          expect(mapped.x).toBeCloseTo(exact.x, 6);
          expect(mapped.y).toBeCloseTo(exact.y, 6);
        }
      }
      const world = [
        {
          id: 1,
          kind: "contact" as const,
          radius: 10,
          ringRadius: 150,
          x: 0,
          y: -150,
          opacity: 1,
          interactive: true,
        },
      ];
      const frame = projectAnimatedFrame(
        { generation: 1, from: world, to: world },
        1,
        pose,
        viewport,
      );
      const Hf = planeHomography(frame.pose, viewport);
      const M = circleMatrix(
        Hf,
        0,
        0,
        frame.bodies[0].ringRadius / frame.pose.zoom,
      );
      frame.bodies[0].ringPath.forEach((p, i) => {
        const a = (i * 2 * Math.PI) / RING_SEGMENTS;
        const m = mapHomography(M, Math.sin(a), -Math.cos(a));
        expect(m.x).toBeCloseTo(p.x, 6);
        expect(m.y).toBeCloseTo(p.y, 6);
      });
    }
  });

  it("the analytic radial screen scale matches a finite difference of the projection", () => {
    for (const pose of poses) {
      const H = planeHomography(pose, viewport);
      const R = 180;
      let low = Infinity;
      for (let i = 0; i < 360; i++) {
        const a = (i * 2 * Math.PI) / 360;
        const dx = Math.sin(a);
        const dy = -Math.cos(a);
        const h = 1e-3;
        const p0 = projectWorldPoint({ x: R * dx, y: R * dy }, pose, viewport);
        const p1 = projectWorldPoint(
          { x: (R + h) * dx, y: (R + h) * dy },
          pose,
          viewport,
        );
        low = Math.min(low, Math.hypot(p1.x - p0.x, p1.y - p0.y) / h);
      }
      const sampled = minRadialScale(H, R);
      // 8 samples: within a few % of the true minimum (BAND_MARGIN covers it).
      expect(sampled).toBeGreaterThanOrEqual(low * 0.999);
      expect(sampled).toBeLessThan(low * 1.08);
    }
  });

  it("picks the narrowest band that still contains the widest stroke + AA", () => {
    const shapes = makePlaneShapes();
    expect(shapes?.bands).toHaveLength(BAND_EPS.length);
    for (const pose of poses) {
      const H = planeHomography(pose, viewport);
      for (const R of [60, 150, 400]) {
        const k = ringBand(shapes, H, R, 1.7, 4);
        if (k < 0) continue;
        // Widest stroke (segment 4 × 0.7) / 2 + 2 dp AA/sampling allowance.
        const need = (((4 * 0.7) / 2 + 2) / minRadialScale(H, R) / R) * 1.1;
        expect(BAND_EPS[k]).toBeGreaterThanOrEqual(need);
        if (k > 0) expect(BAND_EPS[k - 1]).toBeLessThan(need);
      }
    }
  });

  it("uniform blocks match RING_WORLD_SKSL and GRID_SKSL", () => {
    const H = planeHomography(poses[1], viewport);
    const ink = [0.1, 0.2, 0.3, 1];
    expect(
      ringWorldUniforms(
        H,
        100,
        0.3,
        0,
        7,
        0,
        1,
        0.3,
        0.6,
        1,
        ink,
        ink,
        1,
        1,
        0,
        1,
        1.5,
        true,
        ink,
      ),
    ).toHaveLength(declaredFloats(RING_WORLD_SKSL));
    expect(gridUniforms(H, 500, 0.3, 400, 0.3, 0.1, 0.4, 0, ink)).toHaveLength(
      declaredFloats(GRID_SKSL),
    );
  });
});

describe("world-space draw path", () => {
  const grey = [0.5, 0.5, 0.5, 1];
  const ink: DeepFieldInk = {
    chart: false,
    background: grey,
    voidTone: grey,
    nebulaA: grey,
    nebulaB: grey,
    grid: grey,
    starlight: grey,
    shadow: grey,
    textPrimary: grey,
    textSecondary: grey,
  };
  const canvas = new Proxy(
    {},
    {
      get:
        (_t, op: string) =>
        (...args: unknown[]) => {
          const last = args[args.length - 1] as
            | { state?: PaintState }
            | undefined;
          calls.push({
            op,
            paint: last?.state ? { ...last.state } : undefined,
            args,
          });
        },
    },
  ) as never;
  const effect = {
    makeShader: (uniforms: number[]) => ({ uniforms }),
  } as never;

  it("draws each ring as ONE drawVertices and the grid as ONE draw, no ring polygons", () => {
    const n = 6;
    const world = [
      ...Array.from({ length: n }, (_, i) => ({
        id: i + 1,
        kind: "contact" as const,
        radius: 12,
        ringRadius: 80 + 40 * i,
        x: (80 + 40 * i) * Math.sin(i),
        y: -(80 + 40 * i) * Math.cos(i),
        opacity: 1,
        interactive: true,
      })),
      {
        id: 0,
        kind: "sun" as const,
        radius: 30,
        ringRadius: 0,
        x: 0,
        y: 0,
        opacity: 1,
        interactive: true,
      },
    ];
    const frame = projectAnimatedFrame(
      { generation: 1, from: world, to: world },
      1,
      { x: 0, y: 0, zoom: 1, tilt: Math.PI / 4, yaw: 0.3, focalDistance: 1500 },
      viewport,
    );
    const rings: PlaneRing[] = world.slice(0, n).map((b) => ({
      key: `contact:${b.id}`,
      color: [0.9, 0.2, 0.2, 1],
      width: 3,
      strokeStyle: b.id % 2 ? "solid" : "dashed",
      opacity: 1,
      progress: true,
    }));
    calls.length = 0;
    drawWorldPlane(canvas, {
      frame,
      rings,
      fx: SWITCH_FX_IDLE,
      ink,
      extent: 400,
      ringEffect: effect,
      ringWorldEffect: effect,
      gridEffect: effect,
      shapes: makePlaneShapes(),
      pixelRatio: 3.5,
    });
    const verts = calls.filter((c) => c.op === "drawVertices");
    const ringDraws = verts.filter(
      (c) =>
        c.paint?.shader?.uniforms?.length === declaredFloats(RING_WORLD_SKSL),
    );
    const gridDraws = verts.filter(
      (c) => c.paint?.shader?.uniforms?.length === declaredFloats(GRID_SKSL),
    );
    expect(ringDraws).toHaveLength(n);
    expect(gridDraws).toHaveLength(1);
    // Dashed rings carry a dash count (index 11 = uN); solid none.
    ringDraws.forEach((d, i) => {
      expect((d.paint?.shader?.uniforms?.[11] ?? 0) > 0).toBe(i % 2 === 1);
    });
    // Every ring stroke left the CPU path: no stroked drawPath remains.
    expect(calls.some((c) => c.op === "drawPath" && c.paint?.style === 1)).toBe(
      false,
    );
  });
});

describe("Lab frames without ring polygons (camera perf pass)", () => {
  const world = [0, 1, 2].map((i) => ({
    id: i + 1,
    kind: "contact" as const,
    radius: 12,
    ringRadius: 90 + 50 * i,
    x: (90 + 50 * i) * Math.sin(i + 0.3),
    y: -(90 + 50 * i) * Math.cos(i + 0.3),
    opacity: 1,
    interactive: true,
  }));
  const pose = poses[1];

  it("keeps every position, radius, depth and hit radius; only ringPath is empty", () => {
    const full = projectAnimatedFrame(
      { generation: 1, from: world, to: world },
      1,
      pose,
      viewport,
    );
    const lab = projectAnimatedFrame(
      { generation: 1, from: world, to: world },
      1,
      pose,
      viewport,
      false,
    );
    expect(lab.pose).toEqual(full.pose);
    lab.bodies.forEach((b, i) => {
      expect(b.ringPath).toEqual([]);
      expect({ ...b, ringPath: [] }).toEqual({
        ...full.bodies[i],
        ringPath: [],
      });
    });
  });

  it("dash count perimeter matches the 128-gon within 0.5 %", () => {
    const full = projectAnimatedFrame(
      { generation: 1, from: world, to: world },
      1,
      pose,
      viewport,
    );
    const H = planeHomography(full.pose, viewport);
    for (const b of full.bodies) {
      const R = b.ringRadius / full.pose.zoom;
      const exact = ringPerimeter(H, R, b.ringPath);
      const lab = ringPerimeter(H, R, []);
      expect(Math.abs(lab - exact) / exact).toBeLessThan(0.005);
    }
  });
});
