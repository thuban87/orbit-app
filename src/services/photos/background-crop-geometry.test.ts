import { describe, expect, it } from "vitest";
import {
  clampBackgroundTransform,
  computeBackgroundCrop,
  getBackgroundPanBounds,
  type BackgroundCropTransform,
} from "./background-crop-geometry";

function transform(
  overrides: Partial<BackgroundCropTransform> = {},
): BackgroundCropTransform {
  return {
    destinationWidth: 360,
    destinationHeight: 240,
    srcWidth: 4000,
    srcHeight: 3000,
    scale: 1,
    translateX: 0,
    translateY: 0,
    ...overrides,
  };
}

describe("Profile background crop geometry", () => {
  it("covers the actual landscape Profile aspect from portrait, landscape, and square sources", () => {
    for (const source of [
      { srcWidth: 3000, srcHeight: 4000 },
      { srcWidth: 4000, srcHeight: 3000 },
      { srcWidth: 3000, srcHeight: 3000 },
    ]) {
      const crop = computeBackgroundCrop(transform(source));
      expect(crop.width / crop.height).toBeCloseTo(360 / 240, 8);
      expect(crop.originX).toBeGreaterThanOrEqual(0);
      expect(crop.originY).toBeGreaterThanOrEqual(0);
      expect(crop.originX + crop.width).toBeLessThanOrEqual(source.srcWidth);
      expect(crop.originY + crop.height).toBeLessThanOrEqual(source.srcHeight);
    }
  });

  it("uses min/max scale without changing the requested Profile aspect", () => {
    const min = computeBackgroundCrop(transform({ scale: 1 }));
    const max = computeBackgroundCrop(transform({ scale: 8 }));
    expect(max.width).toBeLessThan(min.width);
    expect(max.height).toBeLessThan(min.height);
    expect(max.width / max.height).toBeCloseTo(1.5, 8);
  });

  it("clamps extreme pan against the same bounds used by adjust controls", () => {
    const input = transform({ scale: 2 });
    const bounds = getBackgroundPanBounds(input);
    const clamped = clampBackgroundTransform({
      ...input,
      translateX: 100_000,
      translateY: -100_000,
    });
    expect(clamped.translateX).toBe(bounds.maxX);
    expect(clamped.translateY).toBe(bounds.minY);

    const crop = computeBackgroundCrop(clamped);
    expect(crop.originX).toBe(0);
    expect(crop.originY + crop.height).toBe(input.srcHeight);
  });

  it("has zero pan room on an exact-fit axis", () => {
    const bounds = getBackgroundPanBounds(
      transform({ srcWidth: 3000, srcHeight: 2000 }),
    );
    expect(bounds.minX).toBe(0);
    expect(bounds.maxX).toBe(0);
  });
});
