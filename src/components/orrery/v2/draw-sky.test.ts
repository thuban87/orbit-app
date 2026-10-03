import { describe, expect, it, vi } from "vitest";

vi.mock("@shopify/react-native-skia", () => ({
  Skia: {
    Paint: () => {
      const paint = {
        color: [] as number[],
        setAntiAlias: () => {},
        setColor: (c: Float32Array) => {
          paint.color = [...c];
        },
      };
      return paint;
    },
  },
}));

import {
  drawSky,
  drawStars,
  TWINKLE_MAX,
  TWINKLE_MIN,
  TWINKLE_SPEED,
  TWINKLE_STATIC,
  twinkleOpacity,
} from "./draw-sky";

function recordingCanvas() {
  const calls: { op: string; args: unknown[]; color: number[] }[] = [];
  const canvas = new Proxy(
    {},
    {
      get:
        (_t, op: string) =>
        (...args: unknown[]) => {
          const paint = args.at(-1) as { color: number[] };
          calls.push({ op, args, color: [...paint.color] });
        },
    },
  );
  return { canvas: canvas as never, calls };
}

describe("twinkle (today's starfield animation)", () => {
  it("oscillates in the 0.18–0.55 band with today's speed; holds the mid-point under reduced motion", () => {
    expect(twinkleOpacity(0, false)).toBeCloseTo(
      (TWINKLE_MIN + TWINKLE_MAX) / 2,
      12,
    );
    const peak = Math.PI / 2 / TWINKLE_SPEED;
    expect(twinkleOpacity(peak, false)).toBeCloseTo(TWINKLE_MAX, 12);
    expect(twinkleOpacity(3 * peak, false)).toBeCloseTo(TWINKLE_MIN, 12);
    for (const ms of [0, 17, peak, 99999])
      expect(twinkleOpacity(ms, true)).toBe(TWINKLE_STATIC);
    expect(twinkleOpacity(Number.NaN, false)).toBe(TWINKLE_STATIC);
  });
});

describe("sky and stars", () => {
  it("fills the background ink and draws each star at base × twinkle", () => {
    const { canvas, calls } = recordingCanvas();
    drawSky(canvas, { background: [0.25, 0.5, 0.75, 1] });
    drawStars(
      canvas,
      {
        stars: [
          { x: 1, y: 2, r: 1.5, ink: [1, 1, 1, 1], base: 0.5 },
          { x: 3, y: 4, r: 0.75, ink: [0.5, 0.5, 0.5, 1], base: 1 },
        ],
      },
      0.5,
    );
    expect(calls.map((c) => c.op)).toEqual([
      "drawPaint",
      "drawCircle",
      "drawCircle",
    ]);
    expect(calls[0].color).toEqual([0.25, 0.5, 0.75, 1]);
    expect(calls[1].args.slice(0, 3)).toEqual([1, 2, 1.5]);
    expect(calls[1].color).toEqual([1, 1, 1, 0.25]);
    expect(calls[2].color).toEqual([0.5, 0.5, 0.5, 0.5]);
  });
});
