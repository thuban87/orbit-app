import { describe, expect, it, vi } from "vitest";

const fx = vi.hoisted(() => ({
  matrices: [] as number[][],
  gradients: 0,
}));

vi.mock("@shopify/react-native-skia", () => ({
  BlendMode: { SrcOver: 3, Screen: 14 },
  FilterMode: { Linear: 1 },
  MipmapMode: { None: 0 },
  PaintStyle: { Fill: 0, Stroke: 1 },
  PointMode: { Points: 0 },
  StrokeCap: { Round: 1 },
  TileMode: { Clamp: 0 },
  Skia: {
    XYWHRect: (x: number, y: number, width: number, height: number) => ({
      x,
      y,
      width,
      height,
    }),
    Shader: {
      MakeLinearGradient: (
        start: unknown,
        end: unknown,
        colors: Float32Array[],
      ) => {
        fx.gradients++;
        return { start, end, colors: colors.map((c) => [...c]) };
      },
    },
    ColorFilter: {
      MakeMatrix: (m: number[]) => {
        fx.matrices.push(m);
        return { matrix: m };
      },
    },
    Paint: () => {
      const paint = {
        color: [] as number[],
        blend: undefined as number | undefined,
        filter: undefined as unknown,
        shader: undefined as unknown,
        width: 0,
        setAntiAlias: () => {},
        setStyle: () => {},
        setStrokeCap: () => {},
        setStrokeWidth: (w: number) => {
          paint.width = w;
        },
        setBlendMode: (b: number) => {
          paint.blend = b;
        },
        setColorFilter: (f: unknown) => {
          paint.filter = f;
        },
        setShader: (s: unknown) => {
          paint.shader = s;
        },
        setColor: (c: Float32Array) => {
          paint.color = [...c];
        },
      };
      return paint;
    },
  },
}));

import { SKY_UNTINTED } from "@/logic/orrery-sky-logic";
import {
  drawSky,
  skyNebulaTintMatrix,
  skyStarAlpha,
  skyTintNow,
} from "./draw-sky";
import type { SkyImageSpec, SkySpec } from "./scene-specs";
import { SKY_TWINKLE_SPEED } from "./visual-tunables";

interface Call {
  op: string;
  args: unknown[];
  paint: {
    color: number[];
    blend?: number;
    filter?: { matrix: number[] };
    shader?: { colors: number[][] };
    width: number;
  } | null;
}
function recordingCanvas() {
  const calls: Call[] = [];
  const canvas = new Proxy(
    {},
    {
      get:
        (_t, op: string) =>
        (...args: unknown[]) => {
          const last = args.at(-1) as Call["paint"] | undefined;
          const paint =
            last && typeof last === "object" && "color" in last
              ? { ...last, color: [...last.color] }
              : null;
          calls.push({ op, args, paint });
        },
    },
  );
  return { canvas: canvas as never, calls };
}

const HUE: readonly [number, number, number, number] = [0.25, 0.5, 0.875, 1];
const OTHER: readonly [number, number, number, number] = [
  0.875, 0.375, 0.125, 1,
];
const UNTINTED: readonly [number, number, number, number] = [0, 0, 0, 0];

function spec(overrides: Partial<SkySpec> = {}): SkySpec {
  return {
    width: 400,
    height: 800,
    coverWidth: 512,
    coverHeight: 896,
    base: [0.125, 0.125, 0.25, 1],
    horizon: [0.25, 0.25, 0.5, 1],
    horizonStop: 0.6,
    additive: true,
    tintFrom: HUE,
    tintTo: HUE,
    tintMix: 1,
    tintStrength: 0.35,
    tintWash: 0.05,
    stars: [
      {
        points: [
          { x: 1, y: 2 },
          { x: 3, y: 4 },
        ],
        ink: [1, 1, 1, 1],
        diameter: 1.2,
        alpha: 0.8,
        phase: 0,
      },
      {
        points: [{ x: 5, y: 6 }],
        ink: [0.8, 0.9, 1, 1],
        diameter: 2.6,
        alpha: 0.9,
        phase: Math.PI,
      },
    ],
    twinkleDepth: 0.4,
    ...overrides,
  };
}
const fakeImage = { width: () => 128, height: () => 224 };
const IMAGE: SkyImageSpec = {
  generation: 1,
  mountEpoch: 1,
  image: fakeImage as never,
  key: "galaxy/dark/512x896",
};
const NO_IMAGE: SkyImageSpec = {
  generation: 0,
  mountEpoch: 0,
  image: null,
  key: "",
};
const HOME = { x: 0, y: 0, zoom: 1 };

