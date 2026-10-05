import { describe, expect, it, vi } from "vitest";

const fx = vi.hoisted(() => ({
  matrices: [] as number[][],
  gradients: 0,
}));

vi.mock("@shopify/react-native-skia", () => ({
  BlendMode: { SrcOver: 3, Plus: 12, Screen: 14 },
  FilterMode: { Linear: 1 },
  MipmapMode: { None: 0 },
  PaintStyle: { Fill: 0, Stroke: 1 },
  PointMode: { Points: 0, Lines: 1 },
  StrokeCap: { Butt: 0, Round: 1 },
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
import type { SwitchFxSignal } from "@/logic/orrery-switch-fx-logic";
import {
  drawSky,
  skyNebulaUniforms,
  skyPhase,
  skyStarAlpha,
  skyTintNow,
} from "./draw-sky";
import type { SkyImageSpec, SkyNebulaSpec, SkySpec } from "./scene-specs";
import {
  SKY_STILL_S,
  SKY_TWINKLE_SPEED,
  SKY_WARP_RATE_A,
  SKY_WARP_RATE_B,
} from "./visual-tunables";

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
    tintGeneration: 0,
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
        layer: "mid",
      },
      {
        points: [{ x: 5, y: 6 }],
        ink: [0.8, 0.9, 1, 1],
        diameter: 2.6,
        alpha: 0.9,
        phase: Math.PI,
        layer: "near",
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

  it("WR-02: the breathing warp is continuous at every elapsed time — no jump at the old 1,000 s wrap (or any multiple)", () => {
    // Uniforms 40 (breath dp), 41 and 43 (the two domain-warp phases).
    const motion = (ms: number) => {
      const u = skyNebulaUniforms(spec(), HUE, HOME, ms);
      return { breath: u[40], a: u[41], b: u[43] };
    };
    /** The shader sees sin/cos of each phase: compare those (wrap-proof). */
    const step = (from: number, to: number) => {
      const p = motion(from);
      const q = motion(to);
      return Math.max(
        Math.abs(p.breath - q.breath),
        Math.abs(Math.sin(p.a) - Math.sin(q.a)),
        Math.abs(Math.cos(p.b) - Math.cos(q.b)),
      );
    };
    // One ambient step (~33 ms) is a tiny move anywhere, across the old wrap
    // and after hours open.
    for (const at of [1_000_000, 2_000_000, 7_200_000, 86_400_000])
      expect(step(at - 33, at)).toBeLessThan(0.05);
    // The phases are wrapped mod 2π (finite, bounded) and equal rate × time.
    for (const ms of [0, 999_967, 1_000_000, 86_400_000]) {
      const { a, b } = motion(ms);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(Math.PI * 2);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(Math.PI * 2);
      expect(Math.sin(a)).toBeCloseTo(
        Math.sin((ms / 1000) * SKY_WARP_RATE_A),
        6,
      );
      expect(Math.cos(b)).toBeCloseTo(
        Math.cos((ms / 1000) * SKY_WARP_RATE_B),
        6,
      );
    }
    // Reduced motion keeps its fixed composition.
    const still = motion(-1);
    expect(still.a).toBeCloseTo(skyPhase(SKY_STILL_S, SKY_WARP_RATE_A), 12);
    expect(still.b).toBeCloseTo(skyPhase(SKY_STILL_S, SKY_WARP_RATE_B), 12);
  });
});

describe("38.7-13: the switch on the sky (D-24 warp, D-08 hue crossfade, H9)", () => {
  /** A switch signal to generation `generation` at `progress`. */
  const signal = (over: Partial<SwitchFxSignal> = {}): SwitchFxSignal => ({
    generation: 5,
    progress: 0.5,
    running: true,
    reducedMotion: false,
    intensity: 1,
    velocity: 1,
    angularSpeed: 10,
    warp: 0,
    trail: 0,
    breath: 0,
    skyHue: 0,
    ...over,
  });
  const crossfading = spec({
    tintFrom: OTHER,
    tintTo: HUE,
    tintMix: 1,
    tintGeneration: 5,
  });
  const drawnTint = (s: SwitchFxSignal | null) => {
    made.length = 0;
    drawSky(recordingCanvas().canvas, crossfading, IMAGE, HOME, -1, EFFECT, s);
    return made[0].uniforms;
  };

  it("the drawn tint is the outgoing hue at progress 0 and the incoming hue at 1, by draw-time uniforms only", () => {
    expect(drawnTint(signal({ progress: 0, skyHue: 0 }))).toEqual(
      skyNebulaUniforms(crossfading, OTHER, HOME, -1),
    );
    expect(
      drawnTint(signal({ progress: 1, running: false, skyHue: 1 })),
    ).toEqual(skyNebulaUniforms(crossfading, HUE, HOME, -1));
    // Arrival order (Lab B): a frame still drawing an OLDER switch shows the
    // outgoing hue even if the weight says otherwise; a newer one the incoming.
    expect(drawnTint(signal({ generation: 4, skyHue: 1 }))).toEqual(
      skyNebulaUniforms(crossfading, OTHER, HOME, -1),
    );
    expect(drawnTint(signal({ generation: 6, skyHue: 0 }))).toEqual(
      skyNebulaUniforms(crossfading, HUE, HOME, -1),
    );
    // No signal (rest): the spec's own mix.
    expect(drawnTint(null)).toEqual(
      skyNebulaUniforms(crossfading, HUE, HOME, -1),
    );
  });

  it("no warp (rest, reduced motion): exactly the resting sky — no streaks, no push", () => {
    const rest = recordingCanvas();
    drawSky(rest.canvas, spec(), IMAGE, HOME, 0, EFFECT);
    const calm = recordingCanvas();
    drawSky(calm.canvas, spec(), IMAGE, HOME, 0, EFFECT, signal({ warp: 0 }));
    expect(calm.calls.map((c) => c.op)).toEqual(rest.calls.map((c) => c.op));
  });

  it("a warp streaks every mid/near star once (the budget is the sky's own stars) and pushes the field", () => {
    made.length = 0;
    const { canvas, calls } = recordingCanvas();
    drawSky(canvas, spec(), IMAGE, HOME, 0, EFFECT, signal({ warp: 0.8 }));
    const lines = calls.filter((c) => c.op === "drawPoints" && c.args[0] === 1);
    // One drawPoints(Lines) per star batch per fade segment, 2 points each.
    const segments = lines.length / spec().stars.length;
    expect(Number.isInteger(segments)).toBe(true);
    const streaks = lines.reduce(
      (n, c) => n + (c.args[1] as unknown[]).length / 2,
      0,
    );
    expect(streaks / segments).toBe(3); // 2 + 1 stars
    // Each streak's alpha ramps toward its head (Lab B's sprite gradient).
    const alphas = lines.slice(0, segments).map((c) => c.paint?.color[3] ?? 0);
    for (let k = 1; k < alphas.length; k++)
      expect(alphas[k]).toBeGreaterThan(alphas[k - 1]);
    // The nebula and far stars push outward (uniforms 35 and 42: zoom scale).
    const still = skyNebulaUniforms(spec(), HUE, HOME, 0);
    expect(made[0].uniforms[35]).toBeGreaterThan(still[35]);
    expect(made[0].uniforms[42]).toBeGreaterThan(still[42]);
  });
});
