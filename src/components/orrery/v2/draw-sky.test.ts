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
  TileMode: { Clamp: 0, Repeat: 1 },
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
  skyNebulaUniforms,
  skyStarAlpha,
  skyTintNow,
} from "./draw-sky";
import type { SkyImageSpec, SkyNebulaSpec, SkySpec } from "./scene-specs";
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
    nebula: NEBULA,
    ...overrides,
  };
}
const NEBULA: SkyNebulaSpec = {
  lobeA: [0.25, 0.3, 0.65, 1],
  lobeB: [0.4, 0.3, 0.7, 1],
  ember: [0.2, 0.45, 0.55, 1],
  lobeAStrength: 0.47,
  lobeBStrength: 0.42,
  glow: 0.26,
  emberStrength: 0.3,
  dust: 0.38,
  vignette: 0.62,
  vignetteShade: 0.55,
  vignetteInk: null,
  farStars: [
    [1, 1, 1, 1],
    [0.8, 0.9, 1, 1],
    [1, 0.9, 0.7, 1],
  ],
  farStarAlpha: 0.9,
  farStarDensity: 0.5,
};
/** The lobe-B ink the sky shader receives (uniforms 16..18). */
const lobeB = (u: number[]) => u.slice(16, 19);
const fakeImage = {
  width: () => 768,
  height: () => 768,
  makeShaderOptions: (...args: unknown[]) => ({ density: args }),
};
/** A sky effect stub: records every shader it makes. */
const made: { uniforms: number[]; children: unknown[] }[] = [];
const EFFECT = {
  makeShaderWithChildren: (uniforms: number[], children: unknown[]) => {
    made.push({ uniforms, children });
    return { uniforms };
  },
} as never;
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

  it("the System hue leans the nebula's lobe B at draw time; untinted keeps the neutral ink", () => {
    const tinted = skyNebulaUniforms(spec(), HUE, HOME, -1);
    const k = 0.35;
    expect(lobeB(tinted)[0]).toBeCloseTo(0.4 + (HUE[0] - 0.4) * k, 12);
    expect(lobeB(tinted)[2]).toBeCloseTo(0.7 + (HUE[2] - 0.7) * k, 12);
    expect(lobeB(skyNebulaUniforms(spec(), UNTINTED, HOME, -1))).toEqual([
      0.4, 0.3, 0.7,
    ]);
  });

  it("drawSky shades the sky with the from / to hue at tintMix 0 / 1 (no bake involved)", () => {
    for (const [mix, expected] of [
      [0, OTHER],
      [1, HUE],
    ] as const) {
      made.length = 0;
      const { canvas } = recordingCanvas();
      const sky = spec({ tintFrom: OTHER, tintTo: HUE, tintMix: mix });
      drawSky(canvas, sky, IMAGE, HOME, -1, EFFECT);
      expect(made).toHaveLength(1);
      expect(made[0].uniforms).toEqual(
        skyNebulaUniforms(sky, expected, HOME, -1),
      );
    }
  });
});

describe("drawSky", () => {
  it("draws the sky shader over the baked densities, the wash, then one drawPoints per star batch", () => {
    made.length = 0;
    fx.gradients = 0;
    const { canvas, calls } = recordingCanvas();
    drawSky(canvas, spec(), IMAGE, HOME, 0, EFFECT);
    expect(calls.map((c) => c.op)).toEqual([
      "drawPaint",
      "drawPaint",
      "save",
      "translate",
      "drawPoints",
      "drawPoints",
      "restore",
    ]);
    // The shader replaces the analytic gradient; its one child is the
    // repeat-tiled density image.
    expect(fx.gradients).toBe(0);
    expect(made[0].children).toHaveLength(1);
    expect(calls[1].paint?.blend).toBe(14);
  });

  it("before the bake lands, or without the effect: the plain gradient and the stars", () => {
    for (const [image, effect] of [
      [NO_IMAGE, EFFECT],
      [IMAGE, null],
    ] as const) {
      made.length = 0;
      fx.gradients = 0;
      const { canvas, calls } = recordingCanvas();
      drawSky(canvas, spec(), image, HOME, 0, effect);
      expect(made).toHaveLength(0);
      expect(fx.gradients).toBe(1);
      expect(calls.filter((c) => c.op === "drawPoints")).toHaveLength(2);
    }
  });

  it("untinted (All Contacts): no wash", () => {
    const { canvas, calls } = recordingCanvas();
    drawSky(
      canvas,
      spec({ tintFrom: UNTINTED, tintTo: UNTINTED }),
      IMAGE,
      HOME,
      0,
      EFFECT,
    );
    expect(calls.filter((c) => c.op === "drawPaint")).toHaveLength(1);
    expect(SKY_UNTINTED).toBe(-1);
  });

  it("reduced motion is still; drift, breathing and parallax move the nebula; the star offset stays bounded", () => {
    const still = skyNebulaUniforms(spec(), HUE, HOME, -1);
    expect(skyNebulaUniforms(spec(), HUE, HOME, -1)).toEqual(still);
    const later = skyNebulaUniforms(spec(), HUE, HOME, 60_000);
    expect(later).not.toEqual(still);
    // Uniforms stay finite for any pose (tiling texture: no edge to hide).
    const far = skyNebulaUniforms(
      spec(),
      HUE,
      { x: 1e6, y: -1e6, zoom: 4, tilt: 1, yaw: 0.5 },
      60_000,
    );
    expect(far.every((v) => Number.isFinite(v))).toBe(true);
    const { canvas, calls } = recordingCanvas();
    drawSky(canvas, spec(), IMAGE, { x: 1e6, y: 1e6, zoom: 4 }, -1, EFFECT);
    const stars = calls.find((c) => c.op === "translate")?.args as number[];
    expect(Math.abs(stars[0])).toBeLessThanOrEqual(22);
  });
});
