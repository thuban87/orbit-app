/**
 * 38.7-07 (D-43): contacts, the sun and moons as picture drawing, from the
 * shared frame (drawn == tappable) and the JS-built body specs.
 *
 * Today's look is kept exactly (V2 visuals start in Plan 09):
 *   - a contact: the status outline disc (`bodyFill`), then the cover-fit
 *     circular photo clipped to the inner disc, else the swatch disc and the
 *     initials Paragraph;
 *   - the sun: the pulsing glow halo (radius × 1.8, ±10 % radius, ±40 %
 *     opacity on the canvas's ambient clock; static under reduced motion), the
 *     rim just outside the disc, then the photo or the swatch + initials;
 *   - a moon: the small `textSecondary` disc, plus the accent ring when focused.
 * Each body is drawn in its billboard space (translate to the projected centre,
 * scale = projected radius / world radius), as the declarative Groups were. A
 * partly transparent body gets a transparency layer BOUNDED to its own extent
 * (never a full-canvas layer, never a layer per body at rest).
 *
 * Depth (M14): the bodies are split around the sun, and inside each batch
 * drawn in ascending projected depth with ties in frame source order — exactly
 * the semantics of the old per-body `zIndex={depth}`.
 *
 * Worklet helpers are defined above their callers (Hermes forward-ref rule).
 */
import {
  ClipOp,
  FilterMode,
  MipmapMode,
  PaintStyle,
  type SkCanvas,
  type SkImage,
  Skia,
  type SkPaint,
} from "@shopify/react-native-skia";
import { type AnimatedFrame, bodyKey } from "@/logic/orrery-frame";
import {
  BODY_OUTLINE_WIDTH,
  type OrreryBodySpec,
  type OrreryInk,
} from "./scene-specs";

/** Sun glow halo radius × the disc radius (today's sun). */
export const SUN_GLOW_SCALE = 1.8;
/** Soft-glow halo opacity mid-point (device-UAT tunable, 13-08). */
export const SUN_GLOW_OPACITY = 0.35;
/** Glow-radius pulse fraction (±10 % of the glow radius). */
export const SUN_PULSE_RADIUS_FRAC = 0.1;
/** Glow-opacity pulse fraction (± this of SUN_GLOW_OPACITY). */
export const SUN_PULSE_OPACITY_FRAC = 0.4;
/** Pulse angular speed (rad/ms) → ~3.1 s period (UI-SPEC ~2–4 s). */
export const SUN_PULSE_SPEED = 0.002;
/** The rim just outside the sun disc (world units). */
const SUN_RIM_GAP = 2;
/** A moon is a unit disc (scaled by its projected radius). */
const MOON_RADIUS = 1;
/** The focused moon's accent ring: radius and stroke (moon-local units). */
const MOON_FOCUS_RADIUS = 1.5;
const MOON_FOCUS_STROKE = 0.3;
/** Initials baseline offset: y = −fontSize × this (today's Paragraph y). */
const INITIALS_RISE = 0.72;
/** Below this alpha nothing draws; above 1 − this no layer is needed. */
const ALPHA_EPSILON = 0.001;

/** The body draw order for one frame (spec indices), split around the sun. */
export interface OrreryBodyOrder {
  /** Spec indices in ascending depth, ties in frame source order. */
  indices: readonly number[];
  /** Position of the sun in `indices` (indices.length when there is none). */
  sunAt: number;
  /** The sun's spec index, or −1. */
  sun: number;
}

/** The frame index of a body key (O(1) when the frame is indexed); −1 if absent. */
export function sourceOf(frame: AnimatedFrame, key: string): number {
  "worklet";
  const keyIndex = frame.keyIndex;
  if (keyIndex) {
    const index = keyIndex[key];
    return index === undefined ? -1 : index;
  }
  for (let b = 0; b < frame.bodies.length; b++)
    if (bodyKey(frame.bodies[b]) === key) return b;
  return -1;
}

/**
 * The body order for `frame`: every spec whose body is in the frame, in
 * ascending projected depth, equal depths in frame source order (the order
 * the frame lists its bodies — today's stable zIndex tie-break).
 */
