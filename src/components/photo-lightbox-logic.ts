/**
 * PhotoLightbox tunables and pure math (38.6 D-03/D-15/D-16).
 *
 * Tunables sit at the top so device tuning with the owner (38.6-07) is a
 * single-number edit. Every colour stays a theme token in the component; these
 * are opacities over `colors.background`, never colours.
 *
 * Every function runs on the UI thread inside gesture worklets, so each opens
 * with the `"worklet"` directive and every callee is declared ABOVE its callers
 * (a same-file forward reference captures `undefined` and crashes on Hermes;
 * guarded by src/components/orrery/orrery-worklet-order.test.ts).
 *
 * Translations are offsets from the viewport centre, in dp; `side` is the
 * rendered (1×) image side and `viewport` the axis length it may pan within.
 */

/** Scrim opacity over `colors.background` — near-opaque (D-16). */
export const LIGHTBOX_SCRIM_OPACITY = 0.96;

/** Opacity of the `colors.background` circle behind the ✕ glyph. */
export const LIGHTBOX_CLOSE_BACKING_OPACITY = 0.7;

/** Largest pinch / double-tap zoom. */
export const LIGHTBOX_MAX_ZOOM = 4;

/** Scale a double-tap zooms in to (from 1×). */
export const LIGHTBOX_DOUBLE_TAP_SCALE = 2.5;

/** Downward drag (dp) at 1× that closes the lightbox on release. */
export const LIGHTBOX_DISMISS_DISTANCE = 120;

/** Downward fling velocity (dp/s) at 1× that closes the lightbox on release. */
export const LIGHTBOX_DISMISS_VELOCITY = 1000;

/** Share of the scrim opacity that fades out across a full dismiss drag. */
export const LIGHTBOX_DISMISS_FADE = 0.6;

/** Scales at or below this count as 1× (float slack after animations). */
const UNZOOMED_EPSILON = 1.01;

/** Zoom clamped to [1, LIGHTBOX_MAX_ZOOM]; a non-finite scale is 1×. */
export function clampScale(s: number): number {
  "worklet";
  if (!Number.isFinite(s)) return 1;
  return Math.min(LIGHTBOX_MAX_ZOOM, Math.max(1, s));
}

/** Largest offset from centre that keeps the zoomed image covering its axis. */
export function maxTranslate(
  side: number,
  scale: number,
  viewport: number,
): number {
  "worklet";
  return Math.max(0, (side * scale - viewport) / 2);
}

/** A translation clamped to the zoomed image's edges. */
export function clampTranslate(
  t: number,
  side: number,
  scale: number,
  viewport: number,
): number {
  "worklet";
  const limit = maxTranslate(side, scale, viewport);
  return Math.max(-limit, Math.min(limit, t));
}

/**
 * The translation that keeps the point under `focalFromCentre` fixed while
 * the scale goes from `prevScale` to `nextScale`.
 */
export function focalTranslate(
  t: number,
  focalFromCentre: number,
  prevScale: number,
  nextScale: number,
): number {
  "worklet";
  return focalFromCentre - (focalFromCentre - t) * (nextScale / prevScale);
}

/** Whether the image is zoomed past 1× (pan moves it; swipe-down is off). */
export function isZoomed(scale: number): boolean {
  "worklet";
  return scale > UNZOOMED_EPSILON;
}

/** Double-tap toggles: zoomed → 1×, 1× → LIGHTBOX_DOUBLE_TAP_SCALE. */
export function doubleTapTarget(scale: number): number {
  "worklet";
  return isZoomed(scale) ? 1 : LIGHTBOX_DOUBLE_TAP_SCALE;
}

/** Downward dismiss drag as a [0, 1] progress (upward drags are 0). */
export function dismissProgress(ty: number): number {
  "worklet";
  return Math.min(1, Math.max(0, ty / LIGHTBOX_DISMISS_DISTANCE));
}

/** The scrim opacity while dismissing: fades from LIGHTBOX_SCRIM_OPACITY. */
export function lightboxScrimOpacity(progress: number): number {
  "worklet";
  return Math.max(
    0,
    LIGHTBOX_SCRIM_OPACITY * (1 - LIGHTBOX_DISMISS_FADE * progress),
  );
}

/** Close on release: only at 1×, by drag distance or downward velocity. */
export function shouldDismiss(scale: number, ty: number, vy: number): boolean {
  "worklet";
  return (
    !isZoomed(scale) &&
    (ty > LIGHTBOX_DISMISS_DISTANCE || vy > LIGHTBOX_DISMISS_VELOCITY)
  );
}
