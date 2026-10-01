/**
 * ORRERY LAB A — ARCH PERF PASS: the imperative scene renderer.
 *
 * WHY (see _notes/ARCH-PERF-PASS.md): RN-Skia 2.6.2's declarative Canvas
 * redraws by re-converting EVERY animated prop of the whole node tree
 * (`JsiRecorder::applyUpdates`, incl. a string-keyed uniform map per shader
 * node), replaying the whole command list, and — because every body root and
 * every label had a `layer` paint — opening ~120 FULL-CANVAS `saveLayer`
 * render targets per frame. On the Pixel's Mali driver each layer is a
 * framebuffer bind + transient allocation (ioctl/mmap/munmap churn). That
 * saturated the main thread at ~12 fps (release) for any redraw, and the
 * redraw ran on every clock tick.
 *
 * Here the same visuals are drawn imperatively into a few SkPictures from
 * the ONE sampled `frame` plus immutable resources prepared on the JS thread
 * (SkParagraphs, SkImages, compiled SkRuntimeEffects, token RGBA inks). No
 * full-canvas layers: a body/label gets a layer only while it is partially
 * transparent (fades), and that layer is BOUNDED to its own extent. The focus
 * dim is a background-ink veil over the disc (+ halo alpha), not a layer.
 *
 * Presentation only: positions, radii, hit geometry and label allocation are
 * read from `frame` / `allocations` exactly as the declarative layers did.
 *
 * Hermes forward-ref rule: every worklet helper is defined ABOVE its callers
 * (`orrery-worklet-order.test.ts` scans this file).
 */
import type {
  SkCanvas,
  SkImage,
  SkPaint,
  SkParagraph,
  SkPath,
  SkPicture,
  SkRuntimeEffect,
  SkShader,
} from "@shopify/react-native-skia";
import { Skia } from "@shopify/react-native-skia";
import { type CameraPose, RING_SEGMENTS } from "@/logic/orrery-camera-logic";
import {
  type AnimatedFrame,
  type AnimatedFrameBody,
  frameBody,
} from "@/logic/orrery-frame";
import type { LabelAllocation } from "@/logic/orrery-label-logic";
import type { ReorderDrag } from "@/logic/orrery-reorder-logic";
import { findStacks } from "./body-stack";
import {
  BODY_EDGE_LIT,
  BODY_EDGE_NIGHT,
  BODY_ENTER_FADE_MS,
  BODY_HALO_ALPHA_DARK,
  BODY_HALO_ALPHA_LIGHT,
  BODY_HALO_REACH,
  BODY_KEYLINE_ALPHA_DARK,
  BODY_KEYLINE_ALPHA_LIGHT,
  BODY_KEYLINE_DP,
  BODY_RIM_DARK,
  BODY_RIM_LIGHT,
  BODY_SHADOW_MAX_DARK,
  BODY_SHADOW_MAX_LIGHT,
  BODY_SPEC_DARK,
  BODY_SPEC_LIGHT,
  CORONA_ALPHA_DARK,
  CORONA_ALPHA_LIGHT,
  CORONA_EXTENT,
  CORONA_SPEED,
  FLARE_GAIN,
  FOCUS_BODY_DIM,
  LEADER_ALPHA,
  NEBULA_PAN_PARALLAX,
  NEBULA_TILT_SLIDE,
  NEBULA_ZOOM_SCALE,
  PHOTO_FADE_MS,
  PLATE_ALPHA,
  PLATE_BORDER_ALPHA,
  PLATE_TICK_WIDTH,
  SKY_YAW_FACTOR,
  STACK_PIP_ANGLE,
  STACK_PIP_MAX,
  STACK_PIP_R,
  STACK_PIP_STEP,
  STARS_FAR_PAN_PARALLAX,
  STARS_FAR_TILT_SLIDE,
  STARS_FAR_ZOOM_SCALE,
  STARS_NEAR_PAN_PARALLAX,
  STARS_NEAR_TILT_SLIDE,
  STARS_NEAR_ZOOM_SCALE,
  SUN_GRANULE_SPEED,
  SWITCH_SKY_KICK,
  SWITCH_STAR_STRETCH,
  WARP_COPIES,
  WARP_STEP,
} from "./deep-field-config";
import { type DeepFieldInk, type Rgba, withAlpha } from "./deep-field-ink";
import {
  type BodyLightMap,
  bodyDepthScale,
  bodyVisualScale,
  mapHomography,
  moonVisualScale,
  planeHomography,
  type SwitchFx,
} from "./deep-field-math";

