/**
 * 38.7-06 (D-43): the overlay picture — Polaris, the reorder outline, the
 * focus reticle and the occlusion dim, drawn from the shared frame
 * (drawn == tappable).
 *
 * Polaris is today's halo, 4-point star and centre dot (`hitPolaris`/
 * `onNorth` still reset north).
 * 38.7-11: the focused person carries Lab A's reticle (D-18) — the old solid
 * accent focus ring is gone — and every Orrery text surface gets the D-55
 * occlusion dim under it, drawn last.
 * 38.7-12 (D-23): the reorder hold, ported as drawn from Lab B
 * (`LabFocusFx.tsx` LabFeedbackPicture): while charging, a track ring and a
 * charge arc filling with the hold around the held body (screen space); once
 * armed, the held orbit as a glowing outline on the world plane (soft glow
 * under a bright line, D-44 ring shader) that flashes on arming and on every
 * slot change, and the D-18 reticle locked on the held body. The old plain
 * accent outline and the ghost ring around the body are gone.
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
  BlendMode,
  PaintStyle,
  type SkCanvas,
  Skia,
  type SkPaint,
  type SkRuntimeEffect,
  StrokeCap,
} from "@shopify/react-native-skia";
import type { CameraRect } from "@/logic/orrery-camera-logic";
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
import { RADII } from "@/theme/tokens/radii";
import { ORRERY_OCCLUSION_DIM_MAX } from "@/theme/tokens/surface";
import { drawPlaneRing, plainRingLine, type RingBands } from "./draw-plane";
import type { FocusDraw } from "./focus-fx";
import type { OrreryInk, OverlaySpec } from "./scene-specs";
import {
  RETICLE_ARM_FRAC,
  RETICLE_ARM_MAX,
  RETICLE_ARM_MIN,
  RETICLE_FLASH_ALPHA,
  RETICLE_GAP,
  RETICLE_GAP_FRAC,
  RETICLE_LOCK_END,
  RETICLE_LOCK_OVERSHOOT,
  RETICLE_LOCK_ROTATE,
  RETICLE_LOCK_SCALE,
  RETICLE_PING_REACH,
  RETICLE_RING_ALPHA,
  RETICLE_RING_DP,
  RETICLE_SCAN_ARC,
  RETICLE_SCAN_PARK,
  RETICLE_SCAN_SWEEP,
  RETICLE_STROKE_DP,
  RETICLE_TICK_DP,
} from "./visual-tunables";

// ── 38.7-12 (D-23) tunables: the reorder hold, Lab B values as drawn ──────

/** Charge track and arc stroke, dp (Lab B `CHARGE_DP` 2). */
export const HOLD_CHARGE_DP = 2;
/** Charge track ring alpha (Lab B `CHARGE_TRACK_ALPHA` 0.22). */
export const HOLD_CHARGE_TRACK_ALPHA = 0.22;
/** Charge arc alpha (Lab B 0.9). */
export const HOLD_CHARGE_ARC_ALPHA = 0.9;
/** Charge ring radius: max(MIN, drawn × REACH + PAD) (Lab B `bracketRadius` 1.22 / 6 / 12). */
export const HOLD_RING_REACH = 1.22;
export const HOLD_RING_PAD = 6;
export const HOLD_RING_MIN = 12;
/** Armed orbit outline: soft glow width / alpha (Lab B `HELD_GLOW_DP` 7, `HELD_GLOW_ALPHA` 0.18). */
export const HELD_GLOW_DP = 7;
export const HELD_GLOW_ALPHA = 0.18;
/** Armed orbit outline: line width / alpha (Lab B `HELD_LINE_DP` 1.6, `HELD_LINE_ALPHA` 0.9). */
export const HELD_LINE_DP = 1.6;
export const HELD_LINE_ALPHA = 0.9;
/** Slot flash (Lab B `slotFlash`): width 3 → 3 + 12 dp (ease-out cubic), alpha 0.55·(1 − u)². */
export const SLOT_FLASH_BASE_DP = 3;
export const SLOT_FLASH_GROW_DP = 12;
export const SLOT_FLASH_ALPHA = 0.55;
/** Reduced motion: a static 3 dp flash fading 0.6·(1 − u) (Lab B). */
export const SLOT_FLASH_REDUCED_ALPHA = 0.6;

