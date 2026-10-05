import { describe, expect, it, vi } from "vitest";

vi.mock("@shopify/react-native-skia", () => ({
  BlendMode: { Dst: 2, SrcOver: 3, Plus: 12 },
  PaintStyle: { Fill: 0, Stroke: 1 },
  PointMode: { Points: 0, Lines: 1 },
  StrokeCap: { Butt: 0, Round: 1 },
  VertexMode: { Triangles: 0, TriangleStrip: 1, TriangleFan: 2 },
  Skia: {
    MakeVertices: (mode: number, points: unknown[]) => ({
      mode,
      count: points.length,
    }),
    Paint: () => {
      const paint = {
        blend: undefined as number | undefined,
        shader: null as unknown,
        setAntiAlias: () => {},
        setStyle: () => {},
        setStrokeCap: () => {},
        setStrokeWidth: () => {},
        setColor: () => {},
        setBlendMode: (blend: number) => {
          paint.blend = blend;
        },
        setShader: (shader: unknown) => {
          paint.shader = shader;
        },
      };
      return paint;
    },
  },
}));

import {
  type CameraPose,
  clampCameraPose,
  type WorldBody,
} from "@/logic/orrery-camera-logic";
import {
  type AnimatedFrame,
  beginWorldTransition,
  projectAnimatedFrame,
} from "@/logic/orrery-frame";
import { beginSwitchChoreography } from "@/logic/orrery-switch-choreography";
import {
  type SwitchFxSignal,
  sampleSwitchSignal,
} from "@/logic/orrery-switch-fx-logic";
import { makeRingBands } from "./draw-plane";
import {
  drawOrbitTrails,
  skyHueMix,
  switchTrailRoles,
  type TrailLook,
  warpStreak,
  warpStreakSegmentAlphas,
} from "./draw-switch";
import type { RingSpec, RingSpecs } from "./scene-specs";
import {
  TRAIL_ALPHA,
  TRAIL_BUDGET,
  TRAIL_LEAVING_MS,
  TRAIL_MAX_ARC,
  TRAIL_MS,
  WARP_STREAK_MAX_DP,
  WARP_SWIRL,
} from "./visual-tunables";

const TAU = Math.PI * 2;

describe("the star warp (Lab B, ported as drawn)", () => {
  it("a streak's head sits on its star and its tail points back toward the centre, twisted by the swirl", () => {
    const s = warpStreak(300, 200, 200, 200, 400, 1, 0.22);
    expect(s).not.toBeNull();
    expect([s?.hx, s?.hy]).toEqual([300, 200]);
    // length = 190 × warp × clamp(d / half, 0.12, 1.4) × (0.45 + 2.5 × 0.22)
    const len = WARP_STREAK_MAX_DP * 1 * Math.max(0.12, 100 / 400) * 1.0;
    const dx = (s?.hx ?? 0) - (s?.tx ?? 0);
    const dy = (s?.hy ?? 0) - (s?.ty ?? 0);
    expect(Math.hypot(dx, dy)).toBeCloseTo(len, 9);
    expect(Math.atan2(dy, dx)).toBeCloseTo(WARP_SWIRL, 9);
    // Short near the centre (floor 0.12), capped far out (1.4), none at rest.
    const near = warpStreak(201, 200, 200, 200, 400, 1, 0.1);
    expect(
      Math.hypot(
        (near?.hx ?? 0) - (near?.tx ?? 0),
        (near?.hy ?? 0) - (near?.ty ?? 0),
      ),
    ).toBeCloseTo(WARP_STREAK_MAX_DP * 0.12 * 0.7, 9);
    expect(warpStreak(200.5, 200, 200, 200, 400, 1, 0.1)).toBeNull();
    expect(warpStreak(300, 200, 200, 200, 400, 0, 0.1)).toBeNull();
  });

  it("the stepped sprite gradient rises from the tail to the head", () => {
    const alphas = warpStreakSegmentAlphas(3, 0.3, 0.72);
    expect(alphas).toHaveLength(3);
    expect(alphas[0]).toBeCloseTo(0.0694, 3);
    expect(alphas[1]).toBeCloseTo(0.2083, 3);
    expect(alphas[2]).toBeGreaterThan(0.55);
    expect(alphas[2]).toBeLessThan(0.65);
  });

  it("the sky-hue mix follows the switch that owns the crossfade (arrival-order safe)", () => {
    const signal = { generation: 7, skyHue: 0.4 } as SwitchFxSignal;
    expect(skyHueMix(7, signal)).toBe(0.4);
    expect(skyHueMix(8, signal)).toBe(0);
    expect(skyHueMix(6, signal)).toBe(1);
    expect(skyHueMix(7, null)).toBe(1);
  });
});

