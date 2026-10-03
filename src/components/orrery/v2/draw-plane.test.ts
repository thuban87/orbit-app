import { describe, expect, it, vi } from "vitest";

vi.mock("@shopify/react-native-skia", () => ({
  BlendMode: { Dst: 2, SrcOver: 3 },
  VertexMode: { Triangles: 0, TriangleStrip: 1, TriangleFan: 2 },
  Skia: {
    MakeVertices: (mode: number, points: unknown[]) => ({
      mode,
      count: points.length,
    }),
    Paint: () => {
      const paint = {
        shader: null as unknown,
        style: "fill",
        setShader: (shader: unknown) => {
          paint.shader = shader;
        },
        setStyle: () => {
          paint.style = "stroke";
        },
        setStrokeWidth: () => {},
      };
      return paint;
    },
  },
}));

import {
  type CameraPose,
  type CameraViewport,
  clampCameraPose,
  HORIZON_EPSILON,
  type WorldBody,
} from "@/logic/orrery-camera-logic";
import {
  type AnimatedFrame,
  beginWorldTransition,
  projectAnimatedFrame,
} from "@/logic/orrery-frame";
import {
  applyHomography,
  planeHomography,
  RING_SKIP_ALPHA,
} from "@/logic/orrery-plane-logic";
import { orreryRingStyle } from "@/logic/orrery-ring-logic";
import { THEME_PRESETS } from "@/theme/theme-presets";
import {
  drawPlaneRings,
  makeRingBands,
  RING_BAND_EPS,
  RING_BAND_SEGMENTS,
  ringBandIndex,
  ringDashCount,
} from "./draw-plane";
import type { OrreryInk, RingSpec, RingSpecs } from "./scene-specs";

const DEG = Math.PI / 180;
const viewport: CameraViewport = { width: 412, height: 780 };

interface Call {
  op: string;
  args: unknown[];
}
/** A recording canvas: every call, plus the uniforms of each drawn shader. */
function recordingCanvas() {
  const calls: Call[] = [];
  const canvas = new Proxy(
    {},
    {
      get:
        (_target, op: string) =>
        (...args: unknown[]) => {
          calls.push({ op, args });
        },
    },
  );
  return { canvas: canvas as never, calls };
}
const effect = {
  makeShader: (uniforms: number[]) => ({ uniforms }),
} as never;

const ink = (seed: number): OrreryInk => [seed / 10, 0.2, 0.3, 1];
const spec = (overrides: Partial<RingSpec> = {}): RingSpec => ({
  ink: ink(1),
  widthDp: 2,
  alpha: 1,
  dashPeriodDp: 0,
  ...overrides,
});

function frameFor(
  world: WorldBody[],
  pose: CameraPose,
  opacity?: Record<number, number>,
): AnimatedFrame {
  const frame = projectAnimatedFrame(
    beginWorldTransition([], world, 1),
    1,
    clampCameraPose(pose, 6000),
    viewport,
    { extent: 6000 },
  );
  if (opacity)
    frame.bodies = frame.bodies.map((b) =>
      opacity[b.id] !== undefined ? { ...b, opacity: opacity[b.id] } : b,
    );
  return frame;
}
const contact = (id: number, ringRadius: number, angle = 0): WorldBody => ({
  id,
  kind: "contact",
  x: ringRadius * Math.sin(angle),
  y: -ringRadius * Math.cos(angle),
  radius: 16,
  ringRadius,
});
const draws = (calls: Call[]) => calls.filter((c) => c.op === "drawVertices");
const uniformsOf = (call: Call) =>
  (call.args[2] as { shader: { uniforms: number[] } }).shader.uniforms;

