/**
 * 38.7-06 (D-43): the overlay picture — Polaris, the reorder outline and the
 * focus outlines, drawn from the shared frame (drawn == tappable).
 *
 * Today's look is kept: Polaris is the same halo, 4-point star and centre dot
 * (`hitPolaris`/`onNorth` still reset north); the reorder hold shows the held
 * orbit (now on the world plane, D-44) and a ring around the held body in the
 * accent token; a focused contact or sun keeps its accent outline.
 *
 * Horizon safety (H2): every projection goes through Plan 05's non-throwing
 * primitives (`polarisProjection`, the frame's `culled` flag, the plane
 * homography). Polaris draws nothing when north is beyond the horizon; a
 * culled body gets no screen-space circle; a world-plane outline whose whole
 * disc is beyond the horizon is skipped.
 *
 * Screen-space circles are stroked here: they are never under the perspective
 * matrix (only world-plane rings are, and those are analytic).
 * Worklet helpers are defined above their callers (Hermes forward-ref rule).
 */
import {
  PaintStyle,
  type SkCanvas,
  Skia,
  type SkPaint,
  type SkRuntimeEffect,
} from "@shopify/react-native-skia";
import {
  type AnimatedFrame,
  frameBodyById,
  frameBodyByKey,
} from "@/logic/orrery-frame";
import { planeHomography } from "@/logic/orrery-plane-logic";
import {
  POLARIS_RADIUS,
  polarisProjection,
} from "@/logic/orrery-recovery-logic";
import type { ReorderDrag } from "@/logic/orrery-reorder-logic";
import { drawPlaneRing, type RingBands } from "./draw-plane";
import type { OrreryInk, OverlaySpec } from "./scene-specs";

/** Today's outline stroke (reorder ghost / focus ring): 2 dp. */
const OUTLINE_WIDTH = 2;
/** Today's reorder ring: 4 dp outside the held body's drawn disc. */
const REORDER_RING_GAP = 4;
/** Polaris halo: 1.5 × the marker radius at 0.25 alpha. */
const POLARIS_HALO_SCALE = 1.5;
const POLARIS_HALO_ALPHA = 0.25;
const POLARIS_DOT_RADIUS = 2;
/** The 4-point star, about the marker centre (today's SVG path). */
const POLARIS_STAR: readonly (readonly [number, number])[] = [
  [0, -10],
  [2, -2],
  [10, 0],
  [2, 2],
  [0, 10],
  [-2, 2],
  [-10, 0],
  [-2, -2],
];

function inkPaint(ink: OrreryInk, alpha: number): SkPaint {
  "worklet";
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(
    Float32Array.of(
      ink[0],
      ink[1],
      ink[2],
      Math.max(0, Math.min(1, ink[3] * alpha)),
    ),
  );
  return paint;
}

function strokePaint(ink: OrreryInk, alpha: number, width: number): SkPaint {
  "worklet";
  const paint = inkPaint(ink, alpha);
  paint.setStyle(PaintStyle.Stroke);
  paint.setStrokeWidth(width);
  return paint;
}

/** Polaris at world north; false (nothing drawn) beyond the horizon. */
export function drawPolaris(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  spec: OverlaySpec,
): boolean {
  "worklet";
  const p = polarisProjection(frame, spec.extent);
  if (!p) return false;
  canvas.drawCircle(
    p.x,
    p.y,
    POLARIS_RADIUS * POLARIS_HALO_SCALE,
    inkPaint(spec.ink.polarisHalo, POLARIS_HALO_ALPHA),
  );
  const star = Skia.Path.Make();
  for (let i = 0; i < POLARIS_STAR.length; i++) {
    const [x, y] = POLARIS_STAR[i];
    if (i === 0) star.moveTo(p.x + x, p.y + y);
    else star.lineTo(p.x + x, p.y + y);
  }
  star.close();
  const ink = inkPaint(spec.ink.textPrimary, 1);
  canvas.drawPath(star, ink);
  canvas.drawCircle(p.x, p.y, POLARIS_DOT_RADIUS, ink);
  return true;
}

/**
 * The held orbit (world plane, accent) and the ring around the held body
 * while a reorder drag is active. The frame is the reorder preview frame, so
 * `worldRingRadius` is the slot the body would drop into.
 */
export function drawReorderOutline(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  drag: ReorderDrag | null,
  spec: OverlaySpec,
  effect: SkRuntimeEffect | null,
  bands: RingBands | null,
  aaDp: number,
): boolean {
  "worklet";
  if (!drag?.active) return false;
  const body = frameBodyById(frame, drag.id);
  if (!body) return false;
  let drawn = false;
  if (body.worldRingRadius > 0)
    drawn = drawPlaneRing(
      canvas,
      planeHomography(frame.pose, frame.viewport),
      body.worldRingRadius,
      OUTLINE_WIDTH / 2,
      aaDp,
      0,
      1,
      spec.ink.accent,
      effect,
      bands,
    );
  if (!body.culled) {
    canvas.drawCircle(
      body.x,
      body.y,
      body.radius + REORDER_RING_GAP,
      strokePaint(spec.ink.accent, 1, OUTLINE_WIDTH),
    );
    drawn = true;
  }
  return drawn;
}

/**
 * Today's focus ring for each focused contact or sun: `gap` outside the disc
 * and a 2-unit stroke, both scaled with the body (as the billboard scaled
 * them), at the body's opacity. Culled or hidden bodies get none.
 * Returns the number of outlines drawn.
 */
export function drawFocusOutlines(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  spec: OverlaySpec,
): number {
  "worklet";
  let drawn = 0;
  for (let i = 0; i < spec.focus.length; i++) {
    const focus = spec.focus[i];
    const body = frameBodyByKey(frame, focus.key);
    if (!body || body.culled || !body.visible || !(body.opacity > 0)) continue;
    if (!(focus.worldRadius > 0)) continue;
    const scale = body.radius / focus.worldRadius;
    canvas.drawCircle(
      body.x,
      body.y,
      body.radius + focus.gap * scale,
      strokePaint(spec.ink.accent, body.opacity, OUTLINE_WIDTH * scale),
    );
    drawn++;
  }
  return drawn;
}

/** The whole overlay picture: Polaris, then the reorder and focus outlines. */
export function drawOverlay(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  spec: OverlaySpec,
  drag: ReorderDrag | null,
  effect: SkRuntimeEffect | null,
  bands: RingBands | null,
  aaDp: number,
): void {
  "worklet";
  drawPolaris(canvas, frame, spec);
  drawReorderOutline(canvas, frame, drag, spec, effect, bands, aaDp);
  drawFocusOutlines(canvas, frame, spec);
}
