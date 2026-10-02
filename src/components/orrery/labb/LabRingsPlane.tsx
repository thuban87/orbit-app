/**
 * ORRERY LAB B — tilt fix: the L1 instrument orbits drawn WITHOUT a
 * perspective matrix (flag `ringPlaneDraw`, default ON; research/
 * PHONE-PASS-RESULTS.md "Tilt fix").
 *
 * The phone pass found that every stroked world circle drawn under the 3×3
 * plane homography (rings, wakes, trims, focus glow / lock) is a Mali-G78 GPU
 * cliff: Ganesh has no analytic op for a stroked oval under perspective. Here
 * the SAME layers record in SCREEN space:
 *   - geometry: each plane circle is its exact projected ellipse
 *     (`labb-plane-ellipse.ts`), drawn either as the circle path mapped
 *     through the homography (`SkPath.transform` maps the conic segments
 *     exactly; stroked under an affine CTM, so Ganesh's convex-path stroker
 *     draws only the band) or — flag `ringOvalOp`, A/B — as an analytic oval
 *     under translate · rotate (Ganesh's ellipse op; its quad covers the whole
 *     bounding box). On an untilted plane (no perspective row) it is a plain
 *     `drawCircle` (Ganesh's circle op, as before the fix);
 *   - shading: the ring shaders (`ringInstrument`, `ringWake`, the trim sweep
 *     gradient) are unchanged and still evaluate in WORLD plane coordinates:
 *     the homography becomes the shader's LOCAL matrix (a per-fragment divide)
 *     instead of the geometry's CTM;
 *   - stroke widths are now SCREEN dp (constant around the ring) where they
 *     used to be world widths foreshortened by the perspective (≈ ±15 % at
 *     the Home tilt, C-74). Dash spacing still follows the world arc length ×
 *     zoom (the shader is unchanged), so it is as perspective-correct as
 *     before.
 * Culling uses the exact projected ellipse (`ellipseOnScreen`).
 *
 * Hit-testing, labels, allocations and focus framing never read these draws
 * (they use the projected FRAME), so they are unchanged.
 *
 * Hermes rule: worklet helpers are declared ABOVE their callers.
 */
import { Picture, Skia, type SkPicture } from "@shopify/react-native-skia";
import { useMemo } from "react";
import type { SharedValue } from "react-native-reanimated";
import { useDerivedValue } from "react-native-reanimated";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import type { SemanticLevel } from "@/logic/orrery-label-logic";
import { sampleSwitchEntry } from "@/logic/orrery-switch-choreography";
import type { LabRingProfile } from "@/theme/orrery-lab-fx";
import type { LabRingEntry } from "./LabRings";
import { useLabStillContext } from "./labb-context";
import { getLabEffect, LAB_EFFECT_SOURCES } from "./labb-effects";
import { focusDimFactor } from "./labb-focus-logic";
import { bodyAt, type FrameIndex } from "./labb-frame-index";
import { flattenUniforms, uniformOrder } from "./labb-layer-plan";
import { probeEnd, probeStart } from "./labb-perf-probe";
import {
  OVAL_MIN_STROKE_DP,
  strokeOval,
  strokePlaneCircle,
} from "./labb-plane-draw";
import {
  ellipseOnScreen,
  hasPerspective,
  ovalCtm,
  ovalLocalMatrix,
  planeInverseRows,
  projectedCircleEllipse,
} from "./labb-plane-ellipse";
import {
  applyHomography,
  planeHomography,
  ringDensityFade,
  ringUniforms,
  wakeAngle,
} from "./labb-rings-logic";
import {
  classRingSwitchFade,
  switchFxLive,
  trimRingState,
} from "./labb-switch-logic";
import { tokenToVec4 } from "./labb-uniforms";

