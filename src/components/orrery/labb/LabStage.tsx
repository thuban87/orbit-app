/**
 * ORRERY LAB B — R2 "stage" layers: how the star lights its plane, plus the
 * hero-moment experiments.
 *
 *   LabStagePlane   (flags `planeLight`, `planeGrid`) — ONE full-screen shader
 *                   under the rings: a sun light pool on the orbital plane and
 *                   an optional plane grid that dips into a gravity well. Its
 *                   uniforms follow the camera only (no clock): an idle canvas
 *                   stays idle.
 *   LabLensFlare    (flag `lensFlare`, EXPERIMENT) — anamorphic streak, halo
 *                   and ghosts on the sun → screen-centre axis; additive themes
 *                   only; drawn under the labels.
 *   labBloomPaint   (flag `bloom`, EXPERIMENT) — ONE saveLayer paint whose
 *                   image filter adds a blurred bright-pass of the layer to
 *                   itself (Skia's GPU blur downsamples internally at these
 *                   sigmas). Wraps sky + world, never the labels.
 *   LabTiltShift    (flag `tiltShift`, EXPERIMENT) — cheap depth of field:
 *                   backdrop-blur bands at the top (far side) and bottom of the
 *                   view while the plane is tilted; under the labels.
 *
 * Colours: the sun's glow (a starPalette token via `resolveSunOccupant`), the
 * accent and `textSecondary`, passed as uniforms (C-03 family, C-67).
 * Hermes rule: worklet helpers are declared ABOVE their callers.
 */
import {
  BackdropBlur,
  BlendMode,
  Fill,
  Group,
  Shader,
  Skia,
  type SkPaint,
  TileMode,
} from "@shopify/react-native-skia";
import { type SharedValue, useDerivedValue } from "react-native-reanimated";
import type { AnimatedFrame } from "@/logic/orrery-frame";
import type { LabStageProfile } from "@/theme/orrery-lab-fx";
import { getLabEffect } from "./labb-effects";
import { planeHomography, tiltDepth } from "./labb-rings-logic";

// --- Tunables -----------------------------------------------------------------
/** Tilt-shift: bands as fractions of the view height, blur in dp. */
const TS_FAR_BAND = 0.2;
const TS_FAR_SOFT = 0.1;
const TS_NEAR_BAND = 0.12;
const TS_BLUR = 5;
const TS_BLUR_SOFT = 2;
/** Tilt-shift only once the plane is clearly tilted (normalised tilt depth). */
const TS_MIN_TILT = 0.25;
/** Lens flare: fade as the sun leaves the view (fraction of the half-diagonal). */
const FLARE_EDGE = 1.15;

/** Inverse of a row-major 3×3 (null when singular). Exported for tests. */
export function invert3(m: readonly number[]): number[] | null {
  "worklet";
  const a = m[0];
  const b = m[1];
  const c = m[2];
  const d = m[3];
  const e = m[4];
  const f = m[5];
  const g = m[6];
  const h = m[7];
  const i = m[8];
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  const k = 1 / det;
  return [
    A * k,
    -(b * i - c * h) * k,
    (b * f - c * e) * k,
    B * k,
    (a * i - c * g) * k,
    -(a * f - c * d) * k,
    C * k,
    -(a * h - b * g) * k,
    (a * e - b * d) * k,
  ];
}

/** Stage-plane uniforms for one frame (pure; tested). */
export function stagePlaneUniforms(
  frame: AnimatedFrame,
  extent: number,
  glow: readonly number[],
  tone: readonly number[],
  stage: LabStageProfile,
  pool: boolean,
  grid: boolean,
  intensity: number,
): Record<string, number[]> {
  "worklet";
  const m = planeHomography(frame.pose, frame.viewport);
  const inv = m ? invert3(m) : null;
  const ext = extent > 0 ? extent : 200;
  const z = inv ? inv : [0, 0, 0, 0, 0, 0, 0, 0, 0];
  return {
    uInv0: [z[0], z[1], z[2]],
    uInv1: [z[3], z[4], z[5]],
    uInv2: [z[6], z[7], z[8]],
    uPool: [glow[0], glow[1], glow[2], pool ? stage.pool * intensity : 0],
    uPool2: [
      ext * stage.poolRadius,
      stage.poolAdditive ? 1 : 0,
      grid ? stage.grid * intensity : 0,
      ext / Math.max(1, stage.gridCells),
    ],
    uGrid: [tone[0], tone[1], tone[2], stage.well],
    uView: [frame.pose.zoom, ext, tiltDepth(frame.pose), 0],
  };
}

export function LabStagePlane({
  frame,
  extent,
  glow,
  tone,
  stage,
  pool,
  grid,
  intensity,
}: {
  frame: SharedValue<AnimatedFrame>;
  extent: number;
  /** Sun glow rgb (0..1). */
  glow: readonly number[];
  /** Grid tone rgb (0..1). */
  tone: readonly number[];
  stage: LabStageProfile;
  pool: boolean;
  grid: boolean;
  intensity: number;
}) {
  const effect = getLabEffect("stagePlane");
  const uniforms = useDerivedValue(() =>
    stagePlaneUniforms(
      frame.value,
      extent,
      glow,
      tone,
      stage,
      pool,
      grid,
      intensity,
    ),
  );
  if (!effect || (!pool && !grid)) return null;
  return (
    <Fill>
      <Shader source={effect} uniforms={uniforms} />
    </Fill>
  );
}