describe("skyStarAlpha (twinkle)", () => {
  it("swings around the band middle on the ambient clock; holds the middle under reduced motion", () => {
    const mid = 0.8 * (1 - 0.4 / 2);
    expect(skyStarAlpha(0.8, 0.4, 0, -1)).toBeCloseTo(mid, 12);
    const peak = Math.PI / 2 / SKY_TWINKLE_SPEED;
    expect(skyStarAlpha(0.8, 0.4, 0, peak)).toBeCloseTo(0.8, 12);
    expect(skyStarAlpha(0.8, 0.4, 0, 3 * peak)).toBeCloseTo(0.8 * 0.6, 12);
    // No twinkle (light themes): constant whatever the clock.
    expect(skyStarAlpha(0.5, 0, 0, peak)).toBe(0.5);
    expect(skyStarAlpha(0.5, 0, 0, -1)).toBe(0.5);
  });
});

describe("the System tint is a draw-time value (H9)", () => {
  it("tintMix 0 draws exactly the from hue; 1 exactly the to hue", () => {
    expect(
      skyTintNow(spec({ tintFrom: OTHER, tintTo: HUE, tintMix: 0 })),
    ).toEqual(OTHER);
    expect(
      skyTintNow(spec({ tintFrom: OTHER, tintTo: HUE, tintMix: 1 })),
    ).toEqual(HUE);
    // Halfway from untinted: the hue at half strength (never darkened).
    const half = skyTintNow(
      spec({ tintFrom: UNTINTED, tintTo: HUE, tintMix: 0.5 }),
    );
    expect(half.slice(0, 3)).toEqual(HUE.slice(0, 3));
    expect(half[3]).toBeCloseTo(0.5, 12);
  });

  it("the nebula colour filter carries the drawn tint: additive on dark, a lerp on light", () => {
    const dark = skyNebulaTintMatrix(HUE, 0.5, true);
    expect(dark[0]).toBe(1);
    expect(dark[4]).toBeCloseTo(HUE[0] * 0.5, 12);
    expect(dark[9]).toBeCloseTo(HUE[1] * 0.5, 12);
    expect(dark[14]).toBeCloseTo(HUE[2] * 0.5, 12);
    expect(dark.slice(15)).toEqual([0, 0, 0, 1, 0]);
    const light = skyNebulaTintMatrix(HUE, 0.5, false);
    expect(light[0]).toBeCloseTo(0.5, 12);
    expect(light[4]).toBeCloseTo(HUE[0] * 0.5, 12);
    // Untinted (alpha 0): the identity.
    expect(skyNebulaTintMatrix(UNTINTED, 0.5, true)).toEqual([
      1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0,
    ]);
  });

  it("drawSky tints the nebula with the from / to hue at tintMix 0 / 1 (no bake involved)", () => {
    for (const [mix, expected] of [
      [0, OTHER],
      [1, HUE],
    ] as const) {
      fx.matrices = [];
      const { canvas, calls } = recordingCanvas();
      drawSky(
        canvas,
        spec({ tintFrom: OTHER, tintTo: HUE, tintMix: mix }),
        IMAGE,
        HOME,
        0,
      );
      const nebula = calls.find((c) => c.op === "drawImageRectOptions");
      expect(nebula?.paint?.filter?.matrix).toEqual(
        skyNebulaTintMatrix(expected, 0.35, true),
      );
      const wash = calls.filter((c) => c.op === "drawPaint")[1];
      expect(wash.paint?.color.slice(0, 3)).toEqual([...expected.slice(0, 3)]);
    }
  });
});