// --- Tunables -----------------------------------------------------------------
/** Shader mode of `ringInstrument` (arc-dashed ring). */
const MODE_RING = 0;
/** Fallback dash intervals (screen dp) when the ring shader is unavailable. */
const FALLBACK_DASH = [5, 5];
/** Wake stroke = visible width × this (the shader fades the cross profile). */
const WAKE_STROKE_SCALE = 1.6;
/** Trim rings are slightly heavier than the class hairline (they carry motion). */
const TRIM_WIDTH_SCALE = 1.35;
/** Tail alpha of a trim ring relative to its head (at the body). */
const TRIM_TAIL = 0.3;
const RAD_TO_DEG = 180 / Math.PI;
/** Recording bounds (screen dp) — larger than any visible ring. */
const BOUNDS = 1e5;
/** Floats per wake in the flat uniform block (uColor, uWake, uCam). */
const WAKE_FLOATS = 12;
const RING_ORDER = uniformOrder(LAB_EFFECT_SOURCES.ringInstrument);
const NO_FOCUS_KEYS: string[] = [];
const NO_SEGS: number[] = [];

// --- Worklet helpers (declared ABOVE their callers) ----------------------------

/** Shared empty picture (identical value → no canvas notification). */
function emptyPlanePicture(): SkPicture {
  "worklet";
  const g = globalThis as unknown as { __labbEmptyPicture?: SkPicture };
  if (!g.__labbEmptyPicture) {
    const recorder = Skia.PictureRecorder();
    recorder.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
    g.__labbEmptyPicture = recorder.finishRecordingAsPicture();
  }
  return g.__labbEmptyPicture;
}

function beginScreenPicture() {
  "worklet";
  const recorder = Skia.PictureRecorder();
  const canvas = recorder.beginRecording(
    Skia.XYWHRect(-BOUNDS, -BOUNDS, BOUNDS * 2, BOUNDS * 2),
  );
  return { recorder, canvas };
}

// --- Class rings ------------------------------------------------------------------

export interface PlaneRingClassSpec {
  color: number[];
  widthDp: number;
  dashPeriod: number;
  dashDuty: number;
  alpha: number;
  keys: string[];
  dims: number[];
  trimmed: boolean[];
}

/**
 * Every class ring as ONE screen-space picture (same uniforms, alpha rule,
 * class order and culling contract as `RingClassesPicture`; see the module
 * comment for what changed).
 */
