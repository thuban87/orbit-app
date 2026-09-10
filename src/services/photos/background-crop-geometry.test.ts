import { describe, expect, it } from "vitest";
import {
  clampBackgroundCropSelection,
  createInitialBackgroundCropSelection,
  describeBackgroundCropSelection,
  pinchResizeBackgroundCropSelection,
  translateBackgroundCropSelection,
} from "./background-crop-geometry";
import { profileBackgroundTarget } from "./profile-background-target";

const target = profileBackgroundTarget({ width: 1080, height: 2400 });

const aspect = target.preview.width / target.preview.height;

function expectBounded(
  selection: { originX: number; originY: number; width: number; height: number },
  source: { width: number; height: number },
) {
  expect(selection.width / selection.height).toBeCloseTo(aspect, 8);
  expect(selection.originX).toBeGreaterThanOrEqual(0);
  expect(selection.originY).toBeGreaterThanOrEqual(0);
  expect(selection.originX + selection.width).toBeLessThanOrEqual(source.width);
  expect(selection.originY + selection.height).toBeLessThanOrEqual(source.height);
}

describe("Profile background source-selection geometry", () => {
  it("creates a largest contained Profile-aspect selection for portrait, landscape, square, small, and large sources", () => {
    for (const source of [
      { width: 3000, height: 4000 },
      { width: 4000, height: 3000 },
      { width: 3000, height: 3000 },
      { width: 40, height: 31 },
      { width: 8000, height: 6000 },
    ]) {
      const selection = createInitialBackgroundCropSelection(source, aspect);
      expectBounded(selection, source);
      expect(selection.originX).toBeCloseTo(
        (source.width - selection.width) / 2,
        8,
      );
      expect(selection.originY).toBeCloseTo(
        (source.height - selection.height) / 2,
        8,
      );
    }
  });

  it("clamps drag translation identically at every source edge without resizing", () => {
    const source = { width: 4000, height: 3000 };
    const initial = createInitialBackgroundCropSelection(source, aspect);
    const moved = translateBackgroundCropSelection(
      initial,
      source,
      100_000,
      -100_000,
    );

    expect(moved.width).toBe(initial.width);
    expect(moved.height).toBe(initial.height);
    expect(moved.originX + moved.width).toBe(source.width);
    expect(moved.originY).toBe(0);
    expectBounded(moved, source);
  });

  it("pinch-resizes around its source focal point and clamps the same selection at an edge", () => {
    const source = { width: 4000, height: 3000 };
    const initial = createInitialBackgroundCropSelection(source, aspect);
    const pinched = pinchResizeBackgroundCropSelection(
      initial,
      source,
      aspect,
      { x: 3000, y: 600 },
      2,
    );

    expect(pinched.width).toBeCloseTo(initial.width / 2, 8);
    expect(pinched.height).toBeCloseTo(initial.height / 2, 8);
    expectBounded(pinched, source);

    const edge = clampBackgroundCropSelection(
      { ...pinched, originX: 100_000, originY: -100_000 },
      source,
      aspect,
    );
    expect(edge.originX + edge.width).toBe(source.width);
    expect(edge.originY).toBe(0);
  });

  it("publishes a concise textual selection state for non-drag operation", () => {
    expect(
      describeBackgroundCropSelection(
        { originX: 0, originY: 0, width: 100, height: 200 },
        { width: 200, height: 400 },
      ),
    ).toBe("Crop uses 50% of the image, aligned top left.");
  });
});
