/**
 * ORRERY LAB B — tilt fix: the RING FIELD layer (flag `ringField`, default
 * ON; see `labb-ring-field.ts` for why and how).
 *
 * Two derived values, so the expensive part runs only when ring DATA
 * changes:
 *   1. `field`: the entry list (class rings with their frame radius and
 *      alpha, wake angles, switch trims) → ring table + radius LUT encoded as
 *      two tiny RGBA8 images (image shaders, nearest sampling). Rebuilt only
 *      when the entries differ from the last build (a pan or the ambient flow
 *      clock does not change them).
 *   2. `picture`: ONE full-screen rect with the `ringField` shader — the
 *      homography rows, the camera, the flow clock and the class styles as
 *      uniforms. Re-recorded per flow tick (one draw, one shader).
 * Same alpha / focus-dim / switch-fade / wake-gate / trim rules as the
 * per-ring pictures (`RingClassesPicture`, `WakesPicture`, `TrimRingPicture`).
 *
 * Hermes rule: worklet helpers are declared ABOVE their callers.
 */
import {
  Picture,
  Skia,
  type SkPicture,
  type SkShader,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import { sampleSwitchEntry } from "@/logic/orrery-switch-choreography";
import type { LabRingProfile } from "@/theme/orrery-lab-fx";
import type { LabRingEntry } from "./LabRings";
import { useLabStillContext } from "./labb-context";
import { getLabEffect, LAB_EFFECT_SOURCES } from "./labb-effects";
import { focusDimFactor } from "./labb-focus-logic";
import { bodyAt, type FrameIndex } from "./labb-frame-index";
import { flattenUniforms, uniformOrder } from "./labb-layer-plan";
import { probeEnd, probeStart } from "./labb-perf-probe";
import { planeInverseRows } from "./labb-plane-ellipse";
import {
  buildRingField,
  FIELD_LUT_W,
  FIELD_RING,
  FIELD_TRIM,
  pushFieldEntry,
} from "./labb-ring-field";
import { planeHomography, ringDensityFade } from "./labb-rings-logic";
import {
  classRingSwitchFade,
  switchFxLive,
  trimRingState,
} from "./labb-switch-logic";
import { tokenToVec4 } from "./labb-uniforms";

/** Fixed class slots of the field shader (uC0..4 / uS0..4). */
export const FIELD_CLASS_ORDER = [
  "neutral",
  "stable",
  "wobble",
  "decay",
  "rogue",
] as const;
const TRIM_WIDTH_SCALE = 1.35;
const TRIM_TAIL = 0.3;
const FIELD_ORDER = uniformOrder(LAB_EFFECT_SOURCES.ringField);
const NO_FOCUS_KEYS: string[] = [];
const COLOR_RGBA = 4;
const ALPHA_OPAQUE = 1;

interface FieldBuild {
  entries: number[];
  table: SkShader;
  lut: SkShader;
  rmax: number;
  count: number;
}

function sameEntries(a: readonly number[], b: readonly number[]): boolean {
  "worklet";
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function emptyFieldPicture(): SkPicture {
  "worklet";
  const g = globalThis as unknown as { __labbEmptyPicture?: SkPicture };
  if (!g.__labbEmptyPicture) {
    const recorder = Skia.PictureRecorder();
    recorder.beginRecording(Skia.XYWHRect(0, 0, 1, 1));
    g.__labbEmptyPicture = recorder.finishRecordingAsPicture();
  }
  return g.__labbEmptyPicture;
}

/** RGBA8 opaque raster image → nearest-sampled clamp shader (or null). */
function dataShader(
  bytes: Uint8Array,
  width: number,
  height: number,
): SkShader | null {
  "worklet";
  const image = Skia.Image.MakeImage(
    { width, height, colorType: COLOR_RGBA, alphaType: ALPHA_OPAQUE },
    Skia.Data.fromBytes(bytes),
    width * 4,
  );
  return image ? image.makeShaderOptions(0, 0, 0, 0) : null;
}

let fieldIds = 0;

export function RingFieldPicture({
  classes,
  frame,
  frameIndex,
  cam,
  flow,
  profile,
  highlight,
  ringGap,
  anyFocus,
  trimKeys,
  sunLight,
  wakeOn,
  wakeOpacity,
  trimOn,
  trimEntries,
  pixelRatio,
}: {
  classes: readonly (readonly LabRingEntry[])[];
  frame: SharedValue<AnimatedFrame>;
  frameIndex: SharedValue<FrameIndex>;
  cam: SharedValue<number[]>;
  flow: SharedValue<number[]>;
  profile: LabRingProfile;
  highlight: number[];
  ringGap: number;
  anyFocus: boolean;
  trimKeys: ReadonlySet<string>;
  sunLight: readonly number[];
  /** Wakes drawn at all (flag + density LOD). */
  wakeOn: boolean;
  /** settle × recovery gate (0 hides the wakes, as the wake pictures). */
  wakeOpacity: SharedValue<number>;
  /** WP-2.1 trims (flags fx + fxRingTrim). */
  trimOn: boolean;
  trimEntries: readonly LabRingEntry[];
  pixelRatio: number;
}) {
  const ctx = useLabStillContext();
  const fxFlags = ctx?.fxFlags;
  const reducedMotion = ctx?.reducedMotion;
  const signal = ctx?.sw?.signal;
  const roles = ctx?.sw?.roles;
  const transitionSv = ctx?.sw?.transition;
  const focus = ctx?.focus ?? null;
  const effect = getLabEffect("ringField");
  const id = useMemo(() => `f${++fieldIds}`, []);
  // React side: per class slot style, per key slot / dim / wake angle.
  const spec = useMemo(() => {
    const keys: string[] = [];
    const slot: number[] = [];
    const dims: number[] = [];
    const trimmed: boolean[] = [];
    const wake: number[] = [];
    const tokenAlpha: number[] = [];
    const C: number[][] = FIELD_CLASS_ORDER.map(() => [0, 0, 0, 0]);
    const S: number[][] = FIELD_CLASS_ORDER.map(() => [1, 0, 1, 0]);
    for (const group of classes) {
      const cls = group[0].cls;
      const k = FIELD_CLASS_ORDER.indexOf(cls.id);
      const c = tokenToVec4(cls.color);
      C[k] = [c[0], c[1], c[2], profile.alpha * cls.alpha];
      S[k] = [
        cls.widthDp,
        cls.dashPeriod,
        cls.dashDuty,
        cls.wake ? profile.wakeAlpha * cls.alpha : 0,
      ];
      for (const e of group) {
        keys.push(e.key);
        slot.push(k);
        dims.push(anyFocus && !e.focused ? profile.focusDim : 1);
        trimmed.push(trimKeys.has(e.key));
        const a = e.x === 0 && e.y === 0 ? 0 : Math.atan2(e.x, -e.y);
        const angle = a < 0 ? a + 2 * Math.PI : a;
        wake.push(cls.wake && angle > 1e-3 ? angle : 0);
        tokenAlpha.push(c[3]);
      }
    }
    const trim: Record<string, number[]> = {};
    for (const e of trimEntries)
      trim[e.key] = [
        FIELD_CLASS_ORDER.indexOf(e.cls.id),
        Math.min(1, profile.alpha * e.cls.alpha * 1.6),
      ];
    return { keys, slot, dims, trimmed, wake, tokenAlpha, C, S, trim };
  }, [classes, profile, anyFocus, trimKeys, trimEntries]);
  const focusDim = profile.focusDim;
  const field = useDerivedValue<FieldBuild | null>(() => {
    const probe = probeStart();
    const f = frame.value;
    const index = frameIndex.value;
    const zoom = f.pose.zoom;
    if (!effect || !(zoom > 0)) {
      probeEnd("fieldData", probe);
      return null;
    }
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
    const entries: number[] = [];
    for (let i = 0; i < spec.keys.length; i++) {
      const key = spec.keys[i];
      const b = bodyAt(f, index, key);
      if (!b) continue;
      let op =
        b.opacity *
        (fon ? focusDimFactor(fkeys, key, fmix, focusDim) : spec.dims[i]);
      if (spec.trimmed[i] && signal)
        op *= classRingSwitchFade(roleMap, key, sig, live);
      pushFieldEntry(
        entries,
        b.ringRadius / zoom,
        spec.slot[i],
        FIELD_RING,
        Math.min(1, spec.tokenAlpha[i] * op),
        wakeOn ? spec.wake[i] : 0,
        0,
        0,
      );
    }
    if (trimOn && sig && roleMap && transitionSv && live) {
      if (roleMap.generation === sig.generation) {
        const transition = transitionSv.value;
        const lists = [roleMap.leaving, roleMap.entering];
        for (let l = 0; l < 2; l++) {
          const list = lists[l];
          for (let n = 0; n < list.length; n++) {
            const e = transition.entries[list[n]];
            if (!e) continue;
            const t = spec.trim[e.key];
            if (!t) continue;
            const [len, a] = trimRingState(roleMap, e.key, sig, true);
            if (len <= 0.001 || a <= 0) continue;
            const world = sampleSwitchEntry(transition, e, sig.progress);
            pushFieldEntry(
              entries,
              world.ringRadius,
              t[0],
              FIELD_TRIM,
              Math.min(1, t[1] * a * (0.55 + 0.45 * len)),
              0,
              len,
              Math.atan2(world.x, -world.y),
            );
          }
        }
      }
    }
    const g = globalThis as unknown as {
      __labbField?: Record<string, FieldBuild | null>;
    };
    if (!g.__labbField) g.__labbField = {};
    const prev = g.__labbField[id];
    if (prev && sameEntries(prev.entries, entries)) {
      probeEnd("fieldData", probe);
      return prev;
    }
    const data = buildRingField(entries);
    let out: FieldBuild | null = null;
    if (data) {
      const table = dataShader(data.table, data.width, 3);
      const lut = dataShader(data.lut, FIELD_LUT_W, 1);
      if (table && lut)
        out = { entries, table, lut, rmax: data.rmax, count: data.count };
    }
    g.__labbField[id] = out;
    probeEnd("fieldData", probe);
    return out;
  });
  const C = spec.C;
  const S = spec.S;
  const farAlpha = profile.farAlpha;
  const flowK = profile.flow;
  const wakeWidthDp = profile.wakeWidthDp;
  const picture = useDerivedValue<SkPicture>(() => {
    const probe = probeStart();
    const fb = field.value;
    const f = frame.value;
    const m = fb && effect ? planeHomography(f.pose, f.viewport) : null;
    if (!fb || !m || !effect) {
      probeEnd("rings", probe);
      return emptyFieldPicture();
    }
    const c = cam.value;
    const fl = flow.value;
    const fx = fxFlags ? fxFlags.value : null;
    const fade = ringDensityFade(ringGap, c[3]);
    const lit = fx?.flags.ringSunLight ? sunLight : null;
    const inv = planeInverseRows(m);
    const wakeOp = wakeOn ? wakeOpacity.value : 0;
    const u: Record<string, number[]> = {
      uInv0: [inv[0], inv[1], inv[2]],
      uInv1: [inv[3], inv[4], inv[5]],
      uInv2: [inv[6], inv[7], inv[8]],
      uH0: [m[0], m[1], m[2]],
      uH1: [m[3], m[4], m[5]],
      uH2: [m[6], m[7], m[8]],
      uCam: [c[0], c[1], c[2], c[3]],
      uFlow: [fl[0], fl[1], fl[2], fl[3]],
      uHi: [
        highlight[0],
        highlight[1],
        highlight[2],
        flowK * fade * fade * fl[4],
      ],
      uSpin: [fl[5] ?? 0, fl[6] ?? 0, lit ? lit[0] : 0, lit ? lit[1] : 0],
      uView: [fb.rmax, fb.count, FIELD_LUT_W, pixelRatio],
      uWake: [wakeOp, wakeWidthDp, farAlpha, wakeOp > 0 ? 1 : 0],
      uTrim: [TRIM_WIDTH_SCALE, TRIM_TAIL, 0, 0],
      uC0: [C[0][0], C[0][1], C[0][2], C[0][3] * fade],
      uC1: [C[1][0], C[1][1], C[1][2], C[1][3] * fade],
      uC2: [C[2][0], C[2][1], C[2][2], C[2][3] * fade],
      uC3: [C[3][0], C[3][1], C[3][2], C[3][3] * fade],
      uC4: [C[4][0], C[4][1], C[4][2], C[4][3] * fade],
      uS0: S[0],
      uS1: S[1],
      uS2: S[2],
      uS3: S[3],
      uS4: S[4],
    };
    const recorder = Skia.PictureRecorder();
    const w = f.viewport.width;
    const h = f.viewport.height;
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, w, h));
    const paint = Skia.Paint();
    paint.setShader(
      effect.makeShaderWithChildren(flattenUniforms(u, FIELD_ORDER), [
        fb.table,
        fb.lut,
      ]),
    );
    canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint);
    const fieldPicture = recorder.finishRecordingAsPicture();
    probeEnd("rings", probe);
    return fieldPicture;
  });
  if (!effect) return null;
  return <Picture picture={picture} />;
}