export function PlaneRingClassesPicture({
  classes,
  frame,
  frameIndex,
  cam,
  flow,
  profile,
  highlight,
  shader,
  ringGap,
  anyFocus,
  trimKeys,
  sunLight,
  oval,
  inv,
}: {
  classes: readonly (readonly LabRingEntry[])[];
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  cam: SharedValue<number[]>;
  flow: SharedValue<number[]>;
  profile: LabRingProfile;
  highlight: number[];
  shader: boolean;
  ringGap: number;
  anyFocus: boolean;
  trimKeys: ReadonlySet<string>;
  sunLight: readonly number[];
  /** A/B (flag `ringOvalOp`): analytic ovals instead of projected paths. */
  oval: boolean;
  /** A/B (flag `ringShaderInv`): `…Inv` shader (in-shader inverse
   * homography on screen coords) instead of a perspective local matrix. */
  inv: boolean;
}) {
  const ctx = useLabStillContext();
  const fxFlags = ctx?.fxFlags;
  const reducedMotion = ctx?.reducedMotion;
  const signal = ctx?.sw?.signal;
  const roles = ctx?.sw?.roles;
  const focus = ctx?.focus ?? null;
  const focusDim = profile.focusDim;
  const effect = shader
    ? getLabEffect(inv ? "ringInstrumentInv" : "ringInstrument")
    : null;
  const specs = useMemo<PlaneRingClassSpec[]>(
    () =>
      classes.map((group) => {
        const cls = group[0].cls;
        return {
          color: tokenToVec4(cls.color),
          widthDp: cls.widthDp,
          dashPeriod: cls.dashPeriod,
          dashDuty: cls.dashDuty,
          alpha: profile.alpha * cls.alpha,
          keys: group.map((e) => e.key),
          dims: group.map((e) =>
            anyFocus && !e.focused ? profile.focusDim : 1,
          ),
          trimmed: group.map((e) => trimKeys.has(e.key)),
        };
      }),
    [classes, profile, anyFocus, trimKeys],
  );
  const farAlpha = profile.farAlpha;
  const flowK = profile.flow;
  const picture = useDerivedValue(() => {
    const probe = probeStart();
    const f = frame.value;
    const index = frameIndex.value;
    const zoom = f.pose.zoom;
    const m = planeHomography(f.pose, f.viewport);
    if (!m || !(zoom > 0)) {
      probeEnd("rings", probe);
      return emptyPlanePicture();
    }
    const persp = hasPerspective(m);
    const lm = Skia.Matrix(m as number[]);
    const w = f.viewport.width;
    const h = f.viewport.height;
    const c = cam.value;
    const fl = flow.value;
    const fx = fxFlags ? fxFlags.value : null;
    const sig = signal ? signal.value : null;
    const live =
      !!fx &&
      fx.flags.fx &&
      fx.flags.fxRingTrim &&
      switchFxLive(sig, reducedMotion ? reducedMotion.value : false);
    const roleMap = roles ? roles.value : null;
    const fon = !!focus && !!fx && fx.flags.fx && fx.flags.fxFocusDim;
    const fmix = fon && focus ? focus.mix.value : 0;
    const fkeys = fon && focus ? focus.keys.value : NO_FOCUS_KEYS;
    const { recorder, canvas } = beginScreenPicture();
    const path = Skia.Path.Make();
    if (!persp) {
      canvas.save();
      canvas.concat(m as number[]);
    }
    for (let k = 0; k < specs.length; k++) {
      const spec = specs[k];
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setStyle(1);
      // Untilted: the pre-fix draw exactly (world circle under the AFFINE
      // homography, world stroke, no shader local matrix — Ganesh's circle op).
      paint.setStrokeWidth(persp ? spec.widthDp : spec.widthDp / zoom);
      // Bevel joins: the convex-path stroker refuses round joins, and a smooth
      // closed curve has no visible joins.
      paint.setStrokeJoin(2);
      paint.setColor(
        Float32Array.of(spec.color[0], spec.color[1], spec.color[2], 1),
      );
      let base = spec.color[3];
      let flat: number[] | null = null;
      if (effect) {
        const fade = ringDensityFade(ringGap, c[3]);
        const u = ringUniforms(spec.color, highlight, c, fl, {
          mode: MODE_RING,
          alpha: spec.alpha * fade,
          dashPeriod: spec.dashPeriod,
          dashDuty: spec.dashDuty,
          farAlpha,
          flowStrength: flowK * fade * fade,
          flowOn: true,
          sunLight: fx?.flags.ringSunLight ? sunLight : undefined,
        });
        flat = flattenUniforms(u, RING_ORDER);
        if (!persp) paint.setShader(effect.makeShader(flat));
        else if (inv) {
          flat = flat.concat(planeInverseRows(m));
          paint.setShader(effect.makeShader(flat));
        } else paint.setShader(effect.makeShader(flat, lm));
      } else {
        base *= spec.alpha;
        if (spec.dashPeriod > 0)
          paint.setPathEffect(Skia.PathEffect.MakeDash(FALLBACK_DASH, 0));
      }
      const pad = spec.widthDp / 2 + 1;
      for (let i = 0; i < spec.keys.length; i++) {
        const b = bodyAt(f, index, spec.keys[i]);
        if (!b) continue;
        const r = b.ringRadius / zoom;
        if (!(r > 0)) continue;
        let op =
          b.opacity *
          (fon
            ? focusDimFactor(fkeys, spec.keys[i], fmix, focusDim)
            : spec.dims[i]);
        if (spec.trimmed[i] && signal)
          op *= classRingSwitchFade(roleMap, spec.keys[i], sig, live);
        if (!(op > 0)) continue;
        const e = projectedCircleEllipse(m, 0, 0, r);
        if (!e || !ellipseOnScreen(e, pad, w, h)) continue;
        paint.setAlphaf(Math.min(1, base * op));
        if (oval && persp) {
          if (effect && flat)
            paint.setShader(
              inv
                ? effect.makeShader(
                    flat
                      .slice(0, flat.length - 9)
                      .concat(planeInverseRows(m, ovalCtm(e))),
                  )
                : effect.makeShader(flat, Skia.Matrix(ovalLocalMatrix(e, m))),
            );
          strokeOval(canvas, e, paint);
        } else if (!persp) canvas.drawCircle(0, 0, r, paint);
        else strokePlaneCircle(canvas, path, m, e, 0, 0, r, paint);
      }
    }
    if (!persp) canvas.restore();
    const ringsPicture = recorder.finishRecordingAsPicture();
    probeEnd("rings", probe);
    return ringsPicture;
  });
  return <Picture picture={picture} />;
}

