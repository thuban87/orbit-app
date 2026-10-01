/**
 * Crop Photo geometry (38.6 review WR5-02). Pure, so the sizing rule is
 * unit-tested without a renderer.
 *
 * The crop square is as wide as the screen allows (minus padding) with a dim
 * band above and below that shows the rest of the photo. The canvas never
 * takes more height than the screen has left after the title and the
 * Cancel / Use photo footer: when the in-flow assist banner (38.6 D-38) or a
 * short screen takes height away, the bands shrink first (down to
 * `CROP_MIN_BAND`), then the square shrinks, so the footer always stays on
 * screen. With room to spare the layout is exactly the original fixed one.
 */

/** Horizontal screen padding either side of the square viewport. */
export const CROP_SCREEN_PADDING = 16;
/** Vertical dim band above/below the square (shows the rest of the photo). */
export const CROP_DIM_BAND = 96;
/** The smallest dim band kept when height is short, before the square shrinks. */
export const CROP_MIN_BAND = CROP_SCREEN_PADDING;

export interface CropLayout {
  /** The crop square's side. */
  readonly viewport: number;
  /** The square's top-left inside the canvas. */
  readonly squareX: number;
  readonly squareY: number;
  readonly canvasW: number;
  readonly canvasH: number;
}

/** The canvas height the original fixed layout wants for this width. */
export function cropNaturalHeight(width: number): number {
  return Math.max(1, width - CROP_SCREEN_PADDING * 2) + CROP_DIM_BAND * 2;
}

/**
 * Lays the square out in a canvas `width` wide and at most `availableHeight`
 * tall (`null` = not measured yet, which uses the natural height).
 */
export function cropLayout(
  width: number,
  availableHeight: number | null,
): CropLayout {
  const canvasW = Math.max(1, width);
  const widthSide = Math.max(1, canvasW - CROP_SCREEN_PADDING * 2);
  const natural = widthSide + CROP_DIM_BAND * 2;
  const canvasH =
    availableHeight !== null &&
    Number.isFinite(availableHeight) &&
    availableHeight > 0
      ? Math.min(natural, availableHeight)
      : natural;
  const viewport = Math.max(
    1,
    Math.min(widthSide, canvasH - CROP_MIN_BAND * 2),
  );
  return {
    viewport,
    squareX: (canvasW - viewport) / 2,
    squareY: Math.max(0, (canvasH - viewport) / 2),
    canvasW,
    canvasH,
  };
}