/** Polaris halo: 1.5 × the marker radius at 0.25 alpha. */
const POLARIS_HALO_SCALE = 1.5;
const POLARIS_HALO_ALPHA = 0.25;
const POLARIS_DOT_RADIUS = 2;
/** The reticle flash's half-width on the lock timeline (around t = 1), Lab A. */
const RETICLE_FLASH_SPAN = 0.35;
/**
 * Occlusion rects follow the Orrery HUD plates' corner radius (`HUD_PLATE`,
 * `RADII.sm`, 38.7-12): every Orrery glass surface the dim backs is an 8 dp
 * plate, so the old 16 dp corners left the plates' corners undimmed (38.7-14).
 */
export const OCCLUSION_RADIUS = RADII.sm;
const DEG = 180 / Math.PI;
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

/** Lab A `reticleGeometry`: the bracket box half-size and arm (screen dp). */
export function reticleGeometry(drawn: number): { half: number; arm: number } {
  "worklet";
  const r = drawn > 0 ? drawn : 0;
  const half = r + Math.max(RETICLE_GAP, r * RETICLE_GAP_FRAC);
  const arm = Math.max(
    RETICLE_ARM_MIN,
    Math.min(RETICLE_ARM_MAX, half * RETICLE_ARM_FRAC),
  );
  return { half, arm };
}

/** easeOutBack (overshoot k) on 0..1 — the brackets' snap onto the body. */
export function easeOutBack(x: number, k: number): number {
  "worklet";
  const t = Math.max(0, Math.min(1, x)) - 1;
  return 1 + (k + 1) * t * t * t + k * t * t;
}

/** A round- or butt-capped stroke paint. */
function capPaint(
  ink: OrreryInk,
  alpha: number,
  width: number,
  round: boolean,
): SkPaint {
  "worklet";
  const paint = strokePaint(ink, alpha, width);
  paint.setStrokeCap(round ? StrokeCap.Round : StrokeCap.Butt);
  return paint;
}

/**
 * The reticle's lock-on state at time `t` on its timeline
 * (0 → RETICLE_LOCK_END; at or past the end it is locked and STILL):
 * bracket scale (× the box) and rotation (radians), bracket / lock-ring /
 * flash alphas (× opacity), the ping's progress (null = none) and the arc's
 * angle (radians clockwise from 12 o'clock). Lab A's timeline: 0 → 1 the
 * brackets converge with an outBack snap while the ring fades in and the arc
 * sweeps in; 1 → 2 a flash and one ping; then nothing moves (D-37).
 */
export function reticleLockState(t: number): {
  scale: number;
  rotation: number;
  bracketAlpha: number;
  ringAlpha: number;
  flashAlpha: number;
  ping: number | null;
  scan: number;
} {
  "worklet";
  const time = Number.isFinite(t) ? t : RETICLE_LOCK_END;
  const still = !(time < RETICLE_LOCK_END);
  const u = still ? 1 : easeOutBack(Math.min(1, time), RETICLE_LOCK_OVERSHOOT);
  const v = time - 1;
  const d = Math.abs(time - 1);
  return {
    scale: 1 + (1 - u) * (RETICLE_LOCK_SCALE - 1),
    rotation: (1 - u) * RETICLE_LOCK_ROTATE,
    bracketAlpha: still ? 1 : Math.max(0, Math.min(1, time * 2.5)),
    ringAlpha:
      RETICLE_RING_ALPHA *
      (still ? 1 : Math.max(0, Math.min(1, (time - 0.4) / 0.6))),
    flashAlpha:
      still || d >= RETICLE_FLASH_SPAN
        ? 0
        : (1 - d / RETICLE_FLASH_SPAN) * RETICLE_FLASH_ALPHA,
    ping: !still && v > 0 && v < 1 ? v : null,
    scan:
      RETICLE_SCAN_PARK -
      (1 - Math.min(1, Math.max(0, time))) * RETICLE_SCAN_SWEEP,
  };
}

