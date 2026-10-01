/**
 * ORRERY LAB A — the world-plane picture keeps the canonical status line
 * language that the pre-Lab per-ring `<Path>` nodes carried (formerly pinned
 * structurally in orrery-render.test): one status-coloured core stroke per
 * contact, dashed for wobble + rogue, alpha factors faded 0.7 / faint-trace 0.3
 * / neutral 0.5, width channel 2/3/4, and no trail for never-contacted.
 */
import { describe, expect, it, vi } from "vitest";

interface PaintState {
  alpha: number;
  width: number;
  dashed: boolean;
  blend: number;
  style: number;
  color?: number[];
}
const calls: { op: string; paint: PaintState; args: unknown[] }[] = [];

vi.mock("@shopify/react-native-skia", () => {
  const Paint = () => {
    const state: PaintState = {
      alpha: 1,
      width: 0,
      dashed: false,
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
      setShader: () => {},
      setPathEffect: (e: unknown) => (state.dashed = !!e),
      setStrokeCap: () => {},
      setColor: (c: ArrayLike<number>) => (state.color = Array.from(c)),
    };
  };
  return {
    Skia: {
      Paint,
      Matrix: () => ({ rotate: () => {} }),
      Shader: {
        MakeRadialGradient: () => ({}),
        MakeLinearGradient: () => ({}),
        MakeSweepGradient: () => ({}),
      },
      Path: {
        Make: () => ({
          addCircle: () => {},
          moveTo: () => {},
          lineTo: () => {},
        }),
      },
      PathEffect: { MakeDash: () => ({ dash: true }) },
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
import { RING_CORE_SCALE } from "./deep-field-config";
import type { DeepFieldInk } from "./deep-field-ink";
import { SWITCH_FX_IDLE } from "./deep-field-math";
import { drawWorldPlane, type PlaneRing } from "./world-plane";

const canvas = new Proxy(
  {},
  {
    get: (_t, op: string) =>
      ["drawCircle", "drawArc", "drawPath", "drawLine"].includes(op)
        ? (...args: unknown[]) => {
            const paint = args[args.length - 1] as { state: PaintState };
            calls.push({ op, paint: { ...paint.state }, args });
          }
        : () => {},
  },
) as never;

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

function scene(zoom: number) {
  const world = [
    ...statuses.map((_, i) => {
      const ring = 60 + 40 * i;
      const angle = 0.5 + i * 0.9;
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

describe("Lab A world plane keeps the canonical ring language", () => {
  it("draws one status core per contact with the canonical dash/alpha/width channels", () => {
    calls.length = 0;
    const zoom = 1.5;
    const { frame, rings } = scene(zoom);
    drawWorldPlane(canvas, {
      frame,
      rings,
      fx: SWITCH_FX_IDLE,
      ink: ink(false),
      extent: 300,
    });
    // Core strokes = full-circle srcOver strokes with the core width.
    const cores = calls.filter(
      (c) =>
        c.op === "drawCircle" && c.paint.style === 1 && c.paint.blend === 3,
    );
    expect(cores).toHaveLength(statuses.length);
    cores.forEach((core, i) => {
      expect(core.paint.alpha).toBeCloseTo(expectedAlpha[i], 6);
      expect(core.paint.dashed).toBe(i === 1 || i === 3);
      expect(core.paint.width).toBeCloseTo(
        (statuses[i][1] * RING_CORE_SCALE) / zoom,
        6,
      );
    });
    // Dark mode adds an additive (plus) underglow per ring.
    const glows = calls.filter(
      (c) =>
        c.op === "drawCircle" && c.paint.blend === 12 && c.paint.style === 1,
    );
    expect(glows).toHaveLength(statuses.length);
    // Trails: two arcs per contacted body; never-contacted has none.
    const arcs = calls.filter((c) => c.op === "drawArc");
    expect(arcs).toHaveLength(2 * (statuses.length - 1));
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
    });
    expect(calls.some((c) => c.paint.blend === 12)).toBe(false);
  });
  it("draws switch streaks only while FX are active", () => {
    calls.length = 0;
    const { frame, rings } = scene(1);
    drawWorldPlane(canvas, {
      frame,
      rings,
      fx: {
        ...SWITCH_FX_IDLE,
        active: true,
        velocity: 1,
        roles: [0, 0, 0, 0, 0, 3],
        stages: [1, 1, 1, 1, 1, 1],
      },
      ink: ink(false),
      extent: 300,
    });
    const arcs = calls.filter((c) => c.op === "drawArc");
    // trails (2 × 4) + one streak per contact (5)
    expect(arcs).toHaveLength(2 * 4 + 5);
  });
});