// ── Orbit streaks (Lab A) ───────────────────────────────────────────────────

const viewport = { width: 412, height: 780 };
const contact = (id: number, ringRadius: number, angle = 0): WorldBody => ({
  id,
  kind: "contact",
  x: ringRadius * Math.sin(angle),
  y: -ringRadius * Math.cos(angle),
  radius: 16,
  ringRadius,
});
const ringSpec: RingSpec = {
  ink: [0.5, 0.6, 0.7, 1],
  widthDp: 2,
  alpha: 1,
  dashPeriodDp: 0,
  dashDuty: 1,
  lightGain: 0,
  lightMix: 0,
  farAlpha: 1,
  light: [1, 1, 1, 1],
};
function frameFor(world: WorldBody[], pose: CameraPose): AnimatedFrame {
  return projectAnimatedFrame(
    beginWorldTransition([], world, 1),
    1,
    clampCameraPose(pose, 6000),
    viewport,
    { extent: 6000 },
  );
}
function recordingCanvas() {
  const calls: { op: string; args: unknown[] }[] = [];
  const canvas = new Proxy(
    {},
    {
      get:
        (_t, op: string) =>
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
const effect = { makeShader: (uniforms: number[]) => ({ uniforms }) } as never;
const bands = makeRingBands();
const look: TrailLook = {
  peak: TRAIL_ALPHA.dark,
  additive: true,
  budget: TRAIL_BUDGET,
};
const uniforms = (calls: { op: string; args: unknown[] }[]) =>
  calls
    .filter((c) => c.op === "drawVertices")
    .map(
      (c) => (c.args[2] as { shader: { uniforms: number[] } }).shader.uniforms,
    );

describe("the orbit streaks (Lab A, analytic, budgeted)", () => {
  const source = [contact(1, 80, 0.3), contact(2, 120, 1.0)];
  const destination = [contact(2, 120, 2.0), contact(3, 160, 4.0)];
  const transition = beginSwitchChoreography(source, destination, 4, {
    intensity: 1,
    reducedMotion: false,
  });

  it("roles: leaving, entering and retained (a retained body also travels its forward angle)", () => {
    const roles = switchTrailRoles(transition);
    expect(roles.generation).toBe(4);
    expect(roles.byKey["contact:1"]).toEqual([1, 1]);
    expect(roles.byKey["contact:3"]).toEqual([0, 1]);
    const [leaving, share] = roles.byKey["contact:2"];
    expect(leaving).toBe(0);
    expect(share).toBeCloseTo(
      (1.0 + transition.spinTurns * TAU) / transition.maximumRotation,
      9,
    );
    // A settled choreography never streaks: no index.
    expect(switchTrailRoles({ ...transition, settledWorld: [] }).byKey).toEqual(
      {},
    );
  });

  const flat: CameraPose = { x: 0, y: 0, zoom: 1, tilt: 0, yaw: 0 };
  const specs: RingSpecs = {
    "contact:1": ringSpec,
    "contact:2": ringSpec,
    "contact:3": ringSpec,
  };

  it("draws one one-sided arc per moving contact, its head at the body and its length = speed × TRAIL_MS (capped)", () => {
    const signal = sampleSwitchSignal(transition, 0.4, 2100);
    const frame = frameFor([contact(2, 120, 1.0), contact(1, 80, 0.3)], flat);
    const { canvas, calls } = recordingCanvas();
    const drawn = drawOrbitTrails(
      canvas,
      frame,
      specs,
      signal,
      switchTrailRoles(transition),
      effect,
      bands,
      0.5,
      look,
    );
    expect(drawn).toBe(2);
    const [retained, leaving] = uniforms(calls);
    // uArc = (head, length, trail flag, ramp mid).
    expect(retained[28]).toBeCloseTo(1.0, 6);
    expect(retained[30]).toBe(1);
    const roles = switchTrailRoles(transition);
    expect(retained[29]).toBeCloseTo(
      Math.min(
        TRAIL_MAX_ARC,
        signal.angularSpeed * roles.byKey["contact:2"][1] * (TRAIL_MS / 1000),
      ),
      6,
    );
    expect(leaving[28]).toBeCloseTo(0.3, 6);
    expect(leaving[29]).toBeCloseTo(
      Math.min(TRAIL_MAX_ARC, signal.angularSpeed * (TRAIL_LEAVING_MS / 1000)),
      6,
    );
  });

  it("nothing under reduced motion, when settled, for another transition's roles, or without the effect", () => {
    const frame = frameFor([contact(2, 120, 1.0)], flat);
    const roles = switchTrailRoles(transition);
    const reduced = beginSwitchChoreography(source, destination, 4, {
      intensity: 1,
      reducedMotion: true,
    });
    const cases: [SwitchFxSignal, typeof roles, unknown][] = [
      [sampleSwitchSignal(reduced, 0.4, 2100), roles, effect],
      [sampleSwitchSignal(transition, 1, 2100), roles, effect],
      [
        sampleSwitchSignal(transition, 0.4, 2100),
        { ...roles, generation: 3 },
        effect,
      ],
      [sampleSwitchSignal(transition, 0.4, 2100), roles, null],
    ];
    for (const [signal, r, e] of cases) {
      const { canvas, calls } = recordingCanvas();
      expect(
        drawOrbitTrails(
          canvas,
          frame,
          specs,
          signal,
          r,
          e as never,
          bands,
          0.5,
          look,
        ),
      ).toBe(0);
      expect(calls).toEqual([]);
    }
  });

  it("D-53: never more than the budget, nearest the camera first", () => {
    const many: WorldBody[] = Array.from({ length: 40 }, (_, i) =>
      contact(100 + i, 60 + i * 9, (i * 0.7) % TAU),
    );
    const t = beginSwitchChoreography([], many, 9, {
      intensity: 1,
      reducedMotion: false,
    });
    const tilted: CameraPose = { x: 0, y: 0, zoom: 0.6, tilt: 1, yaw: 0 };
    const frame = frameFor(many, tilted);
    const all: RingSpecs = Object.fromEntries(
      many.map((b) => [`contact:${b.id}`, ringSpec]),
    );
    const signal = sampleSwitchSignal(t, 0.5, 2100);
    const { canvas, calls } = recordingCanvas();
    const drawn = drawOrbitTrails(
      canvas,
      frame,
      all,
      signal,
      switchTrailRoles(t),
      effect,
      bands,
      0.5,
      { ...look, budget: 5 },
    );
    expect(drawn).toBe(5);
    expect(uniforms(calls).length).toBe(drawn);
    // The five drawn are the five deepest-toward-camera bodies.
    const nearest = [...frame.bodies]
      .filter((b) => !b.culled)
      .sort((a, b) => b.depth - a.depth)
      .slice(0, 5)
      .map((b) => b.worldRingRadius)
      .sort((a, b) => a - b);
    const drawnRadii = uniforms(calls)
      .map((u) => u[9])
      .sort((a, b) => a - b);
    expect(drawnRadii).toEqual(nearest.slice(0, drawnRadii.length));
  });
});