/**
 * D-18: Lab A's reticle at (x, y) around a drawn disc of radius `drawn`, at
 * lock-on time `t` (`reticleLockState`):
 *   1. one ping ring leaving the lock ring after the converge;
 *   2. the thin lock ring, the four cardinal ticks and the bright arc;
 *   3. the four corner brackets (and their flash).
 * `opacity` is the body's opacity × the focus mix. Returns false when nothing
 * was drawn.
 */
export function drawReticle(
  canvas: SkCanvas,
  x: number,
  y: number,
  drawn: number,
  t: number,
  ink: OrreryInk,
  opacity: number,
): boolean {
  "worklet";
  if (!(drawn > 0) || !(opacity > 0.004)) return false;
  const state = reticleLockState(t);
  const ringR = drawn + RETICLE_RING_DP;
  // 1 · ping (after the converge), leaving the lock ring.
  const v = state.ping;
  if (v !== null)
    canvas.drawCircle(
      x,
      y,
      ringR + v * drawn * RETICLE_PING_REACH,
      capPaint(ink, (1 - v) * (1 - v) * 0.8 * opacity, 1.4, false),
    );
  // 2 · lock ring + cardinal ticks + the arc.
  const ringA = state.ringAlpha * opacity;
  if (ringA > 0.004) {
    canvas.drawCircle(x, y, ringR, capPaint(ink, ringA, 1, false));
    const r0 = ringR + 1.5;
    const r1 = r0 + RETICLE_TICK_DP;
    const tick = capPaint(ink, ringA * 1.4, 1.2, false);
    canvas.drawLine(x, y - r0, x, y - r1, tick);
    canvas.drawLine(x + r0, y, x + r1, y, tick);
    canvas.drawLine(x, y + r0, x, y + r1, tick);
    canvas.drawLine(x - r0, y, x - r1, y, tick);
    const arc = Skia.Path.Make();
    arc.addArc(
      Skia.XYWHRect(x - ringR, y - ringR, ringR * 2, ringR * 2),
      -90 + state.scan * DEG,
      RETICLE_SCAN_ARC * DEG,
    );
    canvas.drawPath(arc, capPaint(ink, ringA * 1.6, 1.8, true));
  }
  // 3 · brackets: converged from wide + rotated, then a flash.
  const { half, arm } = reticleGeometry(drawn);
  const h = half * state.scale;
  const path = Skia.Path.Make();
  for (let i = 0; i < 4; i++) {
    const sx = i === 0 || i === 3 ? -1 : 1;
    const sy = i < 2 ? -1 : 1;
    path.moveTo(sx * h, sy * (h - arm));
    path.lineTo(sx * h, sy * h);
    path.lineTo(sx * (h - arm), sy * h);
  }
  canvas.save();
  canvas.translate(x, y);
  canvas.rotate(state.rotation * DEG, 0, 0);
  const flash = state.flashAlpha * opacity;
  if (flash > 0.004)
    canvas.drawPath(path, capPaint(ink, flash, RETICLE_STROKE_DP * 2.6, true));
  canvas.drawPath(
    path,
    capPaint(ink, state.bracketAlpha * opacity, RETICLE_STROKE_DP, true),
  );
  canvas.restore();
  return true;
}

/**
 * D-18: the reticle on the single focused body (a contact, the sun or a
 * moon), never on a cluster. Nothing for a culled, hidden or absent body.
 */
export function drawFocusReticle(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  spec: OverlaySpec,
  focus: FocusDraw | null,
): boolean {
  "worklet";
  if (!focus || focus.spec.reticle === null || !(focus.mix > 0)) return false;
  const body = frameBodyByKey(frame, focus.spec.reticle);
  if (!body || body.culled || !body.visible || !(body.opacity > 0))
    return false;
  return drawReticle(
    canvas,
    body.x,
    body.y,
    body.radius,
    focus.lock,
    spec.ink.reticle,
    body.opacity * Math.min(1, focus.mix),
  );
}

