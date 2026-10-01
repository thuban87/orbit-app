/**
 * ORRERY LAB A — the world-plane picture keeps the canonical status line
 * language that the pre-Lab per-ring `<Path>` nodes carried (formerly pinned
 * structurally in orrery-render.test): one status-tinted hairline per contact
 * plus one full-status segment near each body (pass 1 hierarchy inversion),
 * dashed for wobble + rogue on BOTH, alpha factors faded 0.7 / faint-trace 0.3
 * / neutral 0.5 kept as ratios, width channel 2/3/4, and no additive glow.
 *
 * PASS 2 (device performance): every ring stroke is the ring's projected
 * closed polygon (the frame's own `ringPath`) shaded by ONE analytic runtime
 * shader (RING_SKSL uniforms: mode 0 hairline / 1 segment, dash count), and
 * the plane never uses path effects or ellipse ops (both forced Ganesh off
 * its GPU fast paths on the Pixel). Those guards are pinned here too.
 */
import { describe, expect, it, vi } from "vitest";

interface PaintState {
  alpha: number;
  width: number;
  pathEffect: boolean;
  blend: number;
  style: number;
  color?: number[];
  shader?: { uniforms?: number[] };
}
const calls: { op: string; paint: PaintState; args: unknown[] }[] = [];

vi.mock("@shopify/react-native-skia", () => {
  const Paint = () => {
    const state: PaintState = {
      alpha: 1,
      width: 0,
      pathEffect: false,
      blend: 3,
      style: 0,
    };
    return {
      state,
      setAntiAlias: () => {},
      setStyle: (s: number) => (state.style = s),
      setBlendMode: (b: number) => (state.blend = b),
      setStrokeWidth: (w: number) => (state.width = w),
      setAlphaf: (a: number) => (state.alpha = a),
      setShader: (sh: { uniforms?: number[] }) => (state.shader = sh),
      setPathEffect: () => (state.pathEffect = true),
      setStrokeCap: () => {},
      setColor: (c: ArrayLike<number>) => {
        state.color = Array.from(c);
        state.alpha = state.color[3];
      },
    };
  };
  const Builder = () => {
    const points: unknown[] = [];
    const b = {
      points,
      addPoly: (p: unknown[]) => {
        points.push(...p);
        return b;
      },
      moveTo: (x: number, y: number) => {
        points.push({ x, y });
        return b;
      },
      lineTo: (x: number, y: number) => {
        points.push({ x, y });
        return b;
      },
      setIsVolatile: () => b,
      build: () => ({ points }),
    };
    return b;
  };
  return {
    Skia: {
      Paint,
      Matrix: () => ({ rotate: () => {}, translate: () => {} }),
      Shader: {
        MakeRadialGradient: () => ({}),
        MakeLinearGradient: () => ({}),
        MakeSweepGradient: () => ({}),
      },
      PathBuilder: { Make: Builder },
      XYWHRect: (x: number, y: number, width: number, height: number) => ({
        x,
        y,
        width,
        height,
      }),
    },
  };
});

import { projectAnimatedFrame } from "@/logic/orrery-frame";
import { RING_HAIR_SCALE, SEGMENT_SCALE } from "./deep-field-config";
import type { DeepFieldInk } from "./deep-field-ink";
import { SWITCH_FX_IDLE } from "./deep-field-math";
import { drawWorldPlane, type PlaneRing, type TrailState } from "./world-plane";

const canvas = new Proxy(
  {},
  {
    get: (_t, op: string) =>
      [
        "drawCircle",
        "drawArc",
        "drawPath",
        "drawLine",
        "drawOval",
        "drawRect",
      ].includes(op)
        ? (...args: unknown[]) => {
            const paint = args[args.length - 1] as { state: PaintState };
            calls.push({ op, paint: { ...paint.state }, args });
          }
        : () => {},
  },
) as never;

/** A runtime-effect stand-in: records the uniform block per shader. */
const ringEffect = {
  makeShader: (uniforms: number[]) => ({ uniforms }),
} as never;
const MODE = 2; // RING_SKSL uniform index: uMode
const DASHES = 3; // uN
const SPAN = 13; // uSpan

const grey = [0.5, 0.5, 0.5, 1];
const ink = (chart: boolean): DeepFieldInk => ({
  chart,
  background: grey,
  voidTone: grey,
  nebulaA: grey,
  nebulaB: grey,
  grid: grey,
  starlight: grey,
  shadow: grey,
  textPrimary: grey,
  textSecondary: grey,
});

const statuses: [PlaneRing["strokeStyle"], number, number, boolean][] = [
  ["solid", 2, 1, true], // stable
  ["dashed", 3, 1, true], // wobble
  ["faded", 4, 1, true], // decay
  ["faintTrace", 3, 1, true], // rogue
  ["solid", 2, 0.5, false], // never contacted
];
const expectedAlpha = [1, 1, 0.7, 0.3, 0.5];

function scene(zoom: number, spin = 0) {
  const world = [
    ...statuses.map((_, i) => {
      const ring = 60 + 40 * i;
      const angle = 0.5 + i * 0.9 + spin;
      return {
        id: i + 1,
        kind: "contact" as const,
        radius: 16,
        ringRadius: ring,
        x: ring * Math.sin(angle),
        y: -ring * Math.cos(angle),
        opacity: 1,
        interactive: true,
      };
    }),
    {
      id: 0,
      kind: "sun" as const,
      x: 0,
      y: 0,
      radius: 30,
      ringRadius: 0,
      opacity: 1,
      interactive: true,
    },
  ];
  const frame = projectAnimatedFrame(
    { generation: 1, from: world, to: world },
    1,
    { x: 0, y: 0, zoom, tilt: 0.6, yaw: 0.4 },
    { width: 412, height: 840 },
  );
  const rings: PlaneRing[] = statuses.map(
    ([strokeStyle, width, opacity, progress], i) => ({
      key: `contact:${i + 1}`,
      color: [0.1 * i, 0.2, 0.3, 1],
      width,
      strokeStyle,
      opacity,
      progress,
    }),
  );
  return { frame, rings };
}