// --- Progress wakes --------------------------------------------------------------

/**
 * Progress wakes, ONE screen-space picture, one `ringWake` shader per ring
 * (uniform layout and gates as `WakesPicture`: hidden while the camera
 * recovers, LOD'd away above 160 rings by the caller). The shader still sees
 * world coordinates (homography = local matrix), so the arc, the brightening
 * toward the body and the far-side fade are unchanged.
 */
export function PlaneWakesPicture({
  classes,
  frame,
  cam,
  profile,
  settled,
  moving,
  oval,
  inv,
}: {
  classes: readonly (readonly LabRingEntry[])[];
  frame: SharedValue<AnimatedFrame>;
  cam: SharedValue<number[]>;
  profile: LabRingProfile;
  settled: SharedValue<number>;
  moving: SharedValue<number>;
  oval: boolean;
  inv: boolean;
}) {
  const effect = getLabEffect(inv ? "ringWakeInv" : "ringWake");
  const block = useMemo(() => {
    const out: number[] = [];
    let n = 0;
    for (const group of classes) {
      if (!group[0].cls.wake) continue;
      for (const e of group) {
        const angle = wakeAngle(e.x, e.y);
        if (!(angle > 1e-3)) continue;
        const c = tokenToVec4(e.cls.color);
        out.push(
          c[0],
          c[1],
          c[2],
          profile.wakeAlpha * e.cls.alpha,
          angle,
          e.ringRadius,
          0, // half width (world) — per frame
          profile.farAlpha,
          0, // cam cos yaw — per frame
          0, // cam sin yaw
          0, // cam tilt depth
          0,
        );
        n += 1;
      }
    }
    return { floats: out, count: n };
  }, [classes, profile.wakeAlpha, profile.farAlpha]);
  const floats = block.floats;
  const count = block.count;
  const widthDp = profile.wakeWidthDp;
  const picture = useDerivedValue(() => {
    const probe = probeStart();
    const op = settled.value;
    const f = frame.value;
    const m =
      effect && count > 0 && op > 0 && !(moving.value > 0)
        ? planeHomography(f.pose, f.viewport)
        : null;
    if (!effect || !m) {
      probeEnd("wakes", probe);
      return emptyPlanePicture();
    }
    const persp = hasPerspective(m);
    const lm = Skia.Matrix(m as number[]);
    const { recorder, canvas } = beginScreenPicture();
    const c = cam.value;
    const zoom = Math.max(c[3], 1e-4);
    const half = widthDp / 2 / zoom;
    const stroke = widthDp * WAKE_STROKE_SCALE;
    const pad = stroke / 2 + 1;
    const w = f.viewport.width;
    const h = f.viewport.height;
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(1);
    paint.setStrokeWidth(stroke);
    paint.setAlphaf(Math.min(1, op));
    const path = Skia.Path.Make();
    // ringWakeInv appends the 9 inverse-homography floats (uInv0..2).
    const u: number[] = inv
      ? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const rows = inv ? planeInverseRows(m) : null;
    for (let i = 0; i < count; i++) {
      const o = i * WAKE_FLOATS;
      const R = floats[o + 5];
      const e = projectedCircleEllipse(m, 0, 0, R);
      if (!e || !ellipseOnScreen(e, pad, w, h)) continue;
      for (let k = 0; k < WAKE_FLOATS; k++) u[k] = floats[o + k];
      u[6] = half;
      u[8] = c[0];
      u[9] = c[1];
      u[10] = c[2];
      if (inv) {
        const r9 = oval && persp ? planeInverseRows(m, ovalCtm(e)) : rows;
        if (r9) for (let k = 0; k < 9; k++) u[WAKE_FLOATS + k] = r9[k];
        paint.setShader(effect.makeShader(u));
      } else
        paint.setShader(
          oval && persp
            ? effect.makeShader(u, Skia.Matrix(ovalLocalMatrix(e, m)))
            : effect.makeShader(u, lm),
        );
      if (oval && persp) strokeOval(canvas, e, paint);
      else strokePlaneCircle(canvas, path, m, e, 0, 0, R, paint);
    }
    const wakesPicture = recorder.finishRecordingAsPicture();
    probeEnd("wakes", probe);
    return wakesPicture;
  });
  if (!effect) return null;
  return <Picture picture={picture} />;
}