/**
 * 38.7-12 (D-23): the hold's live feedback inputs — the charge (0..1, from
 * the hold gesture), the slot-flash timer (0..1, 1 = idle) and reduced motion.
 */
export interface ReorderHoldFx {
  charge: number;
  flash: number;
  reduced: boolean;
}
export const NO_HOLD_FX: ReorderHoldFx = Object.freeze({
  charge: 0,
  flash: 1,
  reduced: false,
});

/** Lab B `bracketRadius`: the charge ring around a drawn disc of radius `drawn`. */
export function holdRingRadius(drawn: number): number {
  "worklet";
  const r = drawn > 0 ? drawn : 0;
  return Math.max(HOLD_RING_MIN, r * HOLD_RING_REACH + HOLD_RING_PAD);
}

/** ease-out cubic on 0..1. */
function easeOutCubic(x: number): number {
  "worklet";
  const t = 1 - Math.max(0, Math.min(1, x));
  return 1 - t * t * t;
}

/**
 * Lab B `slotFlash`: the armed ring's flash at timer `u` (0 → 1), or null
 * when idle (u ≥ 1, or not a number).
 */
export function slotFlashLook(
  u: number,
  reduced: boolean,
): { widthDp: number; alpha: number } | null {
  "worklet";
  if (!(u >= 0) || u >= 1) return null;
  if (reduced)
    return {
      widthDp: SLOT_FLASH_BASE_DP,
      alpha: SLOT_FLASH_REDUCED_ALPHA * (1 - u),
    };
  return {
    widthDp: SLOT_FLASH_BASE_DP + SLOT_FLASH_GROW_DP * easeOutCubic(u),
    alpha: SLOT_FLASH_ALPHA * (1 - u) * (1 - u),
  };
}

/** A round-capped stroke, added (D-51) on dark themes. */
function holdPaint(
  ink: OrreryInk,
  alpha: number,
  width: number,
  additive: boolean,
): SkPaint {
  "worklet";
  const paint = capPaint(ink, alpha, width, true);
  if (additive) paint.setBlendMode(BlendMode.Plus);
  return paint;
}

/** One world-plane outline pass of the held orbit (the D-44 ring shader). */
function drawHeldRing(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  radius: number,
  widthDp: number,
  alpha: number,
  ink: OrreryInk,
  additive: boolean,
  effect: SkRuntimeEffect | null,
  bands: RingBands | null,
  aaDp: number,
): boolean {
  "worklet";
  return drawPlaneRing(
    canvas,
    planeHomography(frame.pose, frame.viewport),
    radius,
    { ...plainRingLine(widthDp / 2, aaDp, ink), alpha },
    effect,
    bands,
    additive ? BlendMode.Plus : undefined,
  );
}

/**
 * D-23, Lab B as drawn. While the hold charges (a drag that is not yet
 * active): a track ring and an arc from 12 o'clock sweeping `charge × 360°`
 * around the held body — screen space, never under the perspective matrix,
 * nothing for a culled or hidden body. Once armed: the held orbit (the
 * preview frame's `worldRingRadius`, which follows the drag) as a soft glow
 * under a bright line on the world plane, the slot flash, and the D-18
 * reticle locked (still) on the held body. Returns whether anything drew.
 */