describe("drawSky", () => {
  it("draws gradient, wash, the neutral image, then one drawPoints per star batch", () => {
    fx.gradients = 0;
    const { canvas, calls } = recordingCanvas();
    drawSky(canvas, spec(), IMAGE, HOME, 0);
    expect(calls.map((c) => c.op)).toEqual([
      "drawPaint",
      "drawPaint",
      "drawImageRectOptions",
      "save",
      "translate",
      "drawPoints",
      "drawPoints",
      "restore",
    ]);
    // The gradient: horizon (top) → base.
    expect(fx.gradients).toBe(1);
    expect(calls[0].paint?.shader?.colors).toEqual([
      [0.25, 0.25, 0.5, 1],
      [0.125, 0.125, 0.25, 1],
    ]);
    // Dark (additive): screen wash and nebula.
    expect(calls[1].paint?.blend).toBe(14);
    expect(calls[2].paint?.blend).toBe(14);
    // The image covers the bucket, centred on the canvas (no offset at Home,
    // ambient 0).
    expect(calls[2].args[2]).toEqual({
      x: -56,
      y: -48,
      width: 512,
      height: 896,
    });
    // Star batches: diameter → stroke width; alpha = base × twinkle.
    expect(calls[5].paint?.width).toBe(1.2);
    expect(calls[5].paint?.color[3]).toBeCloseTo(
      skyStarAlpha(0.8, 0.4, 0, 0),
      6,
    );
    expect(calls[6].paint?.width).toBe(2.6);
  });

  it("light themes (spec.additive false) draw src-over ink washes", () => {
    const { canvas, calls } = recordingCanvas();
    drawSky(canvas, spec({ additive: false }), IMAGE, HOME, 0);
    expect(calls[1].paint?.blend).toBe(3);
    expect(calls[2].paint?.blend).toBe(3);
  });

  it("untinted (All Contacts): no wash and no colour filter", () => {
    fx.matrices = [];
    const { canvas, calls } = recordingCanvas();
    drawSky(
      canvas,
      spec({ tintFrom: UNTINTED, tintTo: UNTINTED }),
      IMAGE,
      HOME,
      0,
    );
    expect(calls.filter((c) => c.op === "drawPaint")).toHaveLength(1);
    expect(fx.matrices).toHaveLength(0);
    expect(SKY_UNTINTED).toBe(-1);
  });

  it("before the bake lands: the plain gradient and the stars, no image", () => {
    const { canvas, calls } = recordingCanvas();
    drawSky(canvas, spec(), NO_IMAGE, HOME, 0);
    expect(calls.some((c) => c.op === "drawImageRectOptions")).toBe(false);
    expect(calls[0].op).toBe("drawPaint");
    expect(calls.filter((c) => c.op === "drawPoints")).toHaveLength(2);
  });

  it("drift and parallax move the nebula and stars (bounded); reduced motion is still", () => {
    const at = (ambient: number, pose = HOME) => {
      const { canvas, calls } = recordingCanvas();
      drawSky(canvas, spec(), IMAGE, pose, ambient);
      const image = calls.find((c) => c.op === "drawImageRectOptions")
        ?.args[2] as { x: number; y: number };
      const stars = calls.find((c) => c.op === "translate")?.args as number[];
      return { image, stars };
    };
    const still = at(-1);
    expect(still.image).toEqual({ x: -56, y: -48, width: 512, height: 896 });
    expect(still.stars).toEqual([0, 0]);
    // A minute of ambient time drifts a few dp.
    const drifted = at(60_000);
    expect(drifted.image.x).not.toBe(-56);
    expect(Math.abs(drifted.image.x + 56)).toBeLessThan(12);
    // A pan shifts the sky slightly (parallax), never by more than the margin.
    const panned = at(-1, { x: 1e6, y: 1e6, zoom: 4 });
    expect(Math.abs(panned.image.x + 56)).toBeLessThanOrEqual(22);
    expect(Math.abs(panned.stars[0])).toBeLessThanOrEqual(22);
  });
});