/** Skia enum values used imperatively (verified against skia/types). */
const STYLE_STROKE = 1;
const BLEND_SRC_OVER = 3;
const BLEND_SCREEN = 14;
const FILTER_LINEAR = 1;
const MIPMAP_NONE = 0;
const CLIP_INTERSECT = 1;
const DEG = 180 / Math.PI;
/** Label plate paddings — mirror OrreryLabel (SPACING.sm / SPACING.xs). */
export const LABEL_PAD_X = 8;
export const LABEL_PAD_Y = 4;
/** Label plate corner radius — mirrors OrreryLabel (RADII.sm). */
export const LABEL_RADIUS = 8;
/** Up-left key light when a body has no light entry (as the removed
 *  declarative `BodyLightOverlay` did). */
const DEFAULT_LIGHT = [-0.6, -0.8, 0] as const;
/** Local-space AA band ≈ this many dp, divided by the projected scale. */
const AA_DP = 0.6;
/** Status-outline width around a contact disc (OrbitBody OUTLINE_WIDTH). */
const OUTLINE_WIDTH = 3;
/** Below this alpha a body/label draws nothing; above 1-ε it needs no layer. */
const ALPHA_EPS = 0.001;

/** One body's immutable draw resources (built on the JS thread). */
export interface LabBodySpec {
  key: string;
  kind: "contact" | "sun" | "satellite";
  /** Source order (resources, then satellites): equal-depth tie-break. */
  order: number;
  /** World radius (the frame's projected radius / this = billboard scale). */
  radius: number;
  /** Contact: status body fill. Sun: occupant glow. Moon: textSecondary. */
  fill: Rgba;
  /** Fallback swatch behind the initials (contact). */
  swatch: Rgba;
  /** Pre-shaped initials (contact: swatchText; sun: star text) or null. */
  initials: SkParagraph | null;
  fontSize: number;
  image: SkImage | null;
  imageWidth: number;
  imageHeight: number;
  /** JS wall-clock ms when the current image was published (photo fade). */
  photoAt: number;
  /** JS wall-clock ms when this key first appeared (mount fade); 0 = none. */
  enterAt: number;
}

/** One label's immutable draw resources. */
export interface LabTextSpec {
  paragraph: SkParagraph;
  width: number;
  height: number;
}
export interface LabLabelSpec {
  id: string;
  text: LabTextSpec;
  context: LabTextSpec | null;
  tick: Rgba;
}

/** Compiled effects (null → plain fallbacks, as the declarative layers). */
export interface LabEffects {
  body: SkRuntimeEffect | null;
  corona: SkRuntimeEffect | null;
  sunDisc: SkRuntimeEffect | null;
  ring: SkRuntimeEffect | null;
}

/** Token inks the scene needs besides `DeepFieldInk` (plain RGBA). */
export interface LabSceneInks {
  surface: Rgba;
  textPrimary: Rgba;
  textSecondary: Rgba;
  accent: Rgba;
  polarisHalo: Rgba;
}

/** Recorded-once sky resources (DeepFieldBackdrop's, unchanged). */
export interface LabSky {
  nebula: SkImage | null;
  radius: number;
  far: SkPicture;
  nearA: SkPicture;
  nearB: SkPicture;
  vignette: SkShader | null;
  width: number;
  height: number;
}

