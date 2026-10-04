import { describe, expect, it, vi } from "vitest";

vi.mock("@shopify/react-native-skia", () => ({
  ClipOp: { Difference: 0, Intersect: 1 },
  FilterMode: { Nearest: 0, Linear: 1 },
  MipmapMode: { None: 0, Nearest: 1, Linear: 2 },
  PaintStyle: { Fill: 0, Stroke: 1 },
  Skia: {
    Paint: () => {
      const paint = {
        color: [] as number[],
        alpha: 1,
        style: 0,
        width: 0,
        setAntiAlias: () => {},
        setColor: (c: Float32Array) => {
          paint.color = [...c];
        },
        setAlphaf: (a: number) => {
          paint.alpha = a;
        },
        setStyle: (s: number) => {
          paint.style = s;
        },
        setStrokeWidth: (w: number) => {
          paint.width = w;
        },
      };
      return paint;
    },
    XYWHRect: (x: number, y: number, width: number, height: number) => ({
      x,
      y,
      width,
      height,
    }),
    RRectXY: (rect: unknown, rx: number, ry: number) => ({ rect, rx, ry }),
  },
}));

import type { AnimatedFrame } from "@/logic/orrery-frame";
import {
  drawBodies,
  drawSun,
  orderBodies,
  SUN_GLOW_OPACITY,
  SUN_GLOW_SCALE,
  sunPulse,
} from "./draw-bodies";
import type { OrreryBodySpec, OrreryInk } from "./scene-specs";

interface Call {
  op: string;
  args: unknown[];
}
function recordingCanvas() {
  const calls: Call[] = [];
  const canvas = new Proxy(
    {},
    {
      get:
        (_t, op: string) =>
        (...args: unknown[]) => {
          calls.push({ op, args });
        },
    },
  );
  return { canvas: canvas as never, calls };
}

const OUTLINE: OrreryInk = [0.25, 0.5, 0.75, 1];
const SWATCH: OrreryInk = [0.5, 0.25, 0.125, 1];
const GLOW: OrreryInk = [1, 0.75, 0.25, 1];
const MOON: OrreryInk = [0.5, 0.5, 0.5, 1];

function spec(
  key: string,
  kind: OrreryBodySpec["kind"] = "contact",
  extra: Partial<OrreryBodySpec> = {},
): OrreryBodySpec {
  return {
    key,
    kind,
    worldRadius: kind === "sun" ? 30 : kind === "satellite" ? 1 : 16,
    outlineInk: kind === "sun" ? GLOW : kind === "satellite" ? MOON : OUTLINE,
    swatchInk: SWATCH,
    photoKey: null,
    initialsFontSize: kind === "sun" ? 30 : 16,
    focusInk: null,
    moonInk: MOON,
    initials: null,
    photo: null,
    ...extra,
  };
}

interface BodyInput {
  key: string;
  depth: number;
  x?: number;
  y?: number;
  radius?: number;
  opacity?: number;
  visible?: boolean;
  culled?: boolean;
}
/** A frame listing bodies in the given (source) order, indexed by key. */
function frame(bodies: BodyInput[]): AnimatedFrame {
  const keyIndex: Record<string, number> = {};
  const out = bodies.map((b, i) => {
    keyIndex[b.key] = i;
    const [kind, id] = b.key.split(":");
    return {
      id: Number(id) || 0,
      kind,
      x: b.x ?? i * 10,
      y: b.y ?? 100,
      radius: b.radius ?? (kind === "sun" ? 30 : 16),
      depth: b.depth,
      opacity: b.opacity ?? 1,
      visible: b.visible ?? true,
      culled: b.culled ?? false,
      interactive: true,
    };
  });
  return { bodies: out, keyIndex } as never as AnimatedFrame;
}

/** The x of each drawn body's translate, in draw order. */
const drawnXs = (calls: Call[]) =>
  calls.filter((c) => c.op === "translate").map((c) => c.args[0]);