// --- WP-2.1 switch trims ------------------------------------------------------------

/**
 * Switch ring UNWIND / DRAW-ON in screen space (same roles, lengths, alpha and
 * culling contract as `TrimRingPicture`): the sweep-gradient mask is centred
 * on the world origin through the homography as the gradient's local matrix.
 */
export function PlaneTrimRingPicture({
  entries,
  frame,
  profile,
}: {
  entries: readonly LabRingEntry[];
  frame: SharedValue<AnimatedFrame>;
  profile: LabRingProfile;
}) {
  const ctx = useLabStillContext();
  const spec = useMemo(() => {
    const out: Record<string, number[]> = {};
    for (const e of entries) {
      const c = tokenToVec4(e.cls.color);
      out[e.key] = [
        c[0],
        c[1],
        c[2],
        Math.min(1, profile.alpha * e.cls.alpha * 1.6),
        e.cls.widthDp * TRIM_WIDTH_SCALE,
      ];
    }
    return out;
  }, [entries, profile.alpha]);
  const picture = useDerivedValue(() => {
    const probe = probeStart();
    const { recorder, canvas } = beginScreenPicture();
    const fr = frame.value;
    const m = planeHomography(fr.pose, fr.viewport);
    const sw = ctx?.sw;
    if (m) {
      const lm = Skia.Matrix(m as number[]);
      const path = Skia.Path.Make();
      const w = fr.viewport.width;
      const h = fr.viewport.height;
      const draw = (
        c: number[],
        alpha: number,
        len: number,
        angle: number,
        r: number,
      ) => {
        "worklet";
        const e = projectedCircleEllipse(m, 0, 0, r);
        if (!e || !ellipseOnScreen(e, c[4] / 2 + 1, w, h)) return;
        const deg = angle * RAD_TO_DEG - 90;
        const start = ((deg % 360) + 360) % 360;
        const cut = Math.max(0, Math.min(0.998, 1 - len));
        const paint = Skia.Paint();
        paint.setStyle(1);
        paint.setStrokeWidth(c[4]);
        paint.setAntiAlias(true);
        paint.setShader(
          Skia.Shader.MakeSweepGradient(
            0,
            0,
            [
              Float32Array.of(c[0], c[1], c[2], 0),
              Float32Array.of(c[0], c[1], c[2], 0),
              Float32Array.of(c[0], c[1], c[2], TRIM_TAIL),
              Float32Array.of(c[0], c[1], c[2], 1),
            ],
            [0, cut, cut + 0.002, 1],
            0,
            lm,
            0,
            start,
            start + 360,
          ),
        );
        paint.setAlphaf(Math.min(1, alpha));
        strokePlaneCircle(canvas, path, m, e, 0, 0, r, paint);
      };
      if (ctx?.warm.value) {
        draw([1, 1, 1, 1, 1], 0.01, 0.5, 0, 40);
      } else if (ctx && sw) {
        const fx = ctx.fxFlags.value;
        const signal = sw.signal.value;
        const live =
          fx.flags.fx &&
          fx.flags.fxRingTrim &&
          switchFxLive(signal, ctx.reducedMotion.value);
        const roles = sw.roles.value;
        if (live && roles.generation === signal.generation) {
          const transition = sw.transition.value;
          const lists = [roles.leaving, roles.entering];
          for (let l = 0; l < 2; l++) {
            const list = lists[l];
            for (let n = 0; n < list.length; n++) {
              const e = transition.entries[list[n]];
              if (!e) continue;
              const c = spec[e.key];
              if (!c) continue;
              const [len, a] = trimRingState(roles, e.key, signal, true);
              if (len <= 0.001 || a <= 0) continue;
              const world = sampleSwitchEntry(transition, e, signal.progress);
              draw(
                c,
                c[3] * a * (0.55 + 0.45 * len),
                len,
                Math.atan2(world.x, -world.y),
                world.ringRadius,
              );
            }
          }
        }
      }
    }
    const trimPicture = recorder.finishRecordingAsPicture();
    probeEnd("trim", probe);
    return trimPicture;
  });
  return <Picture picture={picture} />;
}

