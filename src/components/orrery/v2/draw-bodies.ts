/**
 * 38.7-07 (D-43): contacts, the sun and moons as picture drawing, from the
 * shared frame (drawn == tappable) and the JS-built body specs.
 *
 * 38.7-10 — the V2 people and sun:
 *   - a contact with a lit material (`spec.lit`, D-13/D-14): ONE lit-body
 *     shader draw — the photo (or the swatch, initials on top) sun-lit with
 *     lighter shading, the status rim and the soft status atmosphere (rogue:
 *     cold, no glow; decay/rogue desaturated);
 *   - the sun with a star look (`spec.sun`, D-15/D-37): Lab A's corona and
 *     granulated disc, their detail moving only with the sun pulse and still
 *     under reduced motion. Owner G-SUN (2026-10-03): the star is drawn even
 *     when the sun's occupant has a photo — the star sun's spec never carries
 *     one (`buildBodyLooks`), so the photo branch below serves only a sun
 *     without the star look;
 *   - a parent's far-zoom moon bump (D-31): a moon-ink half-disc on its rim,
 *     fading out as the moons split;
 *   - a stack's pips (D-54): ring-coloured dots along the front body's rim,
 *     on the side away from its bump.
 * Shaders compile lazily and may be null: then (or if a shader cannot be
 * built) the body falls back to today's flat look —
 *   - a contact: the status outline disc (`bodyFill`), then the cover-fit
 *     circular photo clipped to the inner disc, else the swatch disc and the
 *     initials Paragraph;
 *   - the sun: the pulsing glow halo (radius × 1.8, ±10 % radius, ±40 %
 *     opacity on the canvas's ambient clock; static under reduced motion), the
 *     rim just outside the disc, then the photo or the swatch + initials;
 *   - a moon (always): the small `textSecondary` disc (a focused moon
 *     carries the overlay reticle, 38.7-11).
 * 38.7-11 (D-21): while someone is focused, every other contact is defocused
 * (the lit shader's defocus term plus a sink toward the sky; a flat body or
 * moon loses alpha instead) — the sun never, nor a focused parent's moons.
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
  BlendMode,
  ClipOp,
  FilterMode,
  MipmapMode,
  PaintStyle,
  type SkCanvas,
  type SkImage,
  Skia,
  type SkPaint,
  type SkRuntimeEffect,
  type SkShader,
  TileMode,
} from "@shopify/react-native-skia";
import type { CameraRect } from "@/logic/orrery-camera-logic";
import { type AnimatedFrame, bodyKey } from "@/logic/orrery-frame";
import { pipAngles } from "@/logic/orrery-stack-logic";
import { bodyDefocus, type FocusDraw, occludedBodyAlpha } from "./focus-fx";
import {
  BODY_OUTLINE_WIDTH,
  type BodyLit,
  type OrreryBodySpec,
  type OrreryInk,
  type SunLook,
} from "./scene-specs";
import {
  BODY_ATMOSPHERE_REACH,
  FLAT_FOCUS_DIM,
  FOCUS_SINK,
  MOON_BUMP_MAX_DP,
  MOON_BUMP_RADIUS_DP,
  MOON_BUMP_STEP_DP,
  PIP_ANCHOR,
  PIP_MORE_INSET_DP,
  PIP_MORE_STROKE_DP,
  PIP_OUTSET,
  PIP_PLATE_ALPHA,
  PIP_PLATE_DP,
  PIP_RADIUS_DP,
  PIP_STEP,
  SUN_CORONA_EXTENT,
  SUN_CORONA_SWING,
  SUN_CORONA_TIME,
  SUN_GRANULE_SWING,
  SUN_GRANULE_TIME,
  SUN_LIMB_GAP,
} from "./visual-tunables";

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
/** Initials baseline offset: y = −fontSize × this (today's Paragraph y). */
const INITIALS_RISE = 0.72;
/** Below this alpha nothing draws; above 1 − this no layer is needed. */
const ALPHA_EPSILON = 0.001;
/** The light direction when there is no sun to light from (up-left, Lab B). */
const DEFAULT_LIGHT_X = -0.6;
const DEFAULT_LIGHT_Y = -0.8;
/** The sun disc's AA feather (dp), Lab A. */
const SUN_DISC_AA_DP = 0.7;

/**
 * 38.7-10: the compiled body/sun effects (null → that body falls back to
 * today's flat look). Built once on the JS thread by the canvas.
 */