/** Lens-flare uniforms (pure; tested). Strength 0 when the sun is gone. */
export function lensFlareUniforms(
  frame: AnimatedFrame,
  glow: readonly number[],
  accent: readonly number[],
  strength: number,
): Record<string, number[]> {
  "worklet";
  const w = frame.viewport.width;
  const h = frame.viewport.height;
  let sun = null;
  for (let i = 0; i < frame.bodies.length; i++) {
    const b = frame.bodies[i];
    if (b.kind === "sun" && b.visible) {
      sun = b;
      break;
    }
  }
  const cx = w / 2;
  const cy = h / 2;
  let k = 0;
  if (sun) {
    const half = Math.sqrt(cx * cx + cy * cy);
    const off = Math.sqrt((sun.x - cx) ** 2 + (sun.y - cy) ** 2) / half;
    // Brightest when the camera looks at the star; gone past the edge.
    k = sun.opacity * Math.max(0, 1 - off / FLARE_EDGE) * strength;
  }
  return {
    uSun: [sun ? sun.x : cx, sun ? sun.y : cy, sun ? sun.radius : 1, k],
    uAxis: [cx, cy, w, h],
    uTintA: [glow[0], glow[1], glow[2], 0],
    uTintB: [accent[0], accent[1], accent[2], 0],
  };
}

export function LabLensFlare({
  frame,
  glow,
  accent,
  strength,
}: {
  frame: SharedValue<AnimatedFrame>;
  glow: readonly number[];
  accent: readonly number[];
  strength: number;
}) {
  const effect = getLabEffect("lensFlare");
  const uniforms = useDerivedValue(() =>
    lensFlareUniforms(frame.value, glow, accent, strength),
  );
  if (!effect || strength <= 0) return null;
  return (
    <Fill blendMode="plus">
      <Shader source={effect} uniforms={uniforms} />
    </Fill>
  );
}

/**
 * Bloom paint for a saveLayer: source + blur(brightPass(source)), plus-blended.
 * The bright pass is a colour matrix: rgb' = (rgb − t)·g / (1 − t), clamped by
 * Skia; alpha kept. JS thread, once per profile/intensity. Null when off.
 */
export function labBloomPaint(
  stage: LabStageProfile,
  intensity: number,
  pixelRatio: number,
): SkPaint | null {
  if (!(stage.bloomGain > 0) || stage.bloomThreshold >= 1) return null;
  try {
    const t = stage.bloomThreshold;
    const g = (stage.bloomGain * intensity) / (1 - t);
    const o = -t * g;
    // 4×5 row-major colour matrix (RGBA rows, last column = bias 0..1).
    const bright = Skia.ColorFilter.MakeMatrix([
      g,
      0,
      0,
      0,
      o,
      0,
      g,
      0,
      0,
      o,
      0,
      0,
      g,
      0,
      o,
      0,
      0,
      0,
      1,
      0,
    ]);
    const sigma = stage.bloomSigma * (pixelRatio > 0 ? pixelRatio : 1);
    const blur = Skia.ImageFilter.MakeBlur(
      sigma,
      sigma,
      TileMode.Decal,
      Skia.ImageFilter.MakeColorFilter(bright, null),
    );
    const filter = Skia.ImageFilter.MakeBlend(BlendMode.Plus, blur, null);
    const paint = Skia.Paint();
    paint.setImageFilter(filter);
    return paint;
  } catch {
    return null;
  }
}

/** Tilt-shift band blur for the current frame (0 = band off). Pure; tested. */
export function tiltShiftBlur(frame: AnimatedFrame, max: number): number {
  "worklet";
  const t = tiltDepth(frame.pose);
  if (t < TS_MIN_TILT) return 0;
  return max * Math.min(1, (t - TS_MIN_TILT) / (1 - TS_MIN_TILT) + 0.35);
}

export function LabTiltShift({
  frame,
  width,
  height,
}: {
  frame: SharedValue<AnimatedFrame>;
  width: number;
  height: number;
}) {
  const strong = useDerivedValue(() => tiltShiftBlur(frame.value, TS_BLUR));
  const soft = useDerivedValue(() => tiltShiftBlur(frame.value, TS_BLUR_SOFT));
  const far = height * TS_FAR_BAND;
  const farSoft = height * TS_FAR_SOFT;
  const near = height * TS_NEAR_BAND;
  return (
    <Group>
      <BackdropBlur blur={strong} clip={{ x: 0, y: 0, width, height: far }} />
      <BackdropBlur
        blur={soft}
        clip={{ x: 0, y: far, width, height: farSoft }}
      />
      <BackdropBlur
        blur={soft}
        clip={{ x: 0, y: height - near - farSoft, width, height: farSoft }}
      />
      <BackdropBlur
        blur={strong}
        clip={{ x: 0, y: height - near, width, height: near }}
      />
    </Group>
  );
}