export function orderBodies(
  frame: AnimatedFrame,
  specs: readonly OrreryBodySpec[],
): OrreryBodyOrder {
  "worklet";
  const items: { spec: number; depth: number; source: number }[] = [];
  for (let i = 0; i < specs.length; i++) {
    const source = sourceOf(frame, specs[i].key);
    if (source < 0) continue;
    const depth = frame.bodies[source].depth;
    items.push({
      spec: i,
      depth: Number.isFinite(depth) ? depth : 0,
      source,
    });
  }
  items.sort((a, b) => a.depth - b.depth || a.source - b.source);
  const indices: number[] = [];
  let sunAt = items.length;
  let sun = -1;
  for (let i = 0; i < items.length; i++) {
    indices.push(items[i].spec);
    if (sun < 0 && specs[items[i].spec].kind === "sun") {
      sun = items[i].spec;
      sunAt = i;
    }
  }
  return { indices, sunAt, sun };
}

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

/** A plain antialiased paint for the photo (it carries no colour). */
function imagePaint(): SkPaint {
  "worklet";
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  return paint;
}

/** Opens a transparency layer bounded to the square of half-side `reach`. */
function boundedLayer(canvas: SkCanvas, alpha: number, reach: number): void {
  "worklet";
  const paint = Skia.Paint();
  paint.setAlphaf(Math.max(0, Math.min(1, alpha)));
  canvas.saveLayer(paint, Skia.XYWHRect(-reach, -reach, reach * 2, reach * 2));
}

/**
 * `image` cover-fit (centre square, linear sampling, as the declarative
 * `<Image fit="cover">` drew it) into the disc of radius `r` at the origin.
 */
function drawDiscPhoto(canvas: SkCanvas, image: SkImage, r: number): void {
  "worklet";
  canvas.save();
  const box = Skia.XYWHRect(-r, -r, r * 2, r * 2);
  canvas.clipRRect(Skia.RRectXY(box, r, r), ClipOp.Intersect, true);
  try {
    const width = image.width();
    const height = image.height();
    const side = Math.max(1, Math.min(width, height));
    canvas.drawImageRectOptions(
      image,
      Skia.XYWHRect((width - side) / 2, (height - side) / 2, side, side),
      box,
      FilterMode.Linear,
      MipmapMode.None,
      imagePaint(),
    );
  } catch {
    // Last guard only: the ledger never disposes a drawn image.
  }
  canvas.restore();
}

/** The swatch disc of radius `r` and the initials glyph centred on it. */
function drawSwatch(canvas: SkCanvas, spec: OrreryBodySpec, r: number): void {
  "worklet";
  canvas.drawCircle(0, 0, r, inkPaint(spec.swatchInk, 1));
  const initials = spec.initials;
  if (!initials) return;
  try {
    initials.paragraph.paint(
      canvas,
      -r,
      -spec.initialsFontSize * INITIALS_RISE,
    );
  } catch {
    // Last guard only: the ledger never disposes a drawn Paragraph.
  }
}

/** Opacity a frame body is drawn at (0 = not drawn). */
function bodyAlpha(body: AnimatedFrame["bodies"][number]): number {
  "worklet";
  if (!body.visible || body.culled || !(body.radius > 0)) return 0;
  return Number.isFinite(body.opacity) ? body.opacity : 0;
}

/** One contact (today's contact body). Returns true when it drew. */
export function drawContactBody(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  spec: OrreryBodySpec,
  source: number,
): boolean {
  "worklet";
  const body = frame.bodies[source];
  const alpha = bodyAlpha(body);
  const r = spec.worldRadius;
  if (!(alpha > ALPHA_EPSILON) || !(r > 0)) return false;
  const scale = body.radius / r;
  canvas.save();
  canvas.translate(body.x, body.y);
  canvas.scale(scale, scale);
  const layered = alpha < 1 - ALPHA_EPSILON;
  if (layered) boundedLayer(canvas, alpha, r);
  canvas.drawCircle(0, 0, r, inkPaint(spec.outlineInk, 1));
  const inner = Math.max(1, r - BODY_OUTLINE_WIDTH / 2);
  if (spec.photo) drawDiscPhoto(canvas, spec.photo, inner);
  else drawSwatch(canvas, spec, inner);
  if (layered) canvas.restore();
  canvas.restore();
  return true;
}