export function drawReorderHold(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  drag: ReorderDrag | null,
  hold: ReorderHoldFx | null,
  spec: OverlaySpec,
  effect: SkRuntimeEffect | null,
  bands: RingBands | null,
  aaDp: number,
): boolean {
  "worklet";
  if (!drag) return false;
  const body = frameBodyById(frame, drag.id);
  if (!body) return false;
  const fx = hold ?? NO_HOLD_FX;
  const ink = spec.ink.instrument;
  const additive = spec.additive === true;
  if (!drag.active) {
    if (body.culled || !body.visible) return false;
    const r = holdRingRadius(body.radius);
    canvas.drawCircle(
      body.x,
      body.y,
      r,
      holdPaint(ink, HOLD_CHARGE_TRACK_ALPHA, HOLD_CHARGE_DP, false),
    );
    const sweep = Number.isFinite(fx.charge)
      ? Math.max(0, Math.min(1, fx.charge))
      : 0;
    if (sweep > 0) {
      const arc = Skia.Path.Make();
      arc.addArc(
        Skia.XYWHRect(body.x - r, body.y - r, r * 2, r * 2),
        -90,
        360 * sweep,
      );
      canvas.drawPath(
        arc,
        holdPaint(ink, HOLD_CHARGE_ARC_ALPHA, HOLD_CHARGE_DP, additive),
      );
    }
    return true;
  }
  let drawn = false;
  const radius = body.worldRingRadius;
  if (radius > 0) {
    drawn = drawHeldRing(
      canvas,
      frame,
      radius,
      HELD_GLOW_DP,
      HELD_GLOW_ALPHA,
      ink,
      additive,
      effect,
      bands,
      aaDp,
    );
    if (drawn) {
      drawHeldRing(
        canvas,
        frame,
        radius,
        HELD_LINE_DP,
        HELD_LINE_ALPHA,
        ink,
        false,
        effect,
        bands,
        aaDp,
      );
      const flash = slotFlashLook(fx.flash, fx.reduced);
      if (flash)
        drawHeldRing(
          canvas,
          frame,
          radius,
          flash.widthDp,
          flash.alpha,
          ink,
          additive,
          effect,
          bands,
          aaDp,
        );
    }
  }
  if (!body.culled && body.visible)
    drawn =
      drawReticle(
        canvas,
        body.x,
        body.y,
        body.radius,
        RETICLE_LOCK_END,
        spec.ink.reticle,
        1,
      ) || drawn;
  return drawn;
}

/**
 * D-55: inside each Orrery text surface's rect, a fill of the occlusion ink at
 * the theme's proven `ORRERY_OCCLUSION_DIM` (`spec.occlusionDim`, clamped to
 * the D-62 ceiling `ORRERY_OCCLUSION_DIM_MAX`), so whatever the canvas drew
 * under it (sky, rings, bodies, initials, photos, the reticle) is dimmed; the
 * RN card glass above it is never touched. Returns the number of rects drawn.
 */
export function drawOcclusion(
  canvas: SkCanvas,
  rects: readonly CameraRect[],
  spec: OverlaySpec,
): number {
  "worklet";
  let drawn = 0;
  const dim = Number.isFinite(spec.occlusionDim)
    ? Math.max(0, Math.min(ORRERY_OCCLUSION_DIM_MAX, spec.occlusionDim))
    : 0;
  if (!(dim > 0)) return 0;
  const paint = inkPaint(spec.ink.occlusion, dim);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (
      !(r.width > 0) ||
      !(r.height > 0) ||
      !Number.isFinite(r.x) ||
      !Number.isFinite(r.y)
    )
      continue;
    canvas.drawRRect(
      Skia.RRectXY(
        Skia.XYWHRect(r.x, r.y, r.width, r.height),
        OCCLUSION_RADIUS,
        OCCLUSION_RADIUS,
      ),
      paint,
    );
    drawn++;
  }
  return drawn;
}

/**
 * The whole overlay picture: Polaris, the reorder hold, the focus reticle,
 * then the occlusion dim over everything under the text surfaces.
 */
export function drawOverlay(
  canvas: SkCanvas,
  frame: AnimatedFrame,
  spec: OverlaySpec,
  drag: ReorderDrag | null,
  hold: ReorderHoldFx | null,
  effect: SkRuntimeEffect | null,
  bands: RingBands | null,
  aaDp: number,
  focus: FocusDraw | null,
  occlusion: readonly CameraRect[],
): void {
  "worklet";
  drawPolaris(canvas, frame, spec);
  drawReorderHold(canvas, frame, drag, hold, spec, effect, bands, aaDp);
  drawFocusReticle(canvas, frame, spec, focus);
  drawOcclusion(canvas, occlusion, spec);
}