function clamp01(v: number): number {
  "worklet";
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

function fillPaint(color: Rgba, alpha: number): SkPaint {
  "worklet";
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(withAlpha(color, alpha));
  return paint;
}

function strokePaint(color: Rgba, alpha: number, width: number): SkPaint {
  "worklet";
  const paint = fillPaint(color, alpha);
  paint.setStyle(STYLE_STROKE);
  paint.setStrokeWidth(width);
  return paint;
}

/** A bounded transparency layer (never full-canvas). */
function boundedLayer(
  canvas: SkCanvas,
  alpha: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  "worklet";
  const paint = Skia.Paint();
  paint.setAlphaf(clamp01(alpha));
  canvas.saveLayer(paint, Skia.XYWHRect(x, y, w, h));
}

/** Square "cover" source rect of an image (fit="cover" into a square dst). */
function coverSource(width: number, height: number) {
  "worklet";
  const side = Math.max(1, Math.min(width, height));
  return Skia.XYWHRect((width - side) / 2, (height - side) / 2, side, side);
}

/**
 * Draws `image` cover-fit into the disc of radius `r` at the origin, clipped
 * to the circle. A disposed image (custody race) throws in RN-Skia: the photo
 * is then skipped and the initials underneath stay visible.
 */
function drawDiscPhoto(
  canvas: SkCanvas,
  image: SkImage,
  imageWidth: number,
  imageHeight: number,
  r: number,
  alpha: number,
): void {
  "worklet";
  if (alpha <= ALPHA_EPS) return;
  canvas.save();
  const box = Skia.XYWHRect(-r, -r, r * 2, r * 2);
  canvas.clipRRect(Skia.RRectXY(box, r, r), CLIP_INTERSECT, true);
  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setAlphaf(clamp01(alpha));
  try {
    canvas.drawImageRectOptions(
      image,
      coverSource(imageWidth, imageHeight),
      box,
      FILTER_LINEAR,
      MIPMAP_NONE,
      paint,
    );
  } catch {
    // Disposed image: keep the initials (never crash the render loop).
  }
  canvas.restore();
}

/** Uniforms of BODY_SKSL in declaration order (35 floats). */
export function bodyUniforms(
  radius: number,
  light: readonly number[],
  scale: number,
  rim: Rgba,
  ink: DeepFieldInk,
): number[] {
  "worklet";
  const chart = ink.chart;
  const s = Math.max(0.05, scale);
  return [
    radius,
    light[0],
    light[1],
    light[2],
    AA_DP / s,
    chart ? BODY_SHADOW_MAX_LIGHT : BODY_SHADOW_MAX_DARK,
    chart ? BODY_RIM_LIGHT : BODY_RIM_DARK,
    chart ? BODY_HALO_ALPHA_LIGHT : BODY_HALO_ALPHA_DARK,
    BODY_HALO_REACH,
    chart ? 1 : 0,
    BODY_EDGE_LIT,
    BODY_EDGE_NIGHT,
    chart ? BODY_SPEC_LIGHT : BODY_SPEC_DARK,
    ink.shadow[0],
    ink.shadow[1],
    ink.shadow[2],
    ink.shadow[3],
    rim[0],
    rim[1],
    rim[2],
    rim[3],
    ink.voidTone[0],
    ink.voidTone[1],
    ink.voidTone[2],
    ink.voidTone[3],
    ink.starlight[0],
    ink.starlight[1],
    ink.starlight[2],
    ink.starlight[3],
    ink.background[0],
    ink.background[1],
    ink.background[2],
    ink.background[3],
    BODY_KEYLINE_DP / s / radius,
    chart ? BODY_KEYLINE_ALPHA_LIGHT : BODY_KEYLINE_ALPHA_DARK,
  ];
}

/** Uniforms of CORONA_SKSL in declaration order (14 floats). */
export function coronaUniforms(
  radius: number,
  time: number,
  flare: number,
  glow: Rgba,
  ink: DeepFieldInk,
): number[] {
  "worklet";
  return [
    radius,
    time,
    flare,
    CORONA_EXTENT,
    ink.chart ? 1 : 0,
    ink.chart ? CORONA_ALPHA_LIGHT : CORONA_ALPHA_DARK,
    ink.starlight[0],
    ink.starlight[1],
    ink.starlight[2],
    ink.starlight[3],
    glow[0],
    glow[1],
    glow[2],
    glow[3],
  ];
}

/** Uniforms of SUN_DISC_SKSL in declaration order (13 floats). */
export function sunDiscUniforms(
  radius: number,
  time: number,
  photo: boolean,
  scale: number,
  flare: number,
  glow: Rgba,
  ink: DeepFieldInk,
): number[] {
  "worklet";
  const core = ink.chart ? ink.background : ink.starlight;
  return [
    radius,
    time,
    photo ? 1 : 0,
    0.7 / Math.max(0.05, scale),
    flare,
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

/** Draw order of the body batch: depth ascending, ties in source order —
 *  exactly RN-Skia's zIndex flush (`Recorder::flushPendingGroups`). */
export function orderBodies(
  frame: AnimatedFrame,
  specs: readonly LabBodySpec[],
): { spec: LabBodySpec; body: AnimatedFrameBody }[] {
  "worklet";
  const out: { spec: LabBodySpec; body: AnimatedFrameBody }[] = [];
  for (let i = 0; i < specs.length; i++) {
    const body = frameBody(frame, specs[i].key);
    if (body) out.push({ spec: specs[i], body });
  }
  out.sort(
    (a, b) =>
      (Number.isFinite(a.body.depth) ? a.body.depth : 0) -
        (Number.isFinite(b.body.depth) ? b.body.depth : 0) ||
      a.spec.order - b.spec.order,
  );
  return out;
}

/** Mount / photo fade alpha from JS wall-clock stamps (1 under RM). */
export function fadeIn(at: number, now: number, ms: number, still: boolean) {
  "worklet";
  if (still || !(at > 0)) return 1;
  return clamp01((now - at) / ms);
}

/** A contact planet (Lab A treatment; ported from the removed declarative
 *  OrbitBody Lab branch + `BodyLightOverlay`). */
export function drawContactBody(
  canvas: SkCanvas,
  spec: LabBodySpec,
  body: AnimatedFrameBody,
  light: BodyLightMap,
  ink: DeepFieldInk,
  effect: SkRuntimeEffect | null,
  now: number,
  still: boolean,
  dim: number,
): void {
  "worklet";
  const opacity = body.visible ? body.opacity : 0;
  const r = spec.radius;
  if (!(opacity > ALPHA_EPS) || !(r > 0)) return;
  const base = body.radius / r;
  const l = light[spec.key] ?? DEFAULT_LIGHT;
  const scale = base * bodyVisualScale(r * base) * bodyDepthScale(l[2] ?? 0);
  const alpha = opacity * fadeIn(spec.enterAt, now, BODY_ENTER_FADE_MS, still);
  if (alpha <= ALPHA_EPS) return;
  canvas.save();
  canvas.translate(body.x, body.y);
  canvas.scale(scale, scale);
  const reach = r * BODY_HALO_REACH;
  const layered = alpha < 1 - ALPHA_EPS;
  if (layered)
    boundedLayer(canvas, alpha, -reach, -reach, reach * 2, reach * 2);
  const innerR = Math.max(1, r - OUTLINE_WIDTH / 2);
  canvas.drawCircle(0, 0, r, fillPaint(spec.fill, spec.fill[3]));
  canvas.drawCircle(0, 0, innerR, fillPaint(spec.swatch, spec.swatch[3]));
  if (spec.initials)
    spec.initials.paint(canvas, -innerR, -spec.fontSize * 0.72);
  if (spec.image)
    drawDiscPhoto(
      canvas,
      spec.image,
      spec.imageWidth,
      spec.imageHeight,
      innerR,
      fadeIn(spec.photoAt, now, PHOTO_FADE_MS, still),
    );
  if (effect) {
    const overlay = Skia.Paint();
    overlay.setAntiAlias(true);
    overlay.setShader(
      effect.makeShader(
        bodyUniforms(
          r,
          [l[0], l[1], l[2] ?? 0],
          base * bodyVisualScale(r * base),
          spec.fill,
          ink,
        ),
      ),
    );
    if (dim < 1) overlay.setAlphaf(dim);
    canvas.drawCircle(0, 0, reach, overlay);
  }
  // Focus dim (pass 3 −22 %) as a background-ink veil over the disc: the
  // layer-free equivalent of the former whole-body layer alpha.
  if (dim < 1) canvas.drawCircle(0, 0, r, fillPaint(ink.background, 1 - dim));
  if (layered) canvas.restore();
  canvas.restore();
}

/** A relationship moon (Lab A treatment; ported from the removed declarative
 *  SatelliteBody Lab branch). */
export function drawMoonBody(
  canvas: SkCanvas,
  spec: LabBodySpec,
  body: AnimatedFrameBody,
  light: BodyLightMap,
  ink: DeepFieldInk,
  effect: SkRuntimeEffect | null,
): void {
  "worklet";
  const opacity = body.visible ? body.opacity : 0;
  if (!(opacity > ALPHA_EPS)) return;
  const base = body.radius;
  const scale = base * moonVisualScale(base);
  canvas.save();
  canvas.translate(body.x, body.y);
  canvas.scale(scale, scale);
  const reach = BODY_HALO_REACH;
  const layered = opacity < 1 - ALPHA_EPS;
  if (layered)
    boundedLayer(canvas, opacity, -reach, -reach, reach * 2, reach * 2);
  canvas.drawCircle(0, 0, 1, fillPaint(spec.fill, spec.fill[3]));
  if (effect) {
    const l = light[spec.key] ?? DEFAULT_LIGHT;
    const overlay = Skia.Paint();
    overlay.setAntiAlias(true);
    overlay.setShader(
      effect.makeShader(
        bodyUniforms(
          1,
          [l[0], l[1], l[2] ?? 0],
          base * bodyVisualScale(base),
          spec.fill,
          ink,
        ),
      ),
    );
    canvas.drawCircle(0, 0, reach, overlay);
  }
  if (layered) canvas.restore();
  canvas.restore();
}

/** The sun (Lab A treatment; ported from the removed declarative SunBody Lab
 *  branch + `SunCorona` / `SunDisc`). */
export function drawSunBody(
  canvas: SkCanvas,
  spec: LabBodySpec,
  body: AnimatedFrameBody,
  ink: DeepFieldInk,
  effects: LabEffects,
  ambient: number,
  flare: number,
): void {
  "worklet";
  const opacity = body.visible ? body.opacity : 0;
  const r = spec.radius;
  if (!(opacity > ALPHA_EPS) || !(r > 0)) return;
  const still = ambient < 0;
  const scale = body.radius / r;
  canvas.save();
  canvas.translate(body.x, body.y);
  canvas.scale(scale, scale);
  const half = r * CORONA_EXTENT;
  const layered = opacity < 1 - ALPHA_EPS;
  if (layered) boundedLayer(canvas, opacity, -half, -half, half * 2, half * 2);
  // Corona (+ switch flare); static under reduced motion.
  if (effects.corona) {
    const corona = Skia.Paint();
    corona.setAntiAlias(true);
    corona.setBlendMode(ink.chart ? BLEND_SRC_OVER : BLEND_SCREEN);
    corona.setShader(
      effects.corona.makeShader(
        coronaUniforms(
          r,
          still ? 1.7 : ambient * CORONA_SPEED,
          still ? 0 : flare * FLARE_GAIN,
          spec.fill,
          ink,
        ),
      ),
    );
    canvas.drawRect(Skia.XYWHRect(-half, -half, half * 2, half * 2), corona);
  } else canvas.drawCircle(0, 0, r * 1.8, fillPaint(spec.fill, 0.35));
  // Fine limb line just outside the disc.
  canvas.drawCircle(0, 0, r + 1, fillPaint(spec.fill, spec.fill[3]));
  const time = still ? 2.3 : ambient * SUN_GRANULE_SPEED;
  if (spec.image) {
    drawDiscPhoto(canvas, spec.image, spec.imageWidth, spec.imageHeight, r, 1);
    if (effects.sunDisc) {
      const limb = Skia.Paint();
      limb.setAntiAlias(true);
      // The photo limb never carried the flare (the removed declarative
      // SunBody Lab branch passed none); kept for parity.
      limb.setShader(
        effects.sunDisc.makeShader(
          sunDiscUniforms(r, time, true, scale, 0, spec.fill, ink),
        ),
      );
      canvas.drawCircle(0, 0, r, limb);
    }
  } else if (effects.sunDisc) {
    const disc = Skia.Paint();
    disc.setAntiAlias(true);
    disc.setShader(
      effects.sunDisc.makeShader(
        sunDiscUniforms(
          r,
          time,
          false,
          scale,
          still ? 0 : flare,
          spec.fill,
          ink,
        ),
      ),
    );
    canvas.drawCircle(0, 0, r, disc);
    if (spec.initials) spec.initials.paint(canvas, -r, -spec.fontSize * 0.72);
  } else if (spec.initials)
    spec.initials.paint(canvas, -r, -spec.fontSize * 0.72);
  if (layered) canvas.restore();
  canvas.restore();
}

/** Parallax sky transform (DeepFieldBackdrop's per-layer Group transform). */
function skyTransform(
  canvas: SkCanvas,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  tilt: number,
  yaw: number,
  pan: number,
  slide: number,
  scale: number,
): void {
  "worklet";
  canvas.translate(cx + dx * pan, cy + dy * pan - tilt * slide);
  canvas.rotate(-yaw * DEG, 0, 0);
  canvas.scale(scale, scale);
}

/**
 * The deep-field sky (DeepFieldBackdrop), from the frame's camera. Parity
 * note: in the declarative layer the twinkle/warp `Group opacity` never
 * reached `<Picture>` (RN-Skia's drawPicture takes no paint), so the near
 * stars always rendered at full alpha, overdrawn by the 5 warp copies of
 * group A. That on-screen result is reproduced exactly here, deliberately:
 * at rest (velocity 0) every warp level shares one transform, so `nearA` is
 * replayed WARP_COPIES + 1 times on the same spot (compounding its alpha)
 * while `nearB` draws once. That replay IS the current look; the per-group
 * twinkle and a warp-copy alpha never took effect (their tunables were
 * removed as unused). Changing it is a visual decision, not a cleanup.
 */
export function drawSky(
  canvas: SkCanvas,
  sky: LabSky,
  frame: AnimatedFrame,
  fx: SwitchFx,
  nebulaAlpha: number,
): void {
  "worklet";
  const cx = sky.width / 2;
  const cy = sky.height / 2;
  const dx = frame.center.x - cx;
  const dy = frame.center.y - cy;
  const pose: CameraPose = frame.pose;
  const yaw = (pose.yaw ?? 0) * SKY_YAW_FACTOR + fx.kick * SWITCH_SKY_KICK;
  const tilt = pose.tilt ?? 0;
  const lz = Math.log2(Math.max(0.25, pose.zoom));
  const stretch = fx.velocity * SWITCH_STAR_STRETCH;
  const v = fx.velocity;
  if (sky.nebula && nebulaAlpha > ALPHA_EPS) {
    canvas.save();
    skyTransform(
      canvas,
      cx,
      cy,
      dx,
      dy,
      tilt,
      yaw,
      NEBULA_PAN_PARALLAX,
      NEBULA_TILT_SLIDE,
      1 + lz * NEBULA_ZOOM_SCALE,
    );
    const paint = Skia.Paint();
    paint.setAlphaf(clamp01(nebulaAlpha));
    const side = sky.radius * 2;
    canvas.drawImageRectOptions(
      sky.nebula,
      Skia.XYWHRect(0, 0, sky.nebula.width(), sky.nebula.height()),
      Skia.XYWHRect(-sky.radius, -sky.radius, side, side),
      FILTER_LINEAR,
      MIPMAP_NONE,
      paint,
    );
    canvas.restore();
  }
  canvas.save();
  skyTransform(
    canvas,
    cx,
    cy,
    dx,
    dy,
    tilt,
    yaw,
    STARS_FAR_PAN_PARALLAX,
    STARS_FAR_TILT_SLIDE,
    1 + lz * STARS_FAR_ZOOM_SCALE + stretch * 0.5,
  );
  canvas.drawPicture(sky.far);
  canvas.restore();
  for (let level = 0; level <= WARP_COPIES; level++) {
    canvas.save();
    skyTransform(
      canvas,
      cx,
      cy,
      dx,
      dy,
      tilt,
      yaw,
      STARS_NEAR_PAN_PARALLAX,
      STARS_NEAR_TILT_SLIDE,
      1 + lz * STARS_NEAR_ZOOM_SCALE + stretch + level * WARP_STEP * v * v,
    );
    canvas.drawPicture(sky.nearA);
    if (level === 0) canvas.drawPicture(sky.nearB);
    canvas.restore();
  }
  if (sky.vignette) {
    const paint = Skia.Paint();
    paint.setShader(sky.vignette);
    canvas.drawRect(Skia.XYWHRect(0, 0, sky.width, sky.height), paint);
  }
}

/** Polaris marker (Polaris.tsx) at its projected point. */
export function drawPolaris(
  canvas: SkCanvas,
  x: number,
  y: number,
  star: SkPath,
  haloRadius: number,
  inks: LabSceneInks,
): void {
  "worklet";
  canvas.save();
  canvas.translate(x, y);
  canvas.drawCircle(
    0,
    0,
    haloRadius,
    fillPaint(inks.polarisHalo, 0.25 * inks.polarisHalo[3]),
  );
  canvas.drawPath(star, fillPaint(inks.textPrimary, inks.textPrimary[3]));
  canvas.drawCircle(0, 0, 2, fillPaint(inks.textPrimary, inks.textPrimary[3]));
  canvas.restore();
}

/** Reorder ghost (OrreryWorld ReorderGhost): held ring + circle, accent. */
export function drawReorderGhost(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  drag: ReorderDrag | null,
  inks: LabSceneInks,
): void {
  "worklet";
  if (!drag?.active) return;
  const body = frame.bodies.find((b) => b.id === drag.id);
  if (!body) return;
  const path = Skia.Path.Make();
  let points: readonly { x: number; y: number }[] = body.ringPath;
  if (!points.length && body.ringRadius > 0) {
    // Lab frames carry no ring polygons (camera perf pass): project the same
    // RING_SEGMENTS-gon from the exact homography (only while dragging).
    const H = planeHomography(frame.pose, frame.viewport);
    const R = body.ringRadius / (frame.pose.zoom > 0 ? frame.pose.zoom : 1);
    const ring: { x: number; y: number }[] = [];
    for (let i = 0; i < RING_SEGMENTS; i++) {
      const t = (i * 2 * Math.PI) / RING_SEGMENTS;
      const p = mapHomography(H, R * Math.sin(t), -R * Math.cos(t));
      ring.push({ x: p.x, y: p.y });
    }
    points = ring;
  }
  if (points.length) {
    path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++)
      path.lineTo(points[i].x, points[i].y);
    path.close();
  }
  path.addCircle(body.x, body.y, body.radius + 4);
  canvas.drawPath(path, strokePaint(inks.accent, inks.accent[3], 2));
}

/** One allocated label plate (Lab A instrument plate in OrreryLabel's exact
 *  rect; ported from its removed declarative Lab branch). */
function drawPlate(
  canvas: SkCanvas,
  x: number,
  y: number,
  text: LabTextSpec,
  ink: DeepFieldInk,
  inks: LabSceneInks,
  tick: Rgba | null,
  leaderBody: AnimatedFrameBody | null,
): void {
  "worklet";
  const box = Skia.XYWHRect(x, y, text.width, text.height);
  const plate = Skia.RRectXY(box, LABEL_RADIUS, LABEL_RADIUS);
  canvas.drawRRect(
    plate,
    fillPaint(inks.surface, inks.surface[3] * PLATE_ALPHA),
  );
  canvas.drawRRect(plate, strokePaint(ink.grid, PLATE_BORDER_ALPHA, 0.75));
  if (tick)
    canvas.drawRect(
      Skia.XYWHRect(
        x + 3,
        y + LABEL_PAD_Y,
        PLATE_TICK_WIDTH,
        Math.max(2, text.height - LABEL_PAD_Y * 2),
      ),
      fillPaint(tick, tick[3]),
    );
  if (leaderBody) {
    const b = leaderBody;
    const px = x + text.width / 2;
    const below = y >= b.y;
    const plateY = below ? y : y + text.height;
    const edgeY = below ? b.y + b.radius : b.y - b.radius;
    const dx = px - b.x;
    if (Math.hypot(dx, plateY - edgeY) >= 2)
      canvas.drawLine(
        b.x + Math.max(-b.radius, Math.min(b.radius, dx * 0.5)),
        edgeY,
        px,
        plateY,
        strokePaint(ink.textSecondary, LEADER_ALPHA, 1),
      );
  }
  text.paragraph.paint(canvas, x + LABEL_PAD_X, y + LABEL_PAD_Y);
}

/** Every allocated label + context line, in label order (screen space). */
export function drawLabels(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  labels: readonly LabLabelSpec[],
  allocations: readonly LabelAllocation[],
  ink: DeepFieldInk,
  inks: LabSceneInks,
): void {
  "worklet";
  const byId: Record<string, LabelAllocation> = {};
  for (let i = 0; i < allocations.length; i++)
    if (byId[allocations[i].id] === undefined)
      byId[allocations[i].id] = allocations[i];
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const item = byId[label.id];
    if (!item) continue;
    const opacity = item.opacity ?? 0;
    if (!(opacity > ALPHA_EPS)) continue;
    const layered = opacity < 1 - ALPHA_EPS;
    for (let part = 0; part < 2; part++) {
      const rect = part === 0 ? item.rect : item.contextRect;
      const text = part === 0 ? label.text : label.context;
      if (!rect || !text) continue;
      const body = part === 0 ? (frameBody(frame, label.id) ?? null) : null;
      if (layered) {
        // Bounded to the plate plus its leader towards the body.
        let x0 = rect.x;
        let y0 = rect.y;
        let x1 = rect.x + text.width;
        let y1 = rect.y + text.height;
        if (body) {
          x0 = Math.min(x0, body.x - body.radius);
          x1 = Math.max(x1, body.x + body.radius);
          y0 = Math.min(y0, body.y - body.radius);
          y1 = Math.max(y1, body.y + body.radius);
        }
        boundedLayer(canvas, opacity, x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
      }
      drawPlate(
        canvas,
        rect.x,
        rect.y,
        text,
        ink,
        inks,
        part === 0 ? label.tick : null,
        body,
      );
      if (layered) canvas.restore();
    }
  }
}

/** Stack pips over co-angular bodies (BodyStackLayer, unchanged rules). */
export function drawStackPips(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  light: BodyLightMap,
  fx: SwitchFx,
  ringInks: Readonly<Record<string, Rgba>>,
  ink: DeepFieldInk,
  keyOf: (body: AnimatedFrameBody) => string,
): void {
  "worklet";
  if (fx.active) return;
  const stacks = findStacks(frame, light);
  if (!stacks.length) return;
  const key = fillPaint(ink.background, 0.95);
  const more = strokePaint(ink.textSecondary, 1, 1.2);
  for (let s = 0; s < stacks.length; s++) {
    const st = stacks[s];
    const front = frame.bodies[st.front];
    if (!ringInks[keyOf(front)]) continue;
    const shown = Math.min(st.hidden.length, STACK_PIP_MAX);
    for (let k = 0; k < shown; k++) {
      const a = STACK_PIP_ANGLE - k * STACK_PIP_STEP;
      const px = front.x + Math.cos(a) * (st.radius + STACK_PIP_R * 0.35);
      const py = front.y + Math.sin(a) * (st.radius + STACK_PIP_R * 0.35);
      canvas.drawCircle(px, py, STACK_PIP_R + 1.3, key);
      if (k === STACK_PIP_MAX - 1 && st.hidden.length > STACK_PIP_MAX) {
        canvas.drawCircle(px, py, STACK_PIP_R - 0.6, more);
        continue;
      }
      const hidden = frame.bodies[st.hidden[k]];
      const c = ringInks[keyOf(hidden)] ?? ink.textSecondary;
      canvas.drawCircle(px, py, STACK_PIP_R, fillPaint(c, 1));
    }
  }
}

/** Focus dim factor of a body key (1 = undimmed), as the pass-3 body layer. */
export function focusDim(
  key: string,
  focusKeys: Readonly<Record<string, boolean>>,
  focusMix: number,
): number {
  "worklet";
  return focusKeys[key] ? 1 : 1 - FOCUS_BODY_DIM * focusMix;
}