/** One moon (today's moon body). Returns true when it drew. */
export function drawMoonBody(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  spec: OrreryBodySpec,
  source: number,
): boolean {
  "worklet";
  const body = frame.bodies[source];
  const alpha = bodyAlpha(body);
  if (!(alpha > ALPHA_EPSILON)) return false;
  const scale = body.radius / MOON_RADIUS;
  canvas.save();
  canvas.translate(body.x, body.y);
  canvas.scale(scale, scale);
  const layered = alpha < 1 - ALPHA_EPSILON;
  const reach = MOON_FOCUS_RADIUS + MOON_FOCUS_STROKE;
  if (layered) boundedLayer(canvas, alpha, reach);
  canvas.drawCircle(0, 0, MOON_RADIUS, inkPaint(spec.outlineInk, 1));
  if (spec.focusInk) {
    const ring = inkPaint(spec.focusInk, 1);
    ring.setStyle(PaintStyle.Stroke);
    ring.setStrokeWidth(MOON_FOCUS_STROKE);
    canvas.drawCircle(0, 0, MOON_FOCUS_RADIUS, ring);
  }
  if (layered) canvas.restore();
  canvas.restore();
  return true;
}

/**
 * The contacts and moons behind the sun (`which = "behind"`) or in front of
 * it, in `order`. Returns how many bodies drew.
 */
export function drawBodies(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  specs: readonly OrreryBodySpec[],
  order: OrreryBodyOrder,
  which: "behind" | "front",
): number {
  "worklet";
  const from = which === "behind" ? 0 : order.sunAt + 1;
  const to = which === "behind" ? order.sunAt : order.indices.length;
  let drawn = 0;
  for (let i = from; i < to; i++) {
    const spec = specs[order.indices[i]];
    if (!spec || spec.kind === "sun") continue;
    const source = sourceOf(frame, spec.key);
    if (source < 0) continue;
    const did =
      spec.kind === "satellite"
        ? drawMoonBody(canvas, frame, spec, source)
        : drawContactBody(canvas, frame, spec, source);
    if (did) drawn++;
  }
  return drawn;
}

/** The sun pulse phase (−1..1) at ambient clock `clockMs`; 0 under reduced motion. */
export function sunPulse(clockMs: number, reduced: boolean): number {
  "worklet";
  if (reduced || !Number.isFinite(clockMs)) return 0;
  return Math.sin(clockMs * SUN_PULSE_SPEED);
}

/** The sun (today's sun body), with the glow pulse at phase `pulse`. */
export function drawSun(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  specs: readonly OrreryBodySpec[],
  order: OrreryBodyOrder,
  pulse: number,
): boolean {
  "worklet";
  const spec = order.sun >= 0 ? specs[order.sun] : undefined;
  if (!spec) return false;
  const source = sourceOf(frame, spec.key);
  if (source < 0) return false;
  const body = frame.bodies[source];
  const alpha = bodyAlpha(body);
  const r = spec.worldRadius;
  if (!(alpha > ALPHA_EPSILON) || !(r > 0)) return false;
  const scale = body.radius / r;
  const glow = r * SUN_GLOW_SCALE * (1 + SUN_PULSE_RADIUS_FRAC * pulse);
  canvas.save();
  canvas.translate(body.x, body.y);
  canvas.scale(scale, scale);
  const layered = alpha < 1 - ALPHA_EPSILON;
  if (layered) boundedLayer(canvas, alpha, Math.max(glow, r + SUN_RIM_GAP));
  canvas.drawCircle(
    0,
    0,
    glow,
    inkPaint(
      spec.outlineInk,
      SUN_GLOW_OPACITY * (1 + SUN_PULSE_OPACITY_FRAC * pulse),
    ),
  );
  canvas.drawCircle(0, 0, r + SUN_RIM_GAP, inkPaint(spec.outlineInk, 1));
  if (spec.photo) drawDiscPhoto(canvas, spec.photo, r);
  else drawSwatch(canvas, spec, r);
  if (layered) canvas.restore();
  canvas.restore();
  return true;
}
