import { describe, expect, it, vi } from "vitest";

vi.mock("@shopify/react-native-skia", () => ({
  BlendMode: { Dst: 2, SrcOver: 3, Plus: 12 },
  VertexMode: { Triangles: 0, TriangleStrip: 1, TriangleFan: 2 },
  Skia: {
    // A deterministic stand-in for Skia's token parser: distinct per token.
    Color: (token: string) => {
      let hash = 0;
      for (let i = 0; i < token.length; i++)
        hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
      return Float32Array.of(
        (hash % 251) / 256,
        ((hash >> 8) % 251) / 256,
        ((hash >> 16) % 251) / 256,
        1,
      );
    },
    MakeVertices: (mode: number, points: unknown[]) => ({
      mode,
      count: points.length,
    }),
    Paint: () => {
      const paint = {
        shader: null as unknown,
        style: "fill",
        blend: undefined as number | undefined,
        setBlendMode: (blend: number) => {
          paint.blend = blend;
        },
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
  RING_DENSITY_FLOOR,
  RING_SKIP_ALPHA,
} from "@/logic/orrery-plane-logic";
import { orreryRingStyle } from "@/logic/orrery-ring-logic";
import { THEME_PRESETS } from "@/theme/theme-presets";
import {
  basePlaneKey,
  drawPlaneGrid,
  drawPlanePulses,
  drawPlaneRings,
  makeGridDisc,
  makeRingBands,
  pulsePlacement,
  pulseRings,
  RING_BAND_EPS,
  RING_BAND_SEGMENTS,
  ringBandIndex,
  ringDashCount,
  sameBasePlaneKey,
} from "./draw-plane";
import {
  buildRingSpecs,
  type GridSpec,
  type OrreryInk,
  type PulseSpec,
  type RingSpec,
  type RingSpecs,
} from "./scene-specs";
import {
  PULSE_BUDGET,
  PULSE_CYCLE_MS,
  PULSE_HALF_WIDTH_DP,
  PULSE_SPEED,
  PULSE_TRAVEL_MS,
  RING_LOOKS,
  RING_SUN_LIGHT_RADIUS,
  RING_WIDTH_BASE,
  RING_WIDTH_SCALE,
} from "./visual-tunables";

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
          // Like an SkPicture recording, a draw keeps a COPY of its paint
          // (38.7-15: one paint is re-shaded for every ring of a recording).
          calls.push({
            op,
            args: args.map((arg) =>
              arg !== null && typeof arg === "object" && "setShader" in arg
                ? { ...arg }
                : arg,
            ),
          });
        },
    },
  );
  return { canvas: canvas as never, calls };
}
const effect = {
  makeShader: (uniforms: number[]) => ({ uniforms }),
} as never;

const ink = (seed: number): OrreryInk => [seed / 10, 0.2, 0.3, 1];
const LIGHT: OrreryInk = [1, 0.9, 0.8, 1];
const spec = (overrides: Partial<RingSpec> = {}): RingSpec => ({
  ink: ink(1),
  widthDp: 2,
  alpha: 1,
  dashPeriodDp: 0,
  dashDuty: 1,
  lightGain: 0,
  lightMix: 0,
  farAlpha: 1,
  light: LIGHT,
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
  it("D-11 per-status uniforms: Lab B's thin widths (weight still orders status), dash duties, alphas and the sun-lit rim", () => {
    const colors = THEME_PRESETS.galaxy.dark;
    const frame = frameFor(
      [contact(1, 80), contact(2, 120), contact(3, 160), contact(4, 200)],
      { x: 0, y: 0, zoom: 1.5, tilt: 0 },
    );
    const statuses = ["stable", "wobble", "decay", "rogue"] as const;
    const built = buildRingSpecs(
      statuses.map((status, i) => ({
        key: `contact:${i + 1}`,
        body: {
          id: i + 1,
          kind: "contact" as const,
          x: 0,
          y: 0,
          radius: 16,
          ringRadius: 80 + i * 40,
        },
        scene: { contacts: [{ id: i + 1, status }] } as never,
      })),
      colors,
      RING_LOOKS.galaxy.dark,
    );
    const { canvas, calls } = recordingCanvas();
    const aa = 1 / 3;
    drawPlaneRings(canvas, frame, built, effect, bands, aa);
    const u = draws(calls).map(uniformsOf);
    expect(u).toHaveLength(4);
    // [9 H][R][halfW][AA][dashes][eps][alpha][ink×4][duty][lit×4][light×4][arc×4]
    for (const uniforms of u) expect(uniforms).toHaveLength(32);
    const [stable, wobble, decay, rogue] = u;
    const width = (status: (typeof statuses)[number]) =>
      orreryRingStyle(status, colors).width * RING_WIDTH_SCALE +
      RING_WIDTH_BASE;
    // Thin: every line is under 2 dp wide, and weight still orders status.
    expect(stable[10]).toBeCloseTo(width("stable") / 2, 12);
    expect(wobble[10]).toBeCloseTo(width("wobble") / 2, 12);
    expect(decay[10]).toBeCloseTo(width("decay") / 2, 12);
    expect(rogue[10]).toBeCloseTo(width("rogue") / 2, 12);
    expect(stable[10]).toBeLessThan(wobble[10]);
    expect(wobble[10]).toBeLessThan(decay[10]);
    for (const uniforms of u) expect(uniforms[10] * 2).toBeLessThan(2);
    // The ladder: solid / dashed / faded / faint trace.
    expect(stable.slice(9, 15)).toEqual([
      80,
      stable[10],
      aa,
      0,
      HORIZON_EPSILON,
      1,
    ]);
    expect(stable[19]).toBe(1);
    // Wobble: 11 dp dashes at 0.58 on. Flat at zoom 1.5 → perimeter/11.
    expect(wobble[12]).toBe(Math.round((2 * Math.PI * 120 * 1.5) / 11));
    expect(wobble[19]).toBeCloseTo(0.58, 12);
    expect(decay[12]).toBe(0);
    expect(decay[14]).toBeCloseTo(0.7, 12);
    // Rogue: a 6 dp faint trace at 0.3 on, alpha 0.42.
    expect(rogue[12]).toBe(Math.round((2 * Math.PI * 200 * 1.5) / 6));
    expect(rogue[19]).toBeCloseTo(0.3, 12);
    expect(rogue[14]).toBeCloseTo(0.42, 12);
    // Status colour is the ring ink (the non-colour cues above carry it too).
    expect(stable.slice(15, 19)).toEqual([...built["contact:1"].ink]);
    expect(rogue.slice(15, 19)).toEqual([...built["contact:4"].ink]);
    // The sun-lit rim: Galaxy Dark's gain and mix, the light radius from the
    // outermost orbit, the far-side alpha, the ring-light ink; no arc.
    const look = RING_LOOKS.galaxy.dark;
    for (const uniforms of u) {
      expect(uniforms.slice(20, 24)).toEqual([
        look.lightGain,
        200 * RING_SUN_LIGHT_RADIUS,
        look.lightMix,
        look.farAlpha,
      ]);
      expect(uniforms.slice(24, 28)).toEqual([...built["contact:1"].light]);
      expect(uniforms.slice(28, 30)).toEqual([0, 0]);
    }
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
    // Owner ruling 2026-10-04 (T-FADE = FADE-80): packed rings sit at the 0.8 floor.
    expect(alphaOut).toBeLessThan(1);
    expect(alphaOut).toBeCloseTo(RING_DENSITY_FLOOR, 9);
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

describe("drawPlaneGrid (D-09: Lab C-style orbital-plane grid)", () => {
  const disc = makeGridDisc();
  const grid = (opacity: number): GridSpec => ({
    ink: ink(5),
    opacity,
    rings: 6,
    spokes: 12,
    halfWidthDp: 0.4,
    extent: 1.12,
    farAlpha: 0.55,
  });
  const pose = { x: 0, y: 0, zoom: 1, tilt: 62 * DEG, lensShift: 0.62 };
  const world = [contact(1, 60), contact(2, 240, 1)];

  it("builds one cached unit disc fan, once", () => {
    expect(disc).toMatchObject({ mode: 2 });
  });

  it("opacity 0 draws nothing at all (not even a transparent draw)", () => {
    const { canvas, calls } = recordingCanvas();
    expect(
      drawPlaneGrid(canvas, frameFor(world, pose), grid(0), effect, disc, 0.4),
    ).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("draws ONE analytic world-plane draw under H·S(reach) with the grid uniforms", () => {
    const frame = frameFor(world, pose);
    const { canvas, calls } = recordingCanvas();
    expect(drawPlaneGrid(canvas, frame, grid(0.12), effect, disc, 0.4)).toBe(
      true,
    );
    expect(draws(calls)).toHaveLength(1);
    const u = uniformsOf(draws(calls)[0]);
    const h = planeHomography(frame.pose, frame.viewport);
    expect(u).toHaveLength(21);
    expect(u.slice(0, 9)).toEqual(h);
    expect(u[9]).toBeCloseTo(240 * 1.12, 9);
    expect(u.slice(10, 17)).toEqual([
      0.4,
      0.4,
      HORIZON_EPSILON,
      6,
      12,
      0.12,
      0.55,
    ]);
    expect(u.slice(17)).toEqual([...ink(5)]);
    const concat = calls.find((c) => c.op === "concat")?.args[0] as number[];
    expect(concat[0]).toBeCloseTo(h[0] * 240 * 1.12, 9);
  });

  it("horizon-safe: a grid wholly beyond the horizon is skipped; no effect or disc → nothing", () => {
    const behind = frameFor([contact(1, 100)], {
      x: 0,
      y: 3000,
      zoom: 4,
      tilt: 62 * DEG,
      yaw: Math.PI,
      lensShift: 0.62,
    });
    const { canvas, calls } = recordingCanvas();
    expect(drawPlaneGrid(canvas, behind, grid(0.2), effect, disc, 0.4)).toBe(
      false,
    );
    const ok = frameFor(world, pose);
    expect(drawPlaneGrid(canvas, ok, grid(0.2), null, disc, 0.4)).toBe(false);
    expect(drawPlaneGrid(canvas, ok, grid(0.2), effect, null, 0.4)).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("drawPlanePulses (D-10/D-37/D-49: subtle orbit pulses on the ambient clock)", () => {
  const PULSE_INK: OrreryInk = [0.9, 0.92, 1, 1];
  const pulse = (overrides: Partial<PulseSpec> = {}): PulseSpec => ({
    ink: PULSE_INK,
    intensity: 0.25,
    budget: PULSE_BUDGET,
    additive: true,
    farAlpha: 0.55,
    ...overrides,
  });
  const world = Array.from({ length: 30 }, (_, i) =>
    contact(i + 1, 80 + i * 30, i),
  );
  // Five status looks (stable, wobble, decay, rogue, neutral) on 30 rings.
  const specs: RingSpecs = Object.fromEntries(
    world.map((b, i) => [
      `contact:${b.id}`,
      spec({
        ink: ink(i % 5),
        widthDp: 1 + (i % 5) * 0.2,
        alpha: [1, 1, 0.7, 0.42, 0.5][i % 5],
        dashPeriodDp: [0, 11, 0, 6, 0][i % 5],
      }),
    ]),
  );
  const frame = frameFor(world, { x: 0, y: 0, zoom: 0.6, tilt: 0 });

  it("never more than the budget; none under reduced motion (ambient −1), with budget 0 or intensity 0", () => {
    for (let ms = 0; ms < PULSE_CYCLE_MS * 3; ms += 333) {
      const { canvas, calls } = recordingCanvas();
      const drawn = drawPlanePulses(
        canvas,
        pulseRings(frame, specs),
        pulse(),
        ms,
        effect,
        makeRingBands(),
        0.4,
      );
      expect(drawn).toBeLessThanOrEqual(PULSE_BUDGET);
      expect(draws(calls)).toHaveLength(drawn);
    }
    for (const [ambient, p] of [
      [-1, pulse()],
      [5000, pulse({ budget: 0 })],
      [5000, pulse({ intensity: 0 })],
    ] as const) {
      const { canvas, calls } = recordingCanvas();
      expect(
        drawPlanePulses(
          canvas,
          pulseRings(frame, specs),
          p,
          ambient,
          effect,
          makeRingBands(),
          0.4,
        ),
      ).toBe(0);
      expect(calls).toHaveLength(0);
    }
  });

  it("identical for every status: same ink, width, no dashes, no sun light; only the ring and arc differ", () => {
    let seen = 0;
    for (let ms = 0; ms < PULSE_CYCLE_MS; ms += 250) {
      const { canvas, calls } = recordingCanvas();
      drawPlanePulses(
        canvas,
        pulseRings(frame, specs),
        pulse(),
        ms,
        effect,
        makeRingBands(),
        0.4,
      );
      for (const call of draws(calls)) {
        const u = uniformsOf(call);
        seen++;
        expect(u[10]).toBe(PULSE_HALF_WIDTH_DP);
        expect(u[12]).toBe(0); // never dashed
        expect(u.slice(15, 19)).toEqual([...PULSE_INK]);
        expect(u[20]).toBe(0); // no sun light term
        expect(u[23]).toBe(0.55); // the far-side fade like the rings
        expect(u[29]).toBeGreaterThan(0); // an arc, not a whole ring
        expect(u[14]).toBeLessThanOrEqual(0.25); // ≤ the intensity
        // Additive on dark.
        expect((call.args[2] as { blend?: number }).blend).toBe(12);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("deterministic from the ring index and the ambient time; travels clockwise, fades in and out, then rests", () => {
    expect(pulsePlacement(0, 8, 1234, 30)).toEqual(
      pulsePlacement(0, 8, 1234, 30),
    );
    const a = pulsePlacement(0, 8, 1000, 30);
    const b = pulsePlacement(0, 8, 2000, 30);
    expect(a && b).toBeTruthy();
    expect(b?.ring).toBe(a?.ring);
    expect((b?.centre ?? 0) - (a?.centre ?? 0)).toBeCloseTo(PULSE_SPEED, 9);
    expect(pulsePlacement(0, 8, 0, 30)?.envelope).toBeCloseTo(0, 9);
    expect(pulsePlacement(0, 8, PULSE_TRAVEL_MS / 2, 30)?.envelope).toBeCloseTo(
      1,
      9,
    );
    // Slot 0 rests between its travels when the travel is shorter than the
    // cycle; when it fills the cycle (Lab B: always travelling) the envelope
    // still fades to zero at the hand-over, so no pulse pops.
    if (PULSE_TRAVEL_MS < PULSE_CYCLE_MS)
      expect(pulsePlacement(0, 8, PULSE_TRAVEL_MS + 10, 30)).toBeNull();
    else
      expect(
        pulsePlacement(0, 8, PULSE_CYCLE_MS + 1, 30)?.envelope,
      ).toBeCloseTo(0, 3);
    // Over many cycles the pulses visit many rings (not a fixed few).
    const rings = new Set<number>();
    for (let c = 0; c < 60; c++)
      rings.add(pulsePlacement(0, 8, c * PULSE_CYCLE_MS + 100, 30)?.ring ?? -1);
    expect(rings.size).toBeGreaterThan(10);
    expect(pulsePlacement(0, 8, -1, 30)).toBeNull();
    expect(pulsePlacement(0, 0, 100, 30)).toBeNull();
  });

  it("light themes: src-over pulses", () => {
    let blends = 0;
    for (let ms = 0; ms < PULSE_CYCLE_MS; ms += 500) {
      const { canvas, calls } = recordingCanvas();
      drawPlanePulses(
        canvas,
        pulseRings(frame, specs),
        pulse({ additive: false }),
        ms,
        effect,
        makeRingBands(),
        0.4,
      );
      for (const call of draws(calls)) {
        expect((call.args[2] as { blend?: number }).blend).toBe(3);
        blends++;
      }
    }
    expect(blends).toBeGreaterThan(0);
  });
});

describe("38.7-15: the base key (what the grid and rings read from a frame)", () => {
  const pose = { x: 0, y: 0, zoom: 1, tilt: 62 * DEG, lensShift: 0.62 };
  const sun: WorldBody = {
    id: 0,
    kind: "sun",
    x: 0,
    y: 0,
    radius: 30,
    ringRadius: 0,
  };
  const world = (turn: number) => [
    sun,
    contact(1, 60, turn),
    contact(2, 120, 2 + turn),
    contact(3, 180, 4 + turn),
  ];
  const specs: RingSpecs = {
    "contact:1": spec(),
    "contact:2": spec({ dashPeriodDp: 6, dashDuty: 0.5 }),
    "contact:3": spec({ lightGain: 0.4, lightMix: 0.5 }),
  };
  const grid: GridSpec = {
    ink: ink(5),
    opacity: 0.12,
    rings: 6,
    spokes: 12,
    halfWidthDp: 0.4,
    extent: 1.12,
    farAlpha: 0.55,
  };
  const record = (frame: AnimatedFrame) => {
    const { canvas, calls } = recordingCanvas();
    drawPlaneGrid(canvas, frame, grid, effect, makeGridDisc(), 0.4);
    drawPlaneRings(canvas, frame, specs, effect, makeRingBands(), 0.4);
    return calls.map((call) => ({
      op: call.op,
      args: call.args.map((arg) =>
        arg !== null && typeof arg === "object" && "shader" in arg
          ? (arg as { shader: unknown }).shader
          : arg,
      ),
    }));
  };
  it("a world turned about the sun under the same camera keeps the key — and records the very same grid and rings", () => {
    const still = frameFor(world(0), pose);
    const turned = frameFor(world(0.7), pose);
    expect(turned.bodies.map((b) => b.x)).not.toEqual(
      still.bodies.map((b) => b.x),
    );
    expect(sameBasePlaneKey(basePlaneKey(still, null), turned)).toBe(true);
    // The memo's premise: body positions draw nothing in the base.
    expect(record(turned)).toEqual(record(still));
  });
  it("a camera, zoom, opacity, orbit or contact-set change breaks it; the key is rewritten in place", () => {
    const base = frameFor(world(0), pose);
    const key = basePlaneKey(base, null);
    const arrays = [key.h, key.ids, key.opacity, key.radius];
    expect(
      sameBasePlaneKey(key, frameFor(world(0), { ...pose, yaw: 0.2 })),
    ).toBe(false);
    expect(
      sameBasePlaneKey(key, frameFor(world(0), { ...pose, zoom: 1.2 })),
    ).toBe(false);
    expect(sameBasePlaneKey(key, frameFor(world(0), pose, { 2: 0.5 }))).toBe(
      false,
    );
    expect(
      sameBasePlaneKey(
        key,
        frameFor(
          [sun, contact(1, 60), contact(2, 130, 2), contact(3, 180, 4)],
          pose,
        ),
      ),
    ).toBe(false);
    expect(
      sameBasePlaneKey(key, frameFor([...world(0), contact(4, 240)], pose)),
    ).toBe(false);
    expect(sameBasePlaneKey(key, frameFor(world(0).slice(0, 3), pose))).toBe(
      false,
    );
    // Rewritten in place (no new arrays per frame on the UI runtime).
    const moved = frameFor(world(0), { ...pose, yaw: 0.2 });
    const next = basePlaneKey(moved, key);
    expect(next).toBe(key);
    [next.h, next.ids, next.opacity, next.radius].forEach((array, i) => {
      expect(array).toBe(arrays[i]);
    });
    expect(sameBasePlaneKey(next, moved)).toBe(true);
    expect(sameBasePlaneKey(next, base)).toBe(false);
  });
});