export interface OrreryBodyEffects {
  swatch: SkRuntimeEffect | null;
  photo: SkRuntimeEffect | null;
  corona: SkRuntimeEffect | null;
  sunDisc: SkRuntimeEffect | null;
}
export const NO_BODY_EFFECTS: OrreryBodyEffects = Object.freeze({
  swatch: null,
  photo: null,
  corona: null,
  sunDisc: null,
});

/** The body draw order for one frame (spec indices), split around the sun. */
export interface OrreryBodyOrder {
  /** Spec indices in ascending depth, ties in frame source order. */
  indices: readonly number[];
  /** Position of the sun in `indices` (indices.length when there is none). */
  sunAt: number;
  /** The sun's spec index, or −1. */
  sun: number;
  /** 38.7-10: frame index → spec index (pips read hidden bodies' inks). */
  specAt?: Readonly<Record<number, number>>;
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
  const specAt: Record<number, number> = {};
  for (let i = 0; i < specs.length; i++) {
    const source = sourceOf(frame, specs[i].key);
    if (source < 0) continue;
    if (specAt[source] === undefined) specAt[source] = i;
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
  return { indices, sunAt, sun, specAt };
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

/** An antialiased paint drawing `shader`. */
function shaderPaint(shader: SkShader): SkPaint {
  "worklet";
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setShader(shader);
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

/** The initials glyph centred on a disc whose inner radius is `inner`. */
function drawInitials(
  canvas: SkCanvas,
  spec: OrreryBodySpec,
  inner: number,
): void {
  "worklet";
  const initials = spec.initials;
  if (!initials) return;
  try {
    initials.paragraph.paint(
      canvas,
      -inner,
      -spec.initialsFontSize * INITIALS_RISE,
    );
  } catch {
    // Last guard only: the ledger never disposes a drawn Paragraph.
  }
}

/** The swatch disc of radius `r` and the initials glyph centred on it. */
function drawSwatch(canvas: SkCanvas, spec: OrreryBodySpec, r: number): void {
  "worklet";
  canvas.drawCircle(0, 0, r, inkPaint(spec.swatchInk, 1));
  drawInitials(canvas, spec, r);
}

/**
 * 38.7-10 (D-31): the bump's on-screen radius (dp) for a parent with `count`
 * moons: MOON_BUMP_RADIUS_DP, a little larger per extra moon, capped.
 */
export function moonBumpRadiusDp(count: number): number {
  "worklet";
  return Math.min(
    MOON_BUMP_MAX_DP,
    MOON_BUMP_RADIUS_DP + MOON_BUMP_STEP_DP * Math.max(0, count - 1),
  );
}

/**
 * The parent's moon bump, in its billboard space (body radius `r`, billboard
 * scale `scale`): a moon-ink disc centred on the rim at the bump angle, drawn
 * BEFORE the parent's disc so the disc covers its inner half (a half-disc on
 * the rim). It fades out as the moons split (1 − moonSplit). Decorative only.
 */
function drawMoonBump(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  spec: OrreryBodySpec,
  r: number,
  scale: number,
): void {
  "worklet";
  const bumps = frame.moonBumps;
  if (!bumps) return;
  const bump = bumps[spec.key];
  if (!bump) return;
  const alpha = 1 - (frame.moonSplit ?? 0);
  if (!(alpha > ALPHA_EPSILON) || !(scale > 0)) return;
  canvas.drawCircle(
    Math.cos(bump.angle) * r,
    Math.sin(bump.angle) * r,
    moonBumpRadiusDp(bump.count) / scale,
    inkPaint(spec.moonInk, alpha),
  );
}

/** How far past the disc the bump reaches (billboard units), or 0. */
function bumpReach(
  frame: AnimatedFrame,
  spec: OrreryBodySpec,
  scale: number,
): number {
  "worklet";
  const bump = frame.moonBumps?.[spec.key];
  if (!bump || !(scale > 0)) return 0;
  return moonBumpRadiusDp(bump.count) / scale;
}

/** Opacity a frame body is drawn at (0 = not drawn). */
function bodyAlpha(body: AnimatedFrame["bodies"][number]): number {
  "worklet";
  if (!body.visible || body.culled || !(body.radius > 0)) return 0;
  return Number.isFinite(body.opacity) ? body.opacity : 0;
}

/** The sun's screen position for this frame (the light source), or null. */
export function sunScreen(
  frame: AnimatedFrame,
  specs: readonly OrreryBodySpec[],
  order: OrreryBodyOrder,
): { x: number; y: number } | null {
  "worklet";
  const spec = order.sun >= 0 ? specs[order.sun] : undefined;
  if (spec) {
    const source = sourceOf(frame, spec.key);
    if (source >= 0 && !frame.bodies[source].culled)
      return { x: frame.bodies[source].x, y: frame.bodies[source].y };
  }
  return frame.center ?? null;
}

/** The unit screen direction from (x, y) toward the sun (up-left without one). */
export function lightToward(
  x: number,
  y: number,
  sun: { x: number; y: number } | null,
): [number, number] {
  "worklet";
  if (!sun) return [DEFAULT_LIGHT_X, DEFAULT_LIGHT_Y];
  const dx = sun.x - x;
  const dy = sun.y - y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (!(length > 1e-3)) return [DEFAULT_LIGHT_X, DEFAULT_LIGHT_Y];
  return [dx / length, dy / length];
}

/**
 * The lit-body uniforms in BODY_LIT_CORE declaration order (28 floats):
 * uA..uG. The variant's own uniform (swatch colour or photo square) follows.
 */
export function bodyLitUniforms(
  r: number,
  unitsPerDp: number,
  light: readonly [number, number],
  lit: BodyLit,
  defocus: number,
): number[] {
  "worklet";
  return [
    r,
    unitsPerDp,
    light[0],
    light[1],
    lit.lightZ,
    lit.floor,
    lit.wrap,
    lit.desaturate,
    lit.rimInk[0],
    lit.rimInk[1],
    lit.rimInk[2],
    lit.rimStrength,
    lit.glowInk[0],
    lit.glowInk[1],
    lit.glowInk[2],
    lit.atmosphere,
    lit.highlightInk[0],
    lit.highlightInk[1],
    lit.highlightInk[2],
    lit.spec,
    lit.fresnel,
    lit.rimDp,
    lit.atmosphereReach,
    lit.atmosphereAdditive,
    Math.max(0, Math.min(1, defocus)),
    0,
    0,
    0,
  ];
}

/**
 * One lit contact (D-13/D-14) in its billboard space: one circle of radius
 * r × reach carrying the lit-body shader, then the initials over a swatch.
 * Returns false (draw nothing) when the effect is missing or the shader
 * cannot be built — the caller then draws today's flat body.
 */
function drawLitContact(
  canvas: SkCanvas,
  spec: OrreryBodySpec,
  lit: BodyLit,
  r: number,
  scale: number,
  light: readonly [number, number],
  effects: OrreryBodyEffects,
  defocus: number,
): boolean {
  "worklet";
  const photo = spec.photo;
  const effect = photo ? effects.photo : effects.swatch;
  if (!effect) return false;
  let shader: SkShader;
  try {
    const uniforms = bodyLitUniforms(r, 1 / scale, light, lit, defocus);
    if (photo) {
      const width = photo.width();
      const height = photo.height();
      const side = Math.max(1, Math.min(width, height));
      uniforms.push((width - side) / 2, (height - side) / 2, side, 0);
      shader = effect.makeShaderWithChildren(uniforms, [
        photo.makeShaderOptions(
          TileMode.Clamp,
          TileMode.Clamp,
          FilterMode.Linear,
          MipmapMode.None,
        ),
      ]);
    } else {
      uniforms.push(spec.swatchInk[0], spec.swatchInk[1], spec.swatchInk[2], 1);
      shader = effect.makeShader(uniforms);
    }
  } catch {
    return false;
  }
  const paint = shaderPaint(shader);
  // Lab B's defocused worlds also sink toward the sky behind them.
  if (defocus > 0) paint.setAlphaf(1 - FOCUS_SINK * defocus);
  canvas.drawCircle(0, 0, r * lit.atmosphereReach, paint);
  if (!photo)
    drawInitials(canvas, spec, Math.max(1, r - BODY_OUTLINE_WIDTH / 2));
  return true;
}

/**
 * D-54: the front body's pips (screen space, after its billboard): one
 * ring-coloured dot per hidden contact on a dark plate, the last one a "more"
 * ring when the stack overflowed; centred away from the body's moon bump.
 */
function drawPips(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  specs: readonly OrreryBodySpec[],
  order: OrreryBodyOrder,
  spec: OrreryBodySpec,
  source: number,
  alpha: number,
): void {
  "worklet";
  const stack = frame.stacks?.[source];
  if (!stack || stack.hidden.length === 0) return;
  const body = frame.bodies[source];
  const bump = frame.moonBumps?.[spec.key];
  const count = stack.hidden.length;
  const angles = pipAngles(
    count,
    PIP_STEP,
    PIP_ANCHOR,
    bump ? bump.angle : null,
  );
  const reach = body.radius + PIP_RADIUS_DP * PIP_OUTSET;
  const plate = inkPaint(
    spec.pipPlateInk ?? spec.swatchInk,
    PIP_PLATE_ALPHA * alpha,
  );
  for (let k = 0; k < count; k++) {
    const x = body.x + Math.cos(angles[k]) * reach;
    const y = body.y + Math.sin(angles[k]) * reach;
    canvas.drawCircle(x, y, PIP_RADIUS_DP + PIP_PLATE_DP, plate);
    if (k === count - 1 && stack.overflow) {
      const more = inkPaint(spec.moonInk, alpha);
      more.setStyle(PaintStyle.Stroke);
      more.setStrokeWidth(PIP_MORE_STROKE_DP);
      canvas.drawCircle(x, y, PIP_RADIUS_DP - PIP_MORE_INSET_DP, more);
      continue;
    }
    const at = order.specAt?.[stack.hidden[k]];
    const hidden = at === undefined ? undefined : specs[at];
    canvas.drawCircle(
      x,
      y,
      PIP_RADIUS_DP,
      inkPaint(hidden?.ringInk ?? spec.moonInk, alpha),
    );
  }
}

/** One contact. Returns true when it drew. */
export function drawContactBody(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  spec: OrreryBodySpec,
  source: number,
  bodyEffects?: OrreryBodyEffects,
  sun: { x: number; y: number } | null = null,
  focus: FocusDraw | null = null,
  occlusion = 1,
): boolean {
  "worklet";
  // No module identifier in a worklet default parameter (it runs before the
  // captured closure is unpacked: a ReferenceError on the UI runtime).
  const effects = bodyEffects === undefined ? NO_BODY_EFFECTS : bodyEffects;
  const body = frame.bodies[source];
  const r = spec.worldRadius;
  const lit = spec.lit;
  const defocus = bodyDefocus(focus, spec.key, spec.kind, null);
  // The lit shader dims itself (no layer per dimmed body); a flat body
  // (no shader) dims through its alpha instead. `occlusion` is the Lab B
  // under-a-card factor (1 outside ORRERY_OCCLUSION_STYLE "lab-b").
  const shaded =
    lit !== undefined && (spec.photo ? effects.photo : effects.swatch) !== null;
  const alpha =
    bodyAlpha(body) * (shaded ? 1 : 1 - FLAT_FOCUS_DIM * defocus) * occlusion;
  if (!(alpha > ALPHA_EPSILON) || !(r > 0)) return false;
  const scale = body.radius / r;
  canvas.save();
  canvas.translate(body.x, body.y);
  canvas.scale(scale, scale);
  const layered = alpha < 1 - ALPHA_EPSILON;
  if (layered)
    boundedLayer(
      canvas,
      alpha,
      Math.max(
        r * (lit ? lit.atmosphereReach : 1),
        r + bumpReach(frame, spec, scale),
      ),
    );
  drawMoonBump(canvas, frame, spec, r, scale);
  const drewLit =
    lit !== undefined &&
    drawLitContact(
      canvas,
      spec,
      lit,
      r,
      scale,
      lightToward(body.x, body.y, sun),
      effects,
      defocus,
    );
  if (!drewLit) {
    canvas.drawCircle(0, 0, r, inkPaint(spec.outlineInk, 1));
    const inner = Math.max(1, r - BODY_OUTLINE_WIDTH / 2);
    if (spec.photo) drawDiscPhoto(canvas, spec.photo, inner);
    else drawSwatch(canvas, spec, inner);
  }
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
  focus: FocusDraw | null = null,
  occlusion = 1,
): boolean {
  "worklet";
  const body = frame.bodies[source];
  const parent = body.satelliteTarget ? body.satelliteTarget.parentId : null;
  const defocus = bodyDefocus(focus, spec.key, spec.kind, parent);
  const alpha = bodyAlpha(body) * (1 - FLAT_FOCUS_DIM * defocus) * occlusion;
  if (!(alpha > ALPHA_EPSILON)) return false;
  const scale = body.radius / MOON_RADIUS;
  canvas.save();
  canvas.translate(body.x, body.y);
  canvas.scale(scale, scale);
  const layered = alpha < 1 - ALPHA_EPSILON;
  if (layered) boundedLayer(canvas, alpha, MOON_RADIUS);
  canvas.drawCircle(0, 0, MOON_RADIUS, inkPaint(spec.outlineInk, 1));
  if (layered) canvas.restore();
  canvas.restore();
  return true;
}

/**
 * The contacts and moons behind the sun (`which = "behind"`) or in front of
 * it, in `order`. Returns how many bodies drew. `occluded` (38.7-14,
 * ORRERY_OCCLUSION_STYLE "lab-b" only, else null): the text-surface rects a
 * body under which draws at Lab B's OCCLUDED_BODY_ALPHA, pips included.
 */
export function drawBodies(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  specs: readonly OrreryBodySpec[],
  order: OrreryBodyOrder,
  which: "behind" | "front",
  bodyEffects?: OrreryBodyEffects,
  focus: FocusDraw | null = null,
  occluded: readonly CameraRect[] | null = null,
): number {
  "worklet";
  // No module identifier in a worklet default parameter (it runs before the
  // captured closure is unpacked: a ReferenceError on the UI runtime).
  const effects = bodyEffects === undefined ? NO_BODY_EFFECTS : bodyEffects;
  const from = which === "behind" ? 0 : order.sunAt + 1;
  const to = which === "behind" ? order.sunAt : order.indices.length;
  const sun = sunScreen(frame, specs, order);
  let drawn = 0;
  for (let i = from; i < to; i++) {
    const spec = specs[order.indices[i]];
    if (!spec || spec.kind === "sun") continue;
    const source = sourceOf(frame, spec.key);
    if (source < 0) continue;
    const at = frame.bodies[source];
    const occlusion = occludedBodyAlpha(
      occluded,
      at.x,
      at.y,
      at.radius * BODY_ATMOSPHERE_REACH,
    );
    const did =
      spec.kind === "satellite"
        ? drawMoonBody(canvas, frame, spec, source, focus, occlusion)
        : drawContactBody(
            canvas,
            frame,
            spec,
            source,
            effects,
            sun,
            focus,
            occlusion,
          );
    if (did) {
      drawn++;
      if (spec.kind === "contact")
        drawPips(
          canvas,
          frame,
          specs,
          order,
          spec,
          source,
          bodyAlpha(frame.bodies[source]) * occlusion,
        );
    }
  }
  return drawn;
}

/** The sun pulse phase (−1..1) at ambient clock `clockMs`; 0 under reduced motion. */
export function sunPulse(clockMs: number, reduced: boolean): number {
  "worklet";
  if (reduced || !Number.isFinite(clockMs)) return 0;
  return Math.sin(clockMs * SUN_PULSE_SPEED);
}

/**
 * D-37: the star's shader times, a fixed phase swung only by the sun pulse
 * (so the detail breathes with the pulse and never churns; the pulse is 0 —
 * and the detail still — under reduced motion).
 */
export function sunDetailTime(pulse: number): {
  corona: number;
  granule: number;
} {
  "worklet";
  const p = Number.isFinite(pulse) ? Math.max(-1, Math.min(1, pulse)) : 0;
  return {
    corona: SUN_CORONA_TIME + SUN_CORONA_SWING * p,
    granule: SUN_GRANULE_TIME + SUN_GRANULE_SWING * p,
  };
}

/** CORONA_SKSL's uniforms in declaration order (14 floats). */
export function coronaUniforms(
  r: number,
  time: number,
  look: SunLook,
  glow: OrreryInk,
): number[] {
  "worklet";
  return [
    r,
    time,
    0,
    SUN_CORONA_EXTENT,
    look.chart ? 1 : 0,
    look.coronaAlpha,
    look.starlightInk[0],
    look.starlightInk[1],
    look.starlightInk[2],
    look.starlightInk[3],
    glow[0],
    glow[1],
    glow[2],
    glow[3],
  ];
}

/** SUN_DISC_SKSL's uniforms in declaration order (13 floats). */
export function sunDiscUniforms(
  r: number,
  time: number,
  photo: boolean,
  scale: number,
  look: SunLook,
  glow: OrreryInk,
): number[] {
  "worklet";
  const core = look.chart ? look.paperInk : look.starlightInk;
  return [
    r,
    time,
    photo ? 1 : 0,
    SUN_DISC_AA_DP / Math.max(0.05, scale),
    0,
    core[0],
    core[1],
    core[2],
    core[3],
    glow[0],
    glow[1],
    glow[2],
    glow[3],
  ];
}

/**
 * D-15: the star sun in its billboard space — Lab A's corona, the fine limb
 * line, then the photo with a glowing limb band or the granulated stellar
 * surface with the initials. False when the corona cannot be built.
 */
function drawStarSun(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  spec: OrreryBodySpec,
  look: SunLook,
  r: number,
  scale: number,
  pulse: number,
  effects: OrreryBodyEffects,
): boolean {
  "worklet";
  const corona = effects.corona;
  if (!corona) return false;
  const times = sunDetailTime(pulse);
  let coronaShader: SkShader;
  try {
    coronaShader = corona.makeShader(
      coronaUniforms(r, times.corona, look, spec.outlineInk),
    );
  } catch {
    return false;
  }
  const half = r * SUN_CORONA_EXTENT;
  const coronaPaint = shaderPaint(coronaShader);
  coronaPaint.setBlendMode(
    look.additive ? BlendMode.Screen : BlendMode.SrcOver,
  );
  canvas.drawRect(Skia.XYWHRect(-half, -half, half * 2, half * 2), coronaPaint);
  drawMoonBump(canvas, frame, spec, r + SUN_LIMB_GAP, scale);
  canvas.drawCircle(0, 0, r + SUN_LIMB_GAP, inkPaint(spec.outlineInk, 1));
  let disc: SkShader | null = null;
  if (effects.sunDisc)
    try {
      disc = effects.sunDisc.makeShader(
        sunDiscUniforms(
          r,
          times.granule,
          spec.photo !== null,
          scale,
          look,
          spec.outlineInk,
        ),
      );
    } catch {
      disc = null;
    }
  if (spec.photo) {
    drawDiscPhoto(canvas, spec.photo, r);
    if (disc) canvas.drawCircle(0, 0, r, shaderPaint(disc));
  } else if (disc) {
    canvas.drawCircle(0, 0, r, shaderPaint(disc));
    drawInitials(canvas, spec, r);
  } else drawSwatch(canvas, spec, r);
  return true;
}

/** The sun, with the pulse at phase `pulse` (star look, or today's glow). */
export function drawSun(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  specs: readonly OrreryBodySpec[],
  order: OrreryBodyOrder,
  pulse: number,
  bodyEffects?: OrreryBodyEffects,
  occluded: readonly CameraRect[] | null = null,
): boolean {
  "worklet";
  // No module identifier in a worklet default parameter (it runs before the
  // captured closure is unpacked: a ReferenceError on the UI runtime).
  const effects = bodyEffects === undefined ? NO_BODY_EFFECTS : bodyEffects;
  const spec = order.sun >= 0 ? specs[order.sun] : undefined;
  if (!spec) return false;
  const source = sourceOf(frame, spec.key);
  if (source < 0) return false;
  const body = frame.bodies[source];
  const alpha =
    bodyAlpha(body) *
    occludedBodyAlpha(
      occluded,
      body.x,
      body.y,
      body.radius * BODY_ATMOSPHERE_REACH,
    );
  const r = spec.worldRadius;
  if (!(alpha > ALPHA_EPSILON) || !(r > 0)) return false;
  const scale = body.radius / r;
  const glow = r * SUN_GLOW_SCALE * (1 + SUN_PULSE_RADIUS_FRAC * pulse);
  const star = spec.sun !== undefined && effects.corona !== null;
  canvas.save();
  canvas.translate(body.x, body.y);
  canvas.scale(scale, scale);
  const layered = alpha < 1 - ALPHA_EPSILON;
  if (layered)
    boundedLayer(
      canvas,
      alpha,
      Math.max(
        star ? r * SUN_CORONA_EXTENT : glow,
        r + SUN_RIM_GAP + bumpReach(frame, spec, scale),
      ),
    );
  const look = spec.sun;
  const drewStar =
    look !== undefined &&
    drawStarSun(canvas, frame, spec, look, r, scale, pulse, effects);
  if (!drewStar) {
    canvas.drawCircle(
      0,
      0,
      glow,
      inkPaint(
        spec.outlineInk,
        SUN_GLOW_OPACITY * (1 + SUN_PULSE_OPACITY_FRAC * pulse),
      ),
    );
    drawMoonBump(canvas, frame, spec, r + SUN_RIM_GAP, scale);
    canvas.drawCircle(0, 0, r + SUN_RIM_GAP, inkPaint(spec.outlineInk, 1));
    if (spec.photo) drawDiscPhoto(canvas, spec.photo, r);
    else drawSwatch(canvas, spec, r);
  }
  if (layered) canvas.restore();
  canvas.restore();
  return true;
}