const ringStrokes = (mode: number) =>
  calls.filter(
    (c) =>
      c.op === "drawPath" &&
      c.paint.style === 1 &&
      c.paint.shader?.uniforms?.[MODE] === mode,
  );

describe("Lab A world plane keeps the canonical ring language", () => {
  it("draws one hairline + one status segment per contact with the canonical dash/alpha/width channels", () => {
    calls.length = 0;
    const zoom = 1.5;
    const { frame, rings } = scene(zoom);
    drawWorldPlane(canvas, {
      frame,
      rings,
      fx: SWITCH_FX_IDLE,
      ink: ink(false),
      extent: 300,
      ringEffect,
    });
    const hairs = ringStrokes(0);
    expect(hairs).toHaveLength(statuses.length);
    const unitAlpha = hairs[0].paint.alpha / expectedAlpha[0];
    hairs.forEach((hair, i) => {
      expect(hair.paint.alpha).toBeCloseTo(expectedAlpha[i] * unitAlpha, 6);
      expect((hair.paint.shader?.uniforms?.[DASHES] ?? 0) > 0).toBe(
        i === 1 || i === 3,
      );
      // Screen px: the 2/3/4 width channel kept proportional.
      expect(hair.paint.width).toBeCloseTo(statuses[i][1] * RING_HAIR_SCALE, 6);
      // The hairline IS the frame's projected ring polygon.
      const path = hair.args[0] as { points: unknown[] };
      expect(path.points).toEqual(frame.bodies[i].ringPath);
    });
    // One status segment per contact (never-contacted: symmetric, no trail),
    // same dash language and width channel as its ring.
    const segments = ringStrokes(1);
    expect(segments).toHaveLength(statuses.length);
    segments.forEach((seg, i) => {
      expect((seg.paint.shader?.uniforms?.[DASHES] ?? 0) > 0).toBe(
        i === 1 || i === 3,
      );
      expect(seg.paint.width).toBeCloseTo(statuses[i][1] * SEGMENT_SCALE, 6);
      expect(seg.paint.alpha).toBeLessThanOrEqual(expectedAlpha[i] + 1e-6);
      // A short segment, never a second ring (≤ 75° + 14° in world angle,
      // < half a turn on screen even under tilt).
      expect(seg.paint.shader?.uniforms?.[SPAN] ?? 9).toBeLessThan(Math.PI);
    });
    // Pass 1: no additive ring glow (dashed glow read as beads); the only
    // additive draw at idle is the sun-lit pool FILL.
    expect(calls.some((c) => c.paint.blend === 12 && c.paint.style === 1)).toBe(
      false,
    );
  });
  it("never uses path effects or ellipse ops (Ganesh GPU fast paths)", () => {
    calls.length = 0;
    const { frame, rings } = scene(1);
    drawWorldPlane(canvas, {
      frame,
      rings,
      fx: SWITCH_FX_IDLE,
      ink: ink(false),
      extent: 300,
      ringEffect,
    });
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.some((c) => c.paint.pathEffect)).toBe(false);
    expect(calls.some((c) => c.op === "drawOval" || c.op === "drawArc")).toBe(
      false,
    );
  });
  it("chart (light) mode draws ink only — no additive glow anywhere", () => {
    calls.length = 0;
    const { frame, rings } = scene(1);
    drawWorldPlane(canvas, {
      frame,
      rings,
      fx: SWITCH_FX_IDLE,
      ink: ink(true),
      extent: 300,
      ringEffect,
    });
    expect(calls.some((c) => c.paint.blend === 12)).toBe(false);
  });
  it("draws motion trails only while FX are active, from the real recent path", () => {
    const trails: TrailState = { pts: {} };
    const active = {
      ...SWITCH_FX_IDLE,
      active: true,
      velocity: 1,
      progress: 0.4,
      roles: [0, 0, 0, 0, 0, 3],
      stages: [1, 1, 1, 1, 1, 1],
    };
    const additiveStrokes = () =>
      calls.filter((c) => c.paint.blend === 12 && c.paint.style === 1);
    // Frame 1 seeds the history; frame 2 (bodies spun on) draws the trails.
    calls.length = 0;
    const a = scene(1);
    drawWorldPlane(canvas, {
      ...a,
      fx: active,
      ink: ink(false),
      extent: 300,
      ringEffect,
      trails,
      now: 1000,
    });
    const b = scene(1, 0.3);
    calls.length = 0;
    drawWorldPlane(canvas, {
      ...b,
      fx: active,
      ink: ink(false),
      extent: 300,
      ringEffect,
      trails,
      now: 1050,
    });
    expect(additiveStrokes()).toHaveLength(statuses.length);
    // Idle → no FX, and the history is dropped.
    calls.length = 0;
    drawWorldPlane(canvas, {
      ...b,
      fx: SWITCH_FX_IDLE,
      ink: ink(false),
      extent: 300,
      ringEffect,
      trails,
      now: 1100,
    });
    expect(additiveStrokes()).toHaveLength(0);
    expect(trails.pts).toEqual({});
  });
});
