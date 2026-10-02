/**
 * ORRERY LAB B — WP-2.2 focus state and interaction feedback (L7).
 *
 * Architecture (research/SWITCH-STALL-INVESTIGATION.md): no per-body
 * components and no per-body SharedValues. Each layer is ONE UI-thread
 * picture recorded from ONE derived value; the worklets capture only shared
 * values and small, identity-stable data (colour vectors, scalars).
 *
 * - `useLabFocusState` (owned by `LabBRenderer`): `mix`, `keys`, `lock` and
 *   the feedback timers. `mix` / `keys` change ONLY in an effect keyed on the
 *   focus identity (a `withTiming`); `lock` follows the camera's recovery
 *   (`camera.active`) through one reaction; tap / reorder timers start from
 *   reactions on the model half's stamps. Nothing reads the ambient clock, so
 *   at rest none of these layers re-records.
 * - `LabFocusPicture`: the target-lock reticle on every focused body (cluster:
 *   a reticle per member + a thin hull ring; satellite: a small reticle),
 *   drawn between the bodies and the labels.
 * - `LabFeedbackPicture`: tap pings (body edge), empty-space ripples (a
 *   projected ellipse on the world plane), the Polaris north flare, and the
 *   reorder hold language (hold charge arc, held-ring glow, slot flash and a
 *   reticle on the held body — it replaces the legacy accent ghost path).
 *
 * Reduced motion: the reticle is locked immediately (no seek / snap / flash),
 * the world response is instant, feedback is a ≤150 ms opacity highlight with
 * no growth (labb-focus-logic.ts).
 *
 * Hermes rule: worklet helpers are declared ABOVE their callers.
 */
