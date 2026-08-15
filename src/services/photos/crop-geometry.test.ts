import { describe, expect, it } from "vitest";
import {
  type CropRect,
  type CropTransform,
  cropRectFromTransform,
} from "./crop-geometry";

/**
 * Base fixture: a landscape source under a 300px square viewport at the cover
 * scale (baseScale = viewport / min(srcW, srcH)). Individual cases override the
 * live gesture transform (scale/tx/ty) and, for the portrait case, the source
 * dimensions + baseScale.
 */
function transform(overrides: Partial<CropTransform> = {}): CropTransform {
  const srcW = overrides.srcW ?? 4000;
  const srcH = overrides.srcH ?? 3000;
  return {
    viewport: 300,
    srcW,
    srcH,
    baseScale: 300 / Math.min(srcW, srcH),
    scale: 1,
    tx: 0,
    ty: 0,
    ...overrides,
  };
}

describe("cropRectFromTransform — no pan / no zoom (cover)", () => {
  it("returns the centred square of a LANDSCAPE source", () => {
    // srcW=4000, srcH=3000 → min=3000; centred square is 3000×3000 offset in X.
    const rect = cropRectFromTransform(transform());
    expect(rect).toEqual<CropRect>({
      originX: (4000 - 3000) / 2, // 500
      originY: 0,
      width: 3000,
      height: 3000,
    });
  });

  it("returns the centred square of a PORTRAIT source", () => {
    // srcW=3000, srcH=4000 → min=3000; centred square is 3000×3000 offset in Y.
    const rect = cropRectFromTransform(
      transform({ srcW: 3000, srcH: 4000, baseScale: 300 / 3000 }),
    );
    expect(rect).toEqual<CropRect>({
      originX: 0,
      originY: (4000 - 3000) / 2, // 500
      width: 3000,
      height: 3000,
    });
  });
});

describe("cropRectFromTransform — zoom", () => {
  it("shrinks the visible rect as scale increases (zoom in shows fewer source px)", () => {
    const cover = cropRectFromTransform(transform());
    const zoomed = cropRectFromTransform(transform({ scale: 2 }));
    expect(zoomed.width).toBeLessThan(cover.width);
    expect(zoomed.height).toBeLessThan(cover.height);
    // scale=2 halves the visible source square: 3000 → 1500, re-centred.
    expect(zoomed).toEqual<CropRect>({
      originX: (4000 - 1500) / 2, // 1250
      originY: (3000 - 1500) / 2, // 750
      width: 1500,
      height: 1500,
    });
  });

  it("never returns width/height exceeding the source dimensions", () => {
    // Zoom OUT (scale < 1) would grow the visible square past the source; the
    // result is capped at the source bounds.
    const rect = cropRectFromTransform(transform({ scale: 0.1 }));
    expect(rect.width).toBeLessThanOrEqual(4000);
    expect(rect.height).toBeLessThanOrEqual(3000);
  });
});

describe("cropRectFromTransform — pan direction (documented convention)", () => {
  // Convention (see crop-geometry.ts header): a POSITIVE tx translates the image
  // right on screen, which reveals the LEFT of the source, so originX DECREASES;
  // a negative tx increases it. ty mirrors this on the Y axis.
  it("positive tx moves the origin left; negative tx moves it right", () => {
    const centred = cropRectFromTransform(transform()); // originX 500
    const panPos = cropRectFromTransform(transform({ tx: 20 }));
    const panNeg = cropRectFromTransform(transform({ tx: -20 }));
    expect(panPos.originX).toBeLessThan(centred.originX);
    expect(panNeg.originX).toBeGreaterThan(centred.originX);
    // tx=20 at eff=0.1 shifts by 200 source px: 500 - 200 = 300.
    expect(panPos.originX).toBe(300);
    expect(panNeg.originX).toBe(700);
  });

  it("positive ty moves the origin up; negative ty moves it down", () => {
    // Use a portrait source so originY has centred headroom (500) to move within.
    const base = { srcW: 3000, srcH: 4000, baseScale: 300 / 3000 };
    const centred = cropRectFromTransform(transform(base)); // originY 500
    const panPos = cropRectFromTransform(transform({ ...base, ty: 20 }));
    const panNeg = cropRectFromTransform(transform({ ...base, ty: -20 }));
    expect(panPos.originY).toBeLessThan(centred.originY);
    expect(panNeg.originY).toBeGreaterThan(centred.originY);
    expect(panPos.originY).toBe(300);
    expect(panNeg.originY).toBe(700);
  });
});

describe("cropRectFromTransform — clamp at edges", () => {
  it("an over-pan can never push the origin negative", () => {
    const rect = cropRectFromTransform(transform({ tx: 100000, ty: 100000 }));
    expect(rect.originX).toBe(0);
    expect(rect.originY).toBe(0);
  });

  it("an over-pan can never push the origin past src - size", () => {
    const rect = cropRectFromTransform(transform({ tx: -100000, ty: -100000 }));
    // landscape cover: width=3000 → maxOriginX = 4000-3000 = 1000; height=3000 → maxOriginY = 0.
    expect(rect.originX).toBe(4000 - rect.width); // 1000
    expect(rect.originY).toBe(3000 - rect.height); // 0
    expect(rect.originX).toBeGreaterThanOrEqual(0);
    expect(rect.originY).toBeGreaterThanOrEqual(0);
  });
});
