/**
 * PURE crop-rect geometry (PHOTO-01) — the deterministic map from the crop
 * screen's live gesture transform to the source-pixel rectangle handed to
 * `expo-image-manipulator`. No react-native, no Skia, no `expo-*` import: it is
 * node-unit-tested (`crop-geometry.test.ts`) so the ONLY on-device unknown left
 * is the visual convention (05-RESEARCH Assumption A1 / Open Question 2). Built
 * from 05-RESEARCH Architecture Pattern 2 (`cropRectFromTransform`, lines
 * 244-261).
 *
 * =============================================================================
 * THE CONTRACT — the crop screen's geometry init (05-05 Task 1) MUST match this
 * (addresses review concern [codex/HIGH 05-04]). Every input, with units:
 *
 *   • `viewport`  — the measured square crop viewport's side, in SCREEN px.
 *   • `srcW`,`srcH` — the DECODED source image's intrinsic pixel dimensions
 *                     (from the Skia image, NOT the on-screen layout size).
 *   • `baseScale` — the cover scale at `scale=1`: `viewport / min(srcW, srcH)`
 *                   (screen px per source px when the image just covers the
 *                   square). The crop screen derives it identically.
 *   • `scale`     — the live pinch scale shared value (1 = cover, >1 = zoomed in).
 *   • `tx`,`ty`   — the live pan translation shared values, in SCREEN px, in the
 *                   CENTRE-ORIGIN convention below.
 *
 * TRANSFORM CONVENTION (centre-origin):
 *   - The transform is applied about the viewport centre: the image is scaled by
 *     `eff = baseScale * scale` then translated by `(tx, ty)` screen px.
 *   - A POSITIVE `tx` translates the image to the RIGHT on screen, which brings
 *     the LEFT of the source into view, so the crop's `originX` DECREASES; a
 *     negative `tx` increases it. `ty` mirrors this on the Y axis (positive `ty`
 *     moves the image down → reveals the TOP → `originY` decreases).
 *
 * GEOMETRY:
 *   - `eff = baseScale * scale`     screen px per source px
 *   - `sizeSrc = viewport / eff`    the visible square's side, in source px
 *   - invert the pan/centre to get the visible square's top-left in source px
 *   - clamp the origin into `[0, src - size]` and cap the size at the source
 *     bounds, so a crop rect is ALWAYS inside the image (05-RESEARCH A2 — no
 *     off-by-one past the edge feeds the manipulator).
 * =============================================================================
 */

/** A source-pixel crop rectangle, in the exact shape `manipulate().crop()` wants. */
export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/** The crop screen's geometry init + live gesture transform (see header). */
export interface CropTransform {
  /** Measured square viewport side, in screen px. */
  viewport: number;
  /** Decoded source image intrinsic width, in source px. */
  srcW: number;
  /** Decoded source image intrinsic height, in source px. */
  srcH: number;
  /** Cover scale at `scale=1`: `viewport / min(srcW, srcH)`. */
  baseScale: number;
  /** Live pinch scale (1 = cover). */
  scale: number;
  /** Live pan translation X, screen px, centre-origin convention. */
  tx: number;
  /** Live pan translation Y, screen px, centre-origin convention. */
  ty: number;
}

const clamp = (value: number, max: number): number =>
  Math.max(0, Math.min(value, max));

/**
 * Convert a gesture transform to the clamped source-pixel crop rectangle.
 * Deterministic and side-effect-free — see the module header for the convention
 * and units every input carries.
 */
export function cropRectFromTransform(args: CropTransform): CropRect {
  const eff = args.baseScale * args.scale; // screen px per source px
  const sizeSrc = args.viewport / eff; // visible square side, in source px

  // Top-left of the visible square in source coords: start centred, then invert
  // the pan (screen px → source px via `eff`) per the centre-origin convention.
  const rawOriginX = (args.srcW - sizeSrc) / 2 - args.tx / eff;
  const rawOriginY = (args.srcH - sizeSrc) / 2 - args.ty / eff;

  // Cap the crop size at the source bounds (a zoom-out past cover cannot ask for
  // more pixels than exist), then clamp the origin so the rect stays inside.
  const width = Math.min(sizeSrc, args.srcW);
  const height = Math.min(sizeSrc, args.srcH);

  return {
    originX: clamp(rawOriginX, args.srcW - width),
    originY: clamp(rawOriginY, args.srcH - height),
    width,
    height,
  };
}