import {
  BlendMode,
  Picture,
  type SkCanvas,
  Skia,
  type SkPicture,
} from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import {
  Easing,
  runOnUI,
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import {
  tryUnprojectToWorldPlane,
  usableCameraRect,
} from "@/logic/orrery-camera-logic";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import { HOLD_MS } from "@/logic/orrery-gesture-logic";
import {
  type MotionRequest,
  polarisProjection,
} from "@/logic/orrery-recovery-logic";
import type { ReorderDrag } from "@/logic/orrery-reorder-logic";
import type { LabTapStamp } from "./LabBRenderer";
import { type LabFocusContext, useLabStillContext } from "./labb-context";
import {
  bracketRadius,
  FOCUS_MIX_MS,
  FOCUS_RELEASE_MS,
  hullCircle,
  LOCK_DELAY_MS,
  LOCK_MS,
  northFlare,
  PING_MS,
  pingRings,
  pingTarget,
  RM_FLASH_MS,
  reorderSlot,
  reticleSegments,
  reticleState,
  rippleRings,
  SLOT_FLASH_MS,
  seekAmount,
  slotFlash,
} from "./labb-focus-logic";
import { bodyAt, type FrameIndex } from "./labb-frame-index";
import { strokePlaneCircleAuto } from "./labb-plane-draw";
import { planeHomography } from "./labb-rings-logic";

// --- Tunables -----------------------------------------------------------------
const PICTURE_BOUNDS = 1e5;
/** Reticle stroke (dp), its soft under-glow (dp) and glow alpha. */
const RETICLE_DP = 1.5;
const RETICLE_GLOW_DP = 5;
const RETICLE_GLOW_ALPHA = 0.22;
/** Faint outer range circle of a locked reticle (× R) and its alpha. */
const RANGE_SCALE = 1.55;
const RANGE_ALPHA = 0.22;
const RANGE_DASH = [2, 5];
/** Satellites get a smaller reticle (× bracket radius). */
const SATELLITE_RETICLE = 0.8;
/** Cluster hull ring alpha. */
const HULL_ALPHA = 0.4;
/** Reorder: held-ring glow / line widths (dp) and alphas; charge arc. */
const HELD_GLOW_DP = 7;
const HELD_GLOW_ALPHA = 0.18;
const HELD_LINE_DP = 1.6;
const HELD_LINE_ALPHA = 0.9;
const CHARGE_DP = 2;
const CHARGE_TRACK_ALPHA = 0.22;
const STROKE = 1;
const ROUND_CAP = 1;

// --- State ----------------------------------------------------------------------

/** A tap being fed back: where, what kind, which body (if any). */
interface FeedbackTap {
  seq: number;
  x: number;
  y: number;
  kind: string;
  key: string | null;
  /** World point on the plane (empty-space ripple), or null. */
  wx: number;
  wy: number;
  world: boolean;
}

export interface LabFeedbackState {
  tap: SharedValue<FeedbackTap | null>;
  tapT: SharedValue<number>;
  holdT: SharedValue<number>;
  slotT: SharedValue<number>;
}

/**
 * Focus + feedback shared values. `focusKeys` / `focusSig` are React data (the
 * focused body keys and their joined identity); the effect below is the ONLY
 * writer of `mix` and `keys`.
 */
export function useLabFocusState({
  focusKeys,
  focusSig,
  cameraActive,
  reducedMotion,
  frame,
  fxTap,
  reorder,
}: {
  focusKeys: readonly string[];
  focusSig: string;
  cameraActive: SharedValue<MotionRequest | null> | null;
  reducedMotion: SharedValue<boolean>;
  frame: SharedValue<AnimatedFrame>;
  fxTap: SharedValue<LabTapStamp | null>;
  reorder: SharedValue<ReorderDrag | null>;
}): { focus: LabFocusContext; feedback: LabFeedbackState } {
  const mix = useSharedValue(0);
  const keys = useSharedValue<string[]>([]);
  const lock = useSharedValue(1);
  const seq = useSharedValue(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on focus identity (focusSig) only
  useEffect(() => {
    const next = [...focusKeys];
    const on = next.length > 0;
    runOnUI(() => {
      "worklet";
      const reduced = reducedMotion.value;
      if (on) {
        keys.value = next;
        seq.value = seq.value + 1;
      }
      const target = on ? 1 : 0;
      mix.value = reduced
        ? target
        : withTiming(target, {
            duration: on ? FOCUS_MIX_MS : FOCUS_RELEASE_MS,
            easing: Easing.out(Easing.cubic),
          });
    })();
  }, [focusSig]);
  // Lock follows the camera: a new focus starts "seeking" (0) and locks once
  // the recovery fly-in (if any) has settled.
  useAnimatedReaction(
    () => ({
      seq: seq.value,
      idle: cameraActive ? cameraActive.value === null : true,
      reduced: reducedMotion.value,
    }),
    (cur, prev) => {
      if (cur.reduced) {
        lock.value = 1;
        return;
      }
      const lockNow = (delay: number) => {
        "worklet";
        lock.value = withDelay(
          delay,
          withTiming(1, { duration: LOCK_MS, easing: Easing.linear }),
        );
      };
      if (!prev || cur.seq !== prev.seq) {
        if (cur.seq === 0) return;
        lock.value = 0;
        if (cur.idle) lockNow(LOCK_DELAY_MS);
        return;
      }
      if (!cur.idle && prev.idle && lock.value < 1) lock.value = 0;
      else if (cur.idle && !prev.idle && lock.value < 1) lockNow(0);
    },
  );

  // --- Feedback timers -------------------------------------------------------
  const tap = useSharedValue<FeedbackTap | null>(null);
  const tapT = useSharedValue(1);
  const holdT = useSharedValue(0);
  const slotT = useSharedValue(1);
  useAnimatedReaction(
    () => fxTap.value,
    (stamp, prev) => {
      if (!stamp || (prev && stamp.seq === prev.seq)) return;
      if (stamp.kind === "none") return;
      const f = frame.value;
      const key =
        stamp.kind === "north" || stamp.kind === "clear"
          ? null
          : pingTarget(f.bodies, stamp.x, stamp.y);
      const w =
        key === null && stamp.kind === "clear"
          ? tryUnprojectToWorldPlane(
              { x: stamp.x, y: stamp.y },
              f.pose,
              f.viewport,
            )
          : null;
      tap.value = {
        seq: stamp.seq,
        x: stamp.x,
        y: stamp.y,
        kind: stamp.kind,
        key,
        wx: w ? w.x : 0,
        wy: w ? w.y : 0,
        world: !!w,
      };
      const reduced = reducedMotion.value;
      tapT.value = 0;
      tapT.value = withTiming(1, {
        duration: reduced ? RM_FLASH_MS : PING_MS,
        easing: Easing.linear,
      });
    },
  );
  useAnimatedReaction(
    () => {
      const d = reorder.value;
      return d
        ? { held: true, active: d.active, slot: reorderSlot(d) }
        : { held: false, active: false, slot: -1 };
    },
    (cur, prev) => {
      const reduced = reducedMotion.value;
      if (!cur.held) {
        holdT.value = 0;
        return;
      }
      if (!prev?.held) {
        holdT.value = 0;
        holdT.value = reduced
          ? 1
          : withTiming(1, { duration: HOLD_MS, easing: Easing.linear });
      }
      if (cur.active && (!prev?.active || prev.slot !== cur.slot)) {
        holdT.value = 1;
        slotT.value = 0;
        slotT.value = withTiming(1, {
          duration: reduced ? RM_FLASH_MS : SLOT_FLASH_MS,
          easing: Easing.linear,
        });
      }
    },
  );
  const focus = useMemo(() => ({ mix, keys, lock }), [mix, keys, lock]);
  const feedback = useMemo(
    () => ({ tap, tapT, holdT, slotT }),
    [tap, tapT, holdT, slotT],
  );
  return { focus, feedback };
}

// --- Worklet draw helpers -------------------------------------------------------

function strokePaint(
  rgba: readonly number[],
  alpha: number,
  widthDp: number,
  additive: boolean,
) {
  "worklet";
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setStyle(STROKE);
  p.setStrokeWidth(widthDp);
  p.setStrokeCap(ROUND_CAP);
  p.setColor(Float32Array.of(rgba[0], rgba[1], rgba[2], rgba[3] * alpha));
  if (additive) p.setBlendMode(BlendMode.Plus);
  return p;
}

function drawReticle(
  canvas: SkCanvas,
  x: number,
  y: number,
  R: number,
  rot: number,
  alpha: number,
  rgba: readonly number[],
  additive: boolean,
  range: number,
): void {
  "worklet";
  const seg = reticleSegments(x, y, R, rot);
  const glow = strokePaint(
    rgba,
    alpha * RETICLE_GLOW_ALPHA,
    RETICLE_GLOW_DP,
    additive,
  );
  const line = strokePaint(rgba, alpha, RETICLE_DP, false);
  for (let i = 0; i < seg.length; i += 4)
    canvas.drawLine(seg[i], seg[i + 1], seg[i + 2], seg[i + 3], glow);
  for (let i = 0; i < seg.length; i += 4)
    canvas.drawLine(seg[i], seg[i + 1], seg[i + 2], seg[i + 3], line);
  if (range > 0) {
    const ring = strokePaint(rgba, alpha * RANGE_ALPHA * range, 1, false);
    ring.setPathEffect(Skia.PathEffect.MakeDash(RANGE_DASH, 0));
    canvas.drawCircle(x, y, R * RANGE_SCALE, ring);
  }
}

function beginPicture() {
  "worklet";
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(
    Skia.XYWHRect(
      -PICTURE_BOUNDS,
      -PICTURE_BOUNDS,
      PICTURE_BOUNDS * 2,
      PICTURE_BOUNDS * 2,
    ),
  );
  return { recorder, canvas };
}

// --- Focus reticle layer ----------------------------------------------------------

export function LabFocusPicture({
  frame,
  frameIndex,
  accent,
  additive,
}: {
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  /** RGBA of the instrument (accent) token. */
  accent: readonly number[];
  additive: boolean;
}) {
  const ctx = useLabStillContext();
  const focus = ctx?.focus ?? null;
  const fxFlags = ctx?.fxFlags;
  const reducedMotion = ctx?.reducedMotion;
  const picture = useDerivedValue<SkPicture>(() => {
    const { recorder, canvas } = beginPicture();
    const fx = fxFlags ? fxFlags.value : null;
    const on = !!fx && fx.flags.fx && fx.flags.fxFocus;
    if (!focus || !on) return recorder.finishRecordingAsPicture();
    const mix = focus.mix.value;
    const keys = focus.keys.value;
    if (!(mix > 0.002) || keys.length === 0)
      return recorder.finishRecordingAsPicture();
    const lock = focus.lock.value;
    const reduced = reducedMotion ? reducedMotion.value : false;
    const f = frame.value;
    const index = frameIndex.value;
    const rect = usableCameraRect(f.viewport);
    const cx = rect ? rect.x + rect.width / 2 : f.viewport.width / 2;
    const cy = rect ? rect.y + rect.height / 2 : f.viewport.height / 2;
    const half = rect
      ? Math.min(rect.width, rect.height) / 2
      : Math.min(f.viewport.width, f.viewport.height) / 2;
    const hull: { x: number; y: number; r: number }[] = [];
    for (let k = 0; k < keys.length; k++) {
      const b = bodyAt(f, index, keys[k]);
      if (!b?.visible || !(b.opacity > 0.01)) continue;
      const st = reticleState(
        lock,
        seekAmount(b.x, b.y, cx, cy, half),
        reduced,
      );
      const base =
        bracketRadius(b.radius) *
        (b.kind === "satellite" ? SATELLITE_RETICLE : 1);
      const alpha = st.alpha * mix * b.opacity;
      drawReticle(
        canvas,
        b.x,
        b.y,
        base * st.scale,
        st.rot,
        alpha,
        accent,
        additive,
        keys.length === 1 ? Math.max(0, lock * 2 - 1) : 0,
      );
      if (st.flashAlpha > 0)
        canvas.drawCircle(
          b.x,
          b.y,
          base * st.flashScale,
          strokePaint(accent, st.flashAlpha * mix, 1.2, additive),
        );
      hull.push({ x: b.x, y: b.y, r: b.radius });
    }
    if (hull.length > 1) {
      const h = hullCircle(hull);
      if (h) {
        const ring = strokePaint(accent, HULL_ALPHA * mix, 1, false);
        ring.setPathEffect(Skia.PathEffect.MakeDash(RANGE_DASH, 0));
        canvas.drawCircle(h.x, h.y, h.r, ring);
      }
    }
    return recorder.finishRecordingAsPicture();
  });
  return <Picture picture={picture} />;
}

// --- Feedback layer ---------------------------------------------------------------

export function LabFeedbackPicture({
  frame,
  frameIndex,
  feedback,
  reorder,
  extent,
  accent,
  additive,
}: {
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  feedback: LabFeedbackState;
  reorder: SharedValue<ReorderDrag | null>;
  extent: number;
  accent: readonly number[];
  additive: boolean;
}) {
  const ctx = useLabStillContext();
  const fxFlags = ctx?.fxFlags;
  const reducedMotion = ctx?.reducedMotion;
  const { tap, tapT, holdT, slotT } = feedback;
  const picture = useDerivedValue<SkPicture>(() => {
    const { recorder, canvas } = beginPicture();
    const fx = fxFlags ? fxFlags.value : null;
    const flags = fx ? fx.flags : null;
    if (!flags?.fx) return recorder.finishRecordingAsPicture();
    const reduced = reducedMotion ? reducedMotion.value : false;
    const u = tapT.value;
    const t = tap.value;
    const drag = reorder.value;
    const tapLive = flags.fxFeedback && t !== null && u < 1;
    const holdLive = flags.fxReorder && drag !== null;
    if (!tapLive && !holdLive) return recorder.finishRecordingAsPicture();
    const f = frame.value;
    const index = frameIndex.value;
    const zoom = f.pose.zoom > 0 ? f.pose.zoom : 1;
    if (tapLive && t) {
      if (t.kind === "north") {
        const flare = northFlare(u, reduced);
        if (flare) {
          const p = polarisProjection(f, extent);
          const line = strokePaint(accent, flare.alpha, 1.2, additive);
          const s = flare.spike;
          canvas.drawLine(p.x - s, p.y, p.x + s, p.y, line);
          canvas.drawLine(p.x, p.y - s, p.x, p.y + s, line);
          canvas.drawCircle(
            p.x,
            p.y,
            flare.ring,
            strokePaint(accent, flare.alpha * 0.8, 1, additive),
          );
        }
      } else if (t.key !== null) {
        const b = bodyAt(f, index, t.key);
        if (b?.visible) {
          const rings = pingRings(u, reduced);
          for (let i = 0; i < rings.length; i++)
            canvas.drawCircle(
              b.x,
              b.y,
              b.radius + 2 + rings[i].grow,
              strokePaint(accent, rings[i].alpha, 1.3, additive),
            );
        }
      } else {
        const rings = rippleRings(u, reduced);
        const m = t.world ? planeHomography(f.pose, f.viewport) : null;
        if (m) {
          // Tilt fix: projected ellipses in screen space, 1.2-dp screen
          // stroke (no stroked circle under the perspective CTM).
          const path = Skia.Path.Make();
          for (let i = 0; i < rings.length; i++)
            strokePlaneCircleAuto(
              canvas,
              path,
              m,
              t.wx,
              t.wy,
              rings[i].grow / zoom,
              1.2,
              strokePaint(accent, rings[i].alpha, 1.2, additive),
              f.viewport.width,
              f.viewport.height,
            );
        } else
          for (let i = 0; i < rings.length; i++)
            canvas.drawCircle(
              t.x,
              t.y,
              rings[i].grow,
              strokePaint(accent, rings[i].alpha, 1.2, additive),
            );
      }
    }
    if (holdLive && drag) {
      const b = bodyAt(f, index, `contact:${drag.id}`);
      if (b?.visible) {
        const R = bracketRadius(b.radius);
        if (!drag.active) {
          // Hold charge: a track ring + an arc filling over HOLD_MS.
          const h = holdT.value;
          canvas.drawCircle(
            b.x,
            b.y,
            R,
            strokePaint(accent, CHARGE_TRACK_ALPHA, CHARGE_DP, false),
          );
          if (h > 0) {
            const arc = Skia.Path.Make();
            arc.addArc(
              Skia.XYWHRect(b.x - R, b.y - R, R * 2, R * 2),
              -90,
              360 * Math.min(1, h),
            );
            canvas.drawPath(arc, strokePaint(accent, 0.9, CHARGE_DP, additive));
          }
        } else {
          // Held: the body's ring glows on the plane (= the candidate slot),
          // flashes on each slot change; a locked reticle rides the body.
          const m = planeHomography(f.pose, f.viewport);
          const rw = b.ringRadius / zoom;
          if (m && rw > 0) {
            // Tilt fix: screen-space projected ring (wide glow = oval op).
            const path = Skia.Path.Make();
            const vw = f.viewport.width;
            const vh = f.viewport.height;
            strokePlaneCircleAuto(
              canvas,
              path,
              m,
              0,
              0,
              rw,
              HELD_GLOW_DP,
              strokePaint(accent, HELD_GLOW_ALPHA, HELD_GLOW_DP, additive),
              vw,
              vh,
            );
            strokePlaneCircleAuto(
              canvas,
              path,
              m,
              0,
              0,
              rw,
              HELD_LINE_DP,
              strokePaint(accent, HELD_LINE_ALPHA, HELD_LINE_DP, false),
              vw,
              vh,
            );
            const flash = slotFlash(slotT.value, reduced);
            if (flash)
              strokePlaneCircleAuto(
                canvas,
                path,
                m,
                0,
                0,
                rw,
                flash.widthDp,
                strokePaint(accent, flash.alpha, flash.widthDp, additive),
                vw,
                vh,
              );
          }
          drawReticle(canvas, b.x, b.y, R, 0, 1, accent, additive, 0);
        }
      }
    }
    return recorder.finishRecordingAsPicture();
  });
  return <Picture picture={picture} />;
}