describe("38.7-07 M14: depth order around the sun", () => {
  it("splits at the sun and draws ascending depth inside each batch, source order differing from depth order", () => {
    // Source order a, b, sun, c, d; depths out of order on both sides.
    const specs = [
      spec("contact:1"),
      spec("contact:2"),
      spec("sun:0", "sun"),
      spec("contact:3"),
      spec("contact:4"),
    ];
    const f = frame([
      { key: "contact:1", depth: -1, x: 1 },
      { key: "contact:2", depth: -5, x: 2 },
      { key: "sun:0", depth: 0, x: 0 },
      { key: "contact:3", depth: 9, x: 3 },
      { key: "contact:4", depth: 2, x: 4 },
    ]);
    const order = orderBodies(f, specs);
    expect(order.sun).toBe(2);
    expect(order.indices).toEqual([1, 0, 2, 4, 3]);
    const behind = recordingCanvas();
    expect(drawBodies(behind.canvas, f, specs, order, "behind")).toBe(2);
    expect(drawnXs(behind.calls)).toEqual([2, 1]);
    const front = recordingCanvas();
    expect(drawBodies(front.canvas, f, specs, order, "front")).toBe(2);
    expect(drawnXs(front.calls)).toEqual([4, 3]);
  });

  it("equal depths keep frame source order (today's stable zIndex tie-break), not spec order", () => {
    const specs = [spec("contact:2"), spec("contact:1"), spec("sun:0", "sun")];
    const f = frame([
      { key: "sun:0", depth: 10, x: 0 },
      { key: "contact:1", depth: 3, x: 1 },
      { key: "contact:2", depth: 3, x: 2 },
    ]);
    const order = orderBodies(f, specs);
    const behind = recordingCanvas();
    drawBodies(behind.canvas, f, specs, order, "behind");
    expect(drawnXs(behind.calls)).toEqual([1, 2]);
  });

  it("without a sun every body is in the behind batch; specs missing from the frame are skipped", () => {
    const specs = [spec("contact:1"), spec("contact:9")];
    const f = frame([{ key: "contact:1", depth: 0 }]);
    const order = orderBodies(f, specs);
    expect(order).toEqual({ indices: [0], sunAt: 1, sun: -1 });
    const front = recordingCanvas();
    expect(drawBodies(front.canvas, f, specs, order, "front")).toBe(0);
  });
});

describe("contact drawing (today's look)", () => {
  function drawOne(
    body: Partial<BodyInput>,
    extra: Partial<OrreryBodySpec> = {},
  ) {
    const specs = [spec("contact:1", "contact", extra)];
    const f = frame([{ key: "contact:1", depth: 0, ...body }]);
    const { canvas, calls } = recordingCanvas();
    const drew = drawBodies(canvas, f, specs, orderBodies(f, specs), "behind");
    return { drew, calls };
  }

  it("swatch path: outline disc, inner swatch disc and the initials Paragraph, in billboard space", () => {
    const paint = vi.fn();
    const { drew, calls } = drawOne(
      { x: 50, y: 60, radius: 32 },
      { initials: { paragraph: { paint } } as never },
    );
    expect(drew).toBe(1);
    expect(calls.map((c) => c.op)).toEqual([
      "save",
      "translate",
      "scale",
      "drawCircle",
      "drawCircle",
      "restore",
    ]);
    expect(calls[1].args).toEqual([50, 60]);
    expect(calls[2].args).toEqual([2, 2]);
    const [outline, swatch] = calls.filter((c) => c.op === "drawCircle");
    expect(outline.args.slice(0, 3)).toEqual([0, 0, 16]);
    expect((outline.args[3] as { color: number[] }).color).toEqual([
      ...OUTLINE,
    ]);
    expect(swatch.args.slice(0, 3)).toEqual([0, 0, 14.5]);
    expect((swatch.args[3] as { color: number[] }).color).toEqual([...SWATCH]);
    expect(paint).toHaveBeenCalledTimes(1);
    expect(paint.mock.calls[0].slice(1)).toEqual([-14.5, -16 * 0.72]);
  });

  it("photo path: the cover-fit photo clipped to the inner circle, no swatch or initials", () => {
    const paint = vi.fn();
    const photo = { width: () => 400, height: () => 300 };
    const { calls } = drawOne(
      {},
      { photo: photo as never, initials: { paragraph: { paint } } as never },
    );
    expect(paint).not.toHaveBeenCalled();
    expect(calls.filter((c) => c.op === "drawCircle")).toHaveLength(1);
    const clip = calls.find((c) => c.op === "clipRRect");
    expect(clip?.args[1]).toBe(1);
    const image = calls.find((c) => c.op === "drawImageRectOptions");
    expect(image?.args[0]).toBe(photo);
    // Centre square of the source, into the inner disc's box.
    expect(image?.args[1]).toEqual({ x: 50, y: 0, width: 300, height: 300 });
    expect(image?.args[2]).toEqual({
      x: -14.5,
      y: -14.5,
      width: 29,
      height: 29,
    });
    expect(image?.args.slice(3, 5)).toEqual([1, 0]);
  });

  it("a partly transparent body gets one layer bounded to its own extent; an opaque one none", () => {
    const faded = drawOne({ opacity: 0.4 });
    const layer = faded.calls.find((c) => c.op === "saveLayer") as Call;
    expect((layer.args[0] as { alpha: number }).alpha).toBe(0.4);
    expect(layer.args[1]).toEqual({ x: -16, y: -16, width: 32, height: 32 });
    expect(faded.calls.filter((c) => c.op === "restore")).toHaveLength(2);
    expect(drawOne({}).calls.some((c) => c.op === "saveLayer")).toBe(false);
  });

  it("hidden, culled and transparent bodies draw nothing", () => {
    expect(drawOne({ visible: false }).calls).toEqual([]);
    expect(drawOne({ culled: true, radius: 0 }).calls).toEqual([]);
    expect(drawOne({ opacity: 0 }).calls).toEqual([]);
  });
});