// --- Focused ring: glow (under the class rings) / lock line (above) ----------------

/**
 * The focused ring's two soft glow strokes (`layer="glow"`, plain status
 * colour) or its instrument lock line through the class shader at full alpha
 * (`layer="lock"`, keeps the status dash style), in screen space. Alpha =
 * body opacity × the WP-2.2 world response `mix` (1 when that flag is off),
 * as the component path's Group opacities.
 */
export function PlaneFocusRingPicture({
  layer,
  focused,
  frame,
  frameIndex,
  cam,
  flow,
  profile,
  highlight,
  shader,
}: {
  layer: "glow" | "lock";
  focused: readonly LabRingEntry[];
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  cam: SharedValue<number[]>;
  flow: SharedValue<number[]>;
  profile: LabRingProfile;
  highlight: number[];
  shader: boolean;
}) {
  const ctx = useLabStillContext();
  const fxFlags = ctx?.fxFlags;
  const focus = ctx?.focus ?? null;
  const effect =
    shader && layer === "lock" ? getLabEffect("ringInstrument") : null;
  const specs = useMemo(
    () =>
      focused.map((e) => ({
        key: e.key,
        color: tokenToVec4(e.cls.color),
        widthDp: e.cls.widthDp,
        dashPeriod: e.cls.dashPeriod,
        dashDuty: e.cls.dashDuty,
      })),
    [focused],
  );
  const glowWide = profile.glowWide;
  const glowNarrow = profile.glowNarrow;
  const glowWideDp = profile.glowWideDp;
  const glowNarrowDp = profile.glowNarrowDp;
  const farAlpha = profile.farAlpha;
  const flowK = profile.flow;
  const picture = useDerivedValue(() => {
    const f = frame.value;
    const m = planeHomography(f.pose, f.viewport);
    if (!m || specs.length === 0 || !(f.pose.zoom > 0))
      return emptyPlanePicture();
    const fx = fxFlags ? fxFlags.value : null;
    const mix =
      focus && fx?.flags.fx && fx.flags.fxFocusDim ? focus.mix.value : 1;
    if (!(mix > 0)) return emptyPlanePicture();
    const index = frameIndex.value;
    const zoom = f.pose.zoom;
    const lm = Skia.Matrix(m as number[]);
    const c = layer === "lock" ? cam.value : null;
    const fl = layer === "lock" ? flow.value : null;
    const { recorder, canvas } = beginScreenPicture();
    const path = Skia.Path.Make();
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      const b = bodyAt(f, index, s.key);
      if (!b) continue;
      const r = b.ringRadius / zoom;
      const op = b.opacity * mix;
      if (!(r > 0) || !(op > 0)) continue;
      const e = projectedCircleEllipse(m, 0, 0, r);
      if (!e) continue;
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setStyle(1);
      paint.setColor(Float32Array.of(s.color[0], s.color[1], s.color[2], 1));
      if (layer === "glow") {
        const widths = [glowWideDp, glowNarrowDp];
        const alphas = [glowWide, glowNarrow];
        for (let k = 0; k < 2; k++) {
          paint.setStrokeWidth(widths[k]);
          paint.setAlphaf(Math.min(1, alphas[k] * op));
          if (
            !ellipseOnScreen(
              e,
              widths[k] / 2 + 1,
              f.viewport.width,
              f.viewport.height,
            )
          )
            continue;
          if (widths[k] >= OVAL_MIN_STROKE_DP && hasPerspective(m))
            strokeOval(canvas, e, paint);
          else strokePlaneCircle(canvas, path, m, e, 0, 0, r, paint);
        }
      } else {
        const width = s.widthDp * 1.2;
        paint.setStrokeWidth(width);
        paint.setAlphaf(Math.min(1, op));
        if (effect && c && fl) {
          const u = ringUniforms(s.color, highlight, c, fl, {
            mode: MODE_RING,
            alpha: 1,
            dashPeriod: s.dashPeriod,
            dashDuty: s.dashDuty,
            farAlpha,
            flowStrength: flowK,
            flowOn: true,
          });
          paint.setShader(
            effect.makeShader(flattenUniforms(u, RING_ORDER), lm),
          );
        }
        if (
          ellipseOnScreen(e, width / 2 + 1, f.viewport.width, f.viewport.height)
        )
          strokePlaneCircle(canvas, path, m, e, 0, 0, r, paint);
      }
    }
    return recorder.finishRecordingAsPicture();
  });
  return <Picture picture={picture} />;
}

