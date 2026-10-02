/**
 * ORRERY LAB B — tilt fix: screen-space draw helpers for plane circles
 * (see `labb-plane-ellipse.ts` for why: never stroke under a perspective
 * matrix on a mobile GPU).
 *
 * Hermes rule: helpers are declared ABOVE their worklet callers.
 */
import {
  type SkCanvas,
  Skia,
  type SkPaint,
  type SkPath,
} from "@shopify/react-native-skia";
import {
  ellipseOnScreen,
  hasPerspective,
  type PlaneEllipse,
  projectedCircleEllipse,
} from "./labb-plane-ellipse";

const RAD_TO_DEG = 180 / Math.PI;
/** Relative axis difference below which the ellipse is drawn as a circle. */
const CIRCLE_EPS = 1e-4;
/** Strokes at least this wide (dp) use the oval op: Ganesh's convex-path
 * stroker refuses strokes over 20 device px (≈ 5.7 dp at 3.5×). */
export const OVAL_MIN_STROKE_DP = 5;

/**
 * Stroke the plane circle (cx, cy, R) whose projected ellipse is `e`, in
 * screen space. The paint's shader (if any) must carry the homography as its
 * local matrix (CTM here = identity). `path` is a scratch path reused across
 * draws (the picture keeps its own copy of each recorded path).
 */
export function strokePlaneCircle(
  canvas: SkCanvas,
  path: SkPath,
  m: readonly number[],
  e: PlaneEllipse,
  cx: number,
  cy: number,
  R: number,
  paint: SkPaint,
): void {
  "worklet";
  if (Math.abs(e.a - e.b) <= CIRCLE_EPS * e.a) {
    canvas.drawCircle(e.x, e.y, (e.a + e.b) / 2, paint);
    return;
  }
  path.reset();
  path.addCircle(cx, cy, R);
  path.transform(m as number[]);
  canvas.drawPath(path, paint);
}

/** The analytic-oval variant: translate · rotate, then `drawOval`. A shader on
 * `paint` must use `ovalLocalMatrix(e, H)` as its local matrix. */
export function strokeOval(
  canvas: SkCanvas,
  e: PlaneEllipse,
  paint: SkPaint,
): void {
  "worklet";
  canvas.save();
  canvas.translate(e.x, e.y);
  canvas.rotate(e.theta * RAD_TO_DEG, 0, 0);
  canvas.drawOval(Skia.XYWHRect(-e.a, -e.b, e.a * 2, e.b * 2), paint);
  canvas.restore();
}

/**
 * Stroke the plane circle (cx, cy, R) under homography `m` with a stroke of
 * `widthDp` SCREEN dp: computes the projected ellipse, culls it against the
 * viewport, and picks the projected path (thin strokes) or the analytic oval
 * (wide strokes, plain-colour paints only — a shader would need the oval's
 * local matrix). Returns false when nothing was drawn.
 */
export function strokePlaneCircleAuto(
  canvas: SkCanvas,
  path: SkPath,
  m: readonly number[],
  cx: number,
  cy: number,
  R: number,
  widthDp: number,
  paint: SkPaint,
  w: number,
  h: number,
): boolean {
  "worklet";
  const e = projectedCircleEllipse(m, cx, cy, R);
  if (!e || !ellipseOnScreen(e, widthDp / 2 + 1, w, h)) return false;
  paint.setStrokeWidth(widthDp);
  if (widthDp >= OVAL_MIN_STROKE_DP && hasPerspective(m))
    strokeOval(canvas, e, paint);
  else strokePlaneCircle(canvas, path, m, e, cx, cy, R, paint);
  return true;
}

/**
 * Fill the plane disc (cx, cy, R) in screen space (projected convex path;
 * a circle when untilted). A shader on `paint` must carry the homography as
 * its local matrix.
 */
export function fillPlaneDisc(
  canvas: SkCanvas,
  path: SkPath,
  m: readonly number[],
  cx: number,
  cy: number,
  R: number,
  paint: SkPaint,
): boolean {
  "worklet";
  const e = projectedCircleEllipse(m, cx, cy, R);
  if (!e) return false;
  strokePlaneCircle(canvas, path, m, e, cx, cy, R, paint);
  return true;
}