describe("drawPlaneRings (D-44 world plane)", () => {
  const bands = makeRingBands();
  it("builds one cached unit annulus strip per band, once", () => {
    expect(bands).toHaveLength(RING_BAND_EPS.length);
    expect(bands?.[0]).toEqual({
      mode: 1,
      count: (RING_BAND_SEGMENTS + 1) * 2,
    });
  });
  it("one vertices draw per eligible ring, under H·S(R), never a stroke", () => {
    const pose = { x: 0, y: 0, zoom: 1, tilt: 62 * DEG, lensShift: 0.62 };
    const frame = frameFor(
      [
        { id: 0, kind: "sun", x: 0, y: 0, radius: 30, ringRadius: 0 },
        contact(1, 60),
        contact(2, 120, 2),
        contact(3, 180, 4),
      ],
      pose,
    );
    const specs: RingSpecs = {
      "contact:1": spec(),
      "contact:2": spec(),
      "contact:3": spec(),
    };
    const { canvas, calls } = recordingCanvas();
    expect(drawPlaneRings(canvas, frame, specs, effect, bands, 1 / 2.625)).toBe(
      3,
    );
    expect(draws(calls)).toHaveLength(3);
    // Each draw is bracketed by save/concat/restore; the concat is H·S(R).
    const h = planeHomography(frame.pose, frame.viewport);
    const concats = calls.filter((c) => c.op === "concat");
    expect(concats).toHaveLength(3);
    const m = concats[1].args[0] as number[];
    expect(m).toHaveLength(9);
    expect(m[0]).toBeCloseTo(h[0] * 120, 9);
    expect(m[2]).toBeCloseTo(h[2], 9);
    expect(m[7]).toBeCloseTo(h[7] * 120, 9);
    for (const call of draws(calls)) {
      expect(call.args[1]).toBe(2); // BlendMode.Dst: the paint shader colours it
      expect((call.args[2] as { style: string }).style).toBe("fill");
    }
    expect(calls.some((c) => /drawPath|drawOval|drawCircle/.test(c.op))).toBe(
      false,
    );
    // The uniforms carry the exact homography (drawn == tappable).
    expect(uniformsOf(draws(calls)[0]).slice(0, 9)).toEqual(h);
  });
  it("per-status uniforms: today's ink, width, alpha and 6-on-6-off dashes", () => {
    const colors = THEME_PRESETS.galaxy.dark;
    const frame = frameFor(
      [contact(1, 80), contact(2, 120), contact(3, 160), contact(4, 200)],
      { x: 0, y: 0, zoom: 1.5, tilt: 0 },
    );
    const statuses = ["stable", "wobble", "decay", "rogue"] as const;
    const specs: RingSpecs = Object.fromEntries(
      statuses.map((status, i) => {
        const style = orreryRingStyle(status, colors);
        return [
          `contact:${i + 1}`,
          spec({
            ink: ink(i + 1),
            widthDp: style.width,
            alpha:
              style.strokeStyle === "faded"
                ? 0.7
                : style.strokeStyle === "faintTrace"
                  ? 0.3
                  : style.opacity,
            dashPeriodDp:
              style.strokeStyle === "dashed" ||
              style.strokeStyle === "faintTrace"
                ? 12
                : 0,
          }),
        ];
      }),
    );
    const { canvas, calls } = recordingCanvas();
    const aa = 1 / 3;
    drawPlaneRings(canvas, frame, specs, effect, bands, aa);
    const u = draws(calls).map(uniformsOf);
    expect(u).toHaveLength(4);
    // [9 H][R][halfW][AA][dashes][eps][alpha][ink×4]
    const [stable, wobble, decay, rogue] = u;
    expect(stable.slice(9, 15)).toEqual([80, 1, aa, 0, HORIZON_EPSILON, 1]);
    expect(stable.slice(15)).toEqual([...ink(1)]);
    expect(wobble[10]).toBe(1.5);
    expect(wobble[14]).toBe(1);
    // Flat at zoom 1.5: perimeter 2π·120·1.5 ≈ 1131 dp → 94 dashes of 12 dp.
    expect(wobble[12]).toBe(Math.round((2 * Math.PI * 120 * 1.5) / 12));
    expect(decay[10]).toBe(2);
    expect(decay[12]).toBe(0);
    expect(decay[14]).toBeCloseTo(0.7, 12);
    expect(rogue[10]).toBe(1.5);
    expect(rogue[14]).toBeCloseTo(0.3, 12);
    expect(rogue[12]).toBeGreaterThan(0);
    expect(rogue.slice(15)).toEqual([...ink(4)]);
  });
  it("skips rings without a spec, departed (faded-out) rings, and rings below the skip alpha", () => {
    const frame = frameFor(
      [contact(1, 80), contact(2, 120), contact(3, 160), contact(4, 200)],
      { x: 0, y: 0, zoom: 1, tilt: 0 },
      { 2: 0, 3: RING_SKIP_ALPHA / 2 },
    );
    const { canvas, calls } = recordingCanvas();
    const drawn = drawPlaneRings(
      canvas,
      frame,
      {
        "contact:1": spec(),
        "contact:2": spec(),
        "contact:3": spec(),
      },
      effect,
      bands,
      0.5,
    );
    expect(drawn).toBe(1);
    expect(uniformsOf(draws(calls)[0])[9]).toBe(80);
  });
  it("draws nothing without a compiled effect or strips", () => {
    const frame = frameFor([contact(1, 80)], { x: 0, y: 0, zoom: 1 });
    const { canvas, calls } = recordingCanvas();
    expect(
      drawPlaneRings(canvas, frame, { "contact:1": spec() }, null, bands, 1),
    ).toBe(0);
    expect(
      drawPlaneRings(canvas, frame, { "contact:1": spec() }, effect, null, 1),
    ).toBe(0);
    expect(calls).toHaveLength(0);
  });
  it("H2: a ring wholly beyond the horizon (culled body) is skipped; a culled body's ring that still crosses the screen keeps its visible arc", () => {
    // Close up, looking south from far out on the +y axis: the sun and the
    // inner rings are behind the camera; the big ring still crosses in front.
    const pose = {
      x: 0,
      y: 3000,
      zoom: 4,
      tilt: 62 * DEG,
      yaw: Math.PI,
      lensShift: 0.62,
    };
    const frame = frameFor(
      [contact(1, 100), contact(2, 3000, Math.PI / 2)],
      pose,
    );
    expect(frame.bodies[0].culled).toBe(true);
    const { canvas, calls } = recordingCanvas();
    const drawn = drawPlaneRings(
      canvas,
      frame,
      { "contact:1": spec(), "contact:2": spec() },
      effect,
      bands,
      0.4,
    );
    expect(drawn).toBe(1);
    expect(uniformsOf(draws(calls)[0])[9]).toBe(3000);
    // The near-plane threshold the shader discards at is the camera's cull.
    expect(uniformsOf(draws(calls)[0])[13]).toBe(HORIZON_EPSILON);
    const h = planeHomography(frame.pose, frame.viewport);
    expect(applyHomography(h, 0, 0)).toBeNull();
  });
  it("density fade: packed orbits dim (never below the floor), spacious ones keep full alpha", () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      contact(i + 1, 58 + i * 34, i),
    );
    const specs: RingSpecs = Object.fromEntries(
      many.map((b) => [`contact:${b.id}`, spec()]),
    );
    const zoomedOut = frameFor(many, { x: 0, y: 0, zoom: 0.25, tilt: 0 });
    const out = recordingCanvas();
    drawPlaneRings(out.canvas, zoomedOut, specs, effect, bands, 1);
    const alphaOut = uniformsOf(draws(out.calls)[0])[14];
    expect(alphaOut).toBeLessThan(0.3);
    expect(alphaOut).toBeGreaterThan(0);
    const close = frameFor(many, { x: 0, y: 0, zoom: 1, tilt: 0 });
    const near = recordingCanvas();
    drawPlaneRings(near.canvas, close, specs, effect, bands, 1);
    expect(uniformsOf(draws(near.calls)[0])[14]).toBe(1);
  });
  it("band selection covers the line plus AA where the plane is most compressed", () => {
    const pose = clampCameraPose(
      { x: 0, y: 0, zoom: 0.25, tilt: 68 * DEG, lensShift: 0.62 },
      6000,
    );
    const h = planeHomography(pose, viewport);
    for (const radius of [58, 400, 4000]) {
      const band = ringBandIndex(h, radius, 2, 0.4);
      expect(band).toBeGreaterThanOrEqual(0);
      // Far-side strip half-width in screen dp ≥ line half-width + AA.
      const far = applyHomography(h, 0, -radius);
      const farOut = applyHomography(h, 0, -radius * (1 + RING_BAND_EPS[band]));
      if (far && farOut)
        expect(Math.abs(farOut.y - far.y)).toBeGreaterThanOrEqual(2.4);
    }
  });
  it("dash count keeps today's 12 dp period, bounded", () => {
    const h = planeHomography(
      clampCameraPose({ x: 0, y: 0, zoom: 1, tilt: 0 }, 1000),
      viewport,
    );
    expect(ringDashCount(h, 120, 0)).toBe(0);
    expect(ringDashCount(h, 120, 12)).toBe(
      Math.round((2 * Math.PI * 120) / 12),
    );
    expect(ringDashCount(h, 1, 12)).toBe(4);
  });
});
