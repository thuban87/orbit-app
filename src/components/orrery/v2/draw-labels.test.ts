import { describe, expect, it, vi } from "vitest";

vi.mock("@shopify/react-native-skia", () => ({
  Skia: {
    Paint: () => {
      const paint = {
        color: [] as number[],
        alpha: 1,
        setAntiAlias: () => {},
        setColor: (c: Float32Array) => {
          paint.color = [...c];
        },
        setAlphaf: (a: number) => {
          paint.alpha = a;
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

import type { LabelAllocation } from "@/logic/orrery-label-logic";
import { RADII } from "@/theme/tokens/radii";
import {
  ORRERY_TEXT_HORIZONTAL_PADDING,
  ORRERY_TEXT_VERTICAL_PADDING,
} from "../resources/orrery-text-service";
import { drawLabels } from "./draw-labels";
import type { OrreryInk, OrreryLabelLayerSpecs } from "./scene-specs";

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

const PLATE: OrreryInk = [0.125, 0.125, 0.25, 1];
function text(width: number, height: number) {
  const paint = vi.fn();
  return {
    prepared: { text: "x", paragraph: { paint }, width, height },
    paint,
  };
}
function specs(
  entries: Record<
    string,
    { text: ReturnType<typeof text> | null; context?: ReturnType<typeof text> }
  >,
): OrreryLabelLayerSpecs {
  return {
    generation: 1,
    mountEpoch: 1,
    plateInk: PLATE,
    labels: Object.fromEntries(
      Object.entries(entries).map(([id, e]) => [
        id,
        {
          text: (e.text?.prepared ?? null) as never,
          context: (e.context?.prepared ?? null) as never,
        },
      ]),
    ),
    measured: Object.keys(entries).map((id) => ({
      id,
      name: id,
      width: 0,
      height: 0,
      focused: false,
      cluster: false,
      favorite: false,
    })),
  };
}
const allocation = (
  id: string,
  x: number,
  y: number,
  opacity = 1,
  context?: { x: number; y: number },
): LabelAllocation => ({
  id,
  name: id,
  opacity,
  rect: { x, y, width: 0, height: 0 },
  ...(context
    ? { contextRect: { x: context.x, y: context.y, width: 0, height: 0 } }
    : {}),
});

describe("38.7-07: labels as picture drawing (today's look)", () => {
  it("each allocated label: the surface backplate (RADII.sm) and the Paragraph at the padded corner, in spec order", () => {
    const a = text(80, 30);
    const b = text(60, 30);
    const { canvas, calls } = recordingCanvas();
    const drawn = drawLabels(
      canvas,
      specs({ "contact:2": { text: b }, "contact:1": { text: a } }),
      {
        "contact:1": allocation("contact:1", 10, 20),
        "contact:2": allocation("contact:2", 100, 200),
      },
    );
    expect(drawn).toBe(2);
    const plates = calls.filter((c) => c.op === "drawRRect");
    expect(plates.map((c) => c.args[0])).toEqual([
      {
        rect: { x: 100, y: 200, width: 60, height: 30 },
        rx: RADII.sm,
        ry: RADII.sm,
      },
      {
        rect: { x: 10, y: 20, width: 80, height: 30 },
        rx: RADII.sm,
        ry: RADII.sm,
      },
    ]);
    expect((plates[0].args[1] as { color: number[] }).color).toEqual([
      ...PLATE,
    ]);
    expect(a.paint.mock.calls[0].slice(1)).toEqual([
      10 + ORRERY_TEXT_HORIZONTAL_PADDING,
      20 + ORRERY_TEXT_VERTICAL_PADDING,
    ]);
    expect(calls.some((c) => c.op === "saveLayer")).toBe(false);
  });

  it("the context caption draws in its own rect at the label's opacity, inside a bounded layer when faded", () => {
    const label = text(80, 30);
    const caption = text(70, 24);
    const { canvas, calls } = recordingCanvas();
    drawLabels(
      canvas,
      specs({ "contact:1": { text: label, context: caption } }),
      { "contact:1": allocation("contact:1", 10, 20, 0.5, { x: 12, y: 52 }) },
    );
    const layers = calls.filter((c) => c.op === "saveLayer");
    expect(layers.map((c) => (c.args[0] as { alpha: number }).alpha)).toEqual([
      0.5, 0.5,
    ]);
    expect(layers.map((c) => c.args[1])).toEqual([
      { x: 10, y: 20, width: 80, height: 30 },
      { x: 12, y: 52, width: 70, height: 24 },
    ]);
    expect(caption.paint.mock.calls[0].slice(1)).toEqual([
      12 + ORRERY_TEXT_HORIZONTAL_PADDING,
      52 + ORRERY_TEXT_VERTICAL_PADDING,
    ]);
  });

  it("an unallocated, transparent or unadmitted label draws nothing", () => {
    const { canvas, calls } = recordingCanvas();
    expect(
      drawLabels(
        canvas,
        specs({
          "contact:1": { text: text(10, 10) },
          "contact:2": { text: text(10, 10) },
          "contact:3": { text: null },
        }),
        {
          "contact:2": allocation("contact:2", 0, 0, 0),
          "contact:3": allocation("contact:3", 0, 0),
        },
      ),
    ).toBe(0);
    expect(calls).toEqual([]);
  });
});