// --- Instrument ticks ---------------------------------------------------------------

/**
 * North ticks (every ring, `detail` level only), the focused ring's 30° tick
 * scale and the compass chevron: world segments projected through the
 * homography per frame and stroked as 1-dp screen lines (a line maps to a line
 * under a homography, so this is exact). `segs` are flat [x0, y0, x1, y1, …]
 * world arrays (React side).
 */
export function PlaneTicksPicture({
  north,
  focusTicks,
  compass,
  frame,
  level,
  tick,
  tickAlpha,
  compassColor,
  compassAlpha,
}: {
  north: readonly number[];
  focusTicks: readonly number[];
  compass: readonly number[];
  frame: SharedValue<AnimatedFrame>;
  level: SharedValue<SemanticLevel>;
  tick: readonly number[];
  tickAlpha: number;
  compassColor: readonly number[];
  compassAlpha: number;
}) {
  const picture = useDerivedValue(() => {
    const f = frame.value;
    const m = planeHomography(f.pose, f.viewport);
    if (!m) return emptyPlanePicture();
    const detail = level.value === "detail";
    const { recorder, canvas } = beginScreenPicture();
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(1);
    paint.setStrokeWidth(1);
    const lists = [detail ? north : NO_SEGS, focusTicks];
    paint.setColor(
      Float32Array.of(tick[0], tick[1], tick[2], tick[3] * tickAlpha),
    );
    for (let l = 0; l < 2; l++) {
      const s = lists[l];
      for (let i = 0; i + 3 < s.length; i += 4) {
        const p0 = applyHomography(m, s[i], s[i + 1]);
        const p1 = applyHomography(m, s[i + 2], s[i + 3]);
        canvas.drawLine(p0.x, p0.y, p1.x, p1.y, paint);
      }
    }
    if (compass.length >= 8) {
      const cp = Skia.Paint();
      cp.setAntiAlias(true);
      cp.setStyle(1);
      cp.setStrokeWidth(1);
      cp.setStrokeCap(1);
      cp.setColor(
        Float32Array.of(
          compassColor[0],
          compassColor[1],
          compassColor[2],
          compassColor[3] * compassAlpha,
        ),
      );
      const path = Skia.Path.Make();
      for (let i = 0; i + 3 < compass.length; i += 4) {
        const p0 = applyHomography(m, compass[i], compass[i + 1]);
        const p1 = applyHomography(m, compass[i + 2], compass[i + 3]);
        path.moveTo(p0.x, p0.y);
        path.lineTo(p1.x, p1.y);
      }
      canvas.drawPath(path, cp);
    }
    return recorder.finishRecordingAsPicture();
  });
  return <Picture picture={picture} />;
}
