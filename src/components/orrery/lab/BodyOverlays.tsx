/**
 * ORRERY LAB A — per-body presentation overlays, drawn INSIDE a body's root
 * Group (local space: centre 0,0; units = the body's world radius; the Group's
 * transform scales to the projected radius). None of these change the body's
 * `radius`/`hitRadius`; extents beyond r stay ≤ the frame's culling reach
 * (1.3 r contacts, 2 r sun — the corona fades out before its quad edge).
 *
 *  - `BodyLightOverlay` (item 4): sun-facing terminator, limb darkening, rim
 *    light + atmosphere halo in the status hue, far-depth tint.
 *  - `SunCorona` (item 5 + switch flare of item 7): animated corona + bloom.
 *  - `FocusReticle` (item 6): accent targeting brackets, slowly rotating;
 *    static under live reduced motion.
 */
import { Circle, Group, Path, Rect, Shader } from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import {
  Easing,
  type SharedValue,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { BillboardPose } from "@/logic/orrery-frame";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";
import { useOrreryClock } from "../orrery-clock-context";
import {
  BODY_EDGE_LIT,
  BODY_EDGE_NIGHT,
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
  RETICLE_ARM,
  RETICLE_GAP,
  RETICLE_LOCK_MS,
  RETICLE_LOCK_SPREAD,
  RETICLE_PING_REACH,
  RETICLE_SPEED,
  SUN_GRANULE_SPEED,
} from "./deep-field-config";
import { type DeepFieldInk, tokenInk } from "./deep-field-ink";
import { type BodyLightMap, bodyVisualScale } from "./deep-field-math";
import { labEffect } from "./deep-field-shaders";

/** Up-left key light when a body has no entry (e.g. unit harness). */
const DEFAULT_LIGHT = [-0.6, -0.8, 0] as const;
/** Local-space AA band ≈ this many dp, divided by the projected scale. */
const AA_DP = 0.6;

export interface DeepFieldBodyContext {
  ink: DeepFieldInk;
  light: SharedValue<BodyLightMap>;
}

export function BodyLightOverlay({
  radius,
  lightKey,
  rimColor,
  projection,
  context,
}: {
  radius: number;
  lightKey: string;
  /** The canonical status body colour (`orreryRingStyle().bodyFill`). */
  rimColor: string;
  projection?: SharedValue<BillboardPose>;
  context: DeepFieldBodyContext;
}) {
  const { ink, light } = context;
  const effect = useMemo(() => labEffect("body"), []);
  const statics = useMemo(
    () => ({
      uShade: [...ink.shadow],
      uRim: [...tokenInk(rimColor)],
      uFarTint: [...ink.voidTone],
      uShadowMax: ink.chart ? BODY_SHADOW_MAX_LIGHT : BODY_SHADOW_MAX_DARK,
      uRimGain: ink.chart ? BODY_RIM_LIGHT : BODY_RIM_DARK,
      uHaloAlpha: ink.chart ? BODY_HALO_ALPHA_LIGHT : BODY_HALO_ALPHA_DARK,
      uChart: ink.chart ? 1 : 0,
      uSpec: ink.chart ? BODY_SPEC_LIGHT : BODY_SPEC_DARK,
      uSpecInk: [...ink.starlight],
      uKey: [...ink.background],
    }),
    [ink, rimColor],
  );
  const uniforms = useDerivedValue(() => {
    const l = light.value[lightKey] ?? DEFAULT_LIGHT;
    const base = projection?.value.scale ?? 1;
    // Total local→screen scale includes the pass-1 visual body scale.
    const scale = base * bodyVisualScale(radius * base);
    return {
      uR: radius,
      uL: [l[0], l[1]],
      uFar: l[2],
      uAA: AA_DP / Math.max(0.05, scale),
      uShadowMax: statics.uShadowMax,
      uRimGain: statics.uRimGain,
      uHaloAlpha: statics.uHaloAlpha,
      uHaloReach: BODY_HALO_REACH,
      uChart: statics.uChart,
      uEdgeLit: BODY_EDGE_LIT,
      uEdgeNight: BODY_EDGE_NIGHT,
      uSpec: statics.uSpec,
      uShade: statics.uShade,
      uRim: statics.uRim,
      uFarTint: statics.uFarTint,
      uSpecInk: statics.uSpecInk,
      uKey: statics.uKey,
      // Separation keyline: BODY_KEYLINE_DP wide on screen, outside the disc.
      uGap: BODY_KEYLINE_DP / Math.max(0.05, scale) / radius,
      uKeyAlpha: statics.uChart
        ? BODY_KEYLINE_ALPHA_LIGHT
        : BODY_KEYLINE_ALPHA_DARK,
    };
  });
  if (!effect) return null;
  return (
    <Circle cx={0} cy={0} r={radius * BODY_HALO_REACH}>
      <Shader source={effect} uniforms={uniforms} />
    </Circle>
  );
}

export function SunCorona({
  radius,
  glowColor,
  ink,
  flare,
}: {
  radius: number;
  /** The resolved occupant glow hue (`resolveSunOccupant().glowColor`). */
  glowColor: string;
  ink: DeepFieldInk;
  /** 0..1 switch-capture flare (always 0 under reduced motion). */
  flare?: SharedValue<number>;
}) {
  const clock = useOrreryClock();
  const reducedMotion = useReducedMotionShared();
  const effect = useMemo(() => labEffect("corona"), []);
  const statics = useMemo(
    () => ({
      uCore: [...ink.starlight],
      uGlow: [...tokenInk(glowColor)],
      uChart: ink.chart ? 1 : 0,
      uAlpha: ink.chart ? CORONA_ALPHA_LIGHT : CORONA_ALPHA_DARK,
    }),
    [ink, glowColor],
  );
  const uniforms = useDerivedValue(() => {
    const still = !clock || reducedMotion.value;
    return {
      uR: radius,
      // Static (but still shaped) corona under reduced motion.
      uTime: still ? 1.7 : (clock?.value ?? 0) * CORONA_SPEED,
      uFlare: still ? 0 : (flare?.value ?? 0) * FLARE_GAIN,
      uReach: CORONA_EXTENT,
      uChart: statics.uChart,
      uAlpha: statics.uAlpha,
      uCore: statics.uCore,
      uGlow: statics.uGlow,
    };
  });
  if (!effect)
    return (
      <Circle cx={0} cy={0} r={radius * 1.8} color={glowColor} opacity={0.35} />
    );
  const half = radius * CORONA_EXTENT;
  return (
    <Rect
      x={-half}
      y={-half}
      width={half * 2}
      height={half * 2}
      blendMode={ink.chart ? "srcOver" : "screen"}
    >
      <Shader source={effect} uniforms={uniforms} />
    </Rect>
  );
}

/**
 * PASS 1: the sun disc as a star (see SUN_DISC_SKSL). Without a photo it
 * REPLACES the flat swatch; with a photo it only frames it with a glowing
 * limb, so the occupant photo stays the identity. Granulation runs off the
 * single clock and is static under live reduced motion.
 */
export function SunDisc({
  radius,
  glowColor,
  ink,
  photo,
  projection,
  flare,
}: {
  radius: number;
  glowColor: string;
  ink: DeepFieldInk;
  photo: boolean;
  projection?: SharedValue<BillboardPose>;
  /** 0..1 switch-capture flare (0 under reduced motion). */
  flare?: SharedValue<number>;
}) {
  const clock = useOrreryClock();
  const reducedMotion = useReducedMotionShared();
  const effect = useMemo(() => labEffect("sunDisc"), []);
  const statics = useMemo(
    () => ({
      uCore: [...(ink.chart ? ink.background : ink.starlight)],
      uGlow: [...tokenInk(glowColor)],
      uPhoto: photo ? 1 : 0,
    }),
    [ink, glowColor, photo],
  );
  const uniforms = useDerivedValue(() => {
    const still = !clock || reducedMotion.value;
    const scale = projection?.value.scale ?? 1;
    return {
      uR: radius,
      uTime: still ? 2.3 : (clock?.value ?? 0) * SUN_GRANULE_SPEED,
      uPhoto: statics.uPhoto,
      uAA: 0.7 / Math.max(0.05, scale),
      uFlare: still ? 0 : (flare?.value ?? 0),
      uCore: statics.uCore,
      uGlow: statics.uGlow,
    };
  });
  if (!effect) return null;
  return (
    <Circle cx={0} cy={0} r={radius}>
      <Shader source={effect} uniforms={uniforms} />
    </Circle>
  );
}

/** Four corner brackets around a square of half-size `h`, arm length `arm`. */
function bracketPath(h: number, arm: number): string {
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  return corners
    .map(
      ([sx, sy]) =>
        `M ${sx * h} ${sy * (h - arm)} L ${sx * h} ${sy * h} L ${sx * (h - arm)} ${sy * h}`,
    )
    .join(" ");
}

/** Lock-on timeline: 0 → 1 brackets converge, 1 → LOCK_END the ping. */
const LOCK_END = 1.7;

export function FocusReticle({
  radius,
  reticleColor,
  gap = RETICLE_GAP,
}: {
  radius: number;
  /** The focus accent (passed through `focusColor`, never a status hue). */
  reticleColor: string;
  gap?: number;
}) {
  const clock = useOrreryClock();
  const reducedMotion = useReducedMotionShared();
  const h = radius + gap;
  const path = useMemo(
    () => bracketPath(h, Math.max(4, radius * RETICLE_ARM + 3)),
    [h, radius],
  );
  // PASS 2 lock-on: when focus lands the brackets converge from wide and
  // rotated onto the body, then a single ping ring leaves the body. Mount =
  // focus landing (the reticle only exists while focused). Static (already
  // locked, no ping) under live reduced motion. Single UI-thread timing — no
  // React state per frame.
  const lock = useSharedValue(0);
  useEffect(() => {
    lock.value = reducedMotion.value
      ? LOCK_END
      : withTiming(LOCK_END, {
          duration: RETICLE_LOCK_MS,
          easing: Easing.out(Easing.cubic),
        });
  }, [lock, reducedMotion]);
  const transform = useDerivedValue(() => {
    const still = !clock || reducedMotion.value;
    const e = still ? 1 : Math.min(1, lock.value);
    const spin = still ? 0 : (clock?.value ?? 0) * RETICLE_SPEED;
    return [
      { rotate: spin + (1 - e) * (Math.PI / 4) },
      { scale: 1 + (1 - e) * RETICLE_LOCK_SPREAD },
    ];
  });
  const bracketOpacity = useDerivedValue(() =>
    reducedMotion.value ? 1 : 0.25 + 0.75 * Math.min(1, lock.value),
  );
  const pingR = useDerivedValue(() => {
    const t = Math.max(0, Math.min(1, (lock.value - 1) / (LOCK_END - 1)));
    return radius + 3 + t * radius * RETICLE_PING_REACH;
  });
  const pingOpacity = useDerivedValue(() => {
    if (reducedMotion.value) return 0;
    const t = (lock.value - 1) / (LOCK_END - 1);
    return t <= 0 || t >= 1 ? 0 : (1 - t) * (1 - t) * 0.8;
  });
  return (
    <Group>
      <Group transform={transform} opacity={bracketOpacity}>
        <Path
          path={path}
          color={reticleColor}
          style="stroke"
          strokeWidth={1.6}
          strokeCap="round"
        />
      </Group>
      <Circle
        cx={0}
        cy={0}
        r={radius + 3}
        color={reticleColor}
        style="stroke"
        strokeWidth={0.8}
        opacity={0.55}
      />
      <Circle
        cx={0}
        cy={0}
        r={pingR}
        color={reticleColor}
        style="stroke"
        strokeWidth={1.4}
        opacity={pingOpacity}
      />
    </Group>
  );
}