describe("sun drawing (today's glow, rim and pulse)", () => {
  const sunSpecs = [spec("sun:0", "sun")];
  function drawTheSun(pulse: number) {
    const f = frame([{ key: "sun:0", depth: 0, x: 5, y: 6, radius: 30 }]);
    const { canvas, calls } = recordingCanvas();
    drawSun(canvas, f, sunSpecs, orderBodies(f, sunSpecs), pulse);
    return calls.filter((c) => c.op === "drawCircle");
  }
  it("glow (radius × 1.8 at 0.35 alpha), the rim and the swatch disc at rest", () => {
    const [glow, rim, swatch] = drawTheSun(0);
    expect(glow.args.slice(0, 3)).toEqual([0, 0, 30 * SUN_GLOW_SCALE]);
    expect((glow.args[3] as { color: number[] }).color[3]).toBeCloseTo(
      SUN_GLOW_OPACITY,
    );
    expect(rim.args.slice(0, 3)).toEqual([0, 0, 32]);
    expect(swatch.args.slice(0, 3)).toEqual([0, 0, 30]);
  });
  it("the pulse moves radius ±10 % and opacity ±40 %; reduced motion holds it still", () => {
    const [glow] = drawTheSun(1);
    expect(glow.args[2]).toBeCloseTo(30 * SUN_GLOW_SCALE * 1.1);
    expect((glow.args[3] as { color: number[] }).color[3]).toBeCloseTo(
      SUN_GLOW_OPACITY * 1.4,
    );
    expect(sunPulse(1234, true)).toBe(0);
    expect(sunPulse(98765, true)).toBe(0);
    expect(sunPulse(0, false)).toBe(0);
    expect(sunPulse(Math.PI / 2 / 0.002, false)).toBeCloseTo(1);
  });
  it("draws nothing without a sun spec in the frame", () => {
    const f = frame([{ key: "contact:1", depth: 0 }]);
    const { canvas, calls } = recordingCanvas();
    const specs = [spec("contact:1")];
    expect(drawSun(canvas, f, specs, orderBodies(f, specs), 0)).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe("moon drawing (today's look, same depth rules)", () => {
  it("a unit disc scaled by the projected radius; the focused moon adds the accent ring; moons sort with contacts", () => {
    const ACCENT: OrreryInk = [0.125, 0.25, 0.875, 1];
    const specs = [
      spec("contact:1"),
      spec("sun:0", "sun"),
      spec("satellite:a", "satellite"),
      spec("satellite:b", "satellite", { focusInk: ACCENT }),
    ];
    const f = frame([
      { key: "contact:1", depth: -1, x: 1 },
      { key: "sun:0", depth: 0, x: 0 },
      { key: "satellite:a", depth: -2, x: 7, radius: 4 },
      { key: "satellite:b", depth: 3, x: 8, radius: 5 },
    ]);
    const order = orderBodies(f, specs);
    const behind = recordingCanvas();
    drawBodies(behind.canvas, f, specs, order, "behind");
    expect(drawnXs(behind.calls)).toEqual([7, 1]);
    expect(behind.calls[2].args).toEqual([4, 4]);
    const front = recordingCanvas();
    drawBodies(front.canvas, f, specs, order, "front");
    const circles = front.calls.filter((c) => c.op === "drawCircle");
    expect(circles.map((c) => c.args.slice(0, 3))).toEqual([
      [0, 0, 1],
      [0, 0, 1.5],
    ]);
    const ring = circles[1].args[3] as {
      color: number[];
      style: number;
      width: number;
    };
    expect(ring).toMatchObject({ color: [...ACCENT], style: 1, width: 0.3 });
    expect((circles[0].args[3] as { color: number[] }).color).toEqual([
      ...MOON,
    ]);
  });
});
