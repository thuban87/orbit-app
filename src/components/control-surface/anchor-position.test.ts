import { describe, expect, it } from "vitest";
import { clampAnchorPosition } from "./anchor-position";

const viewport = { width: 360, height: 800 };
const panel = { width: 300, height: 360 };
const gutter = 16;

describe("clampAnchorPosition", () => {
  it("clamps a leading off-screen trigger to the gutter", () => {
    expect(clampAnchorPosition({ x: -24, y: 12, width: 80, height: 44 }, panel, viewport, gutter)).toEqual({
      top: 56,
      left: 16,
      width: 300,
    });
  });

  it("clamps a trailing off-screen trigger to the opposite gutter", () => {
    expect(clampAnchorPosition({ x: 340, y: 12, width: 80, height: 44 }, panel, viewport, gutter)).toEqual({
      top: 56,
      left: 44,
      width: 300,
    });
  });

  it("caps the panel width to the viewport gutters", () => {
    expect(
      clampAnchorPosition({ x: 20, y: 12, width: 80, height: 44 }, { width: 500, height: 360 }, viewport, gutter),
    ).toMatchObject({ width: 328, left: 16 });
  });

  it("is a fixed point when the input x is an already-clamped left value", () => {
    const first = clampAnchorPosition({ x: 340, y: 12, width: 80, height: 44 }, panel, viewport, gutter);
    const next = clampAnchorPosition({ x: first.left, y: 12, width: 80, height: 44 }, panel, viewport, gutter);

    expect(next.left).toBe(first.left);
  });
});
