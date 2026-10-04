/**
 * 38.7-13 (D-24, D-32, D-53, D-08): the System switch's cinematic signal and
 * camera composition, as pure functions of the choreography and progress.
 *
 * Every switch effect is a function of (transition, progress) only, never of
 * wall-clock state (Lab B's pure-signal pattern, `labb-switch-logic.ts`), so a
 * pause, a remount mid-switch, a resume and a rapid A→B→C retarget stay
 * correct by construction. The production choreography (spin, shed, capture,
 * 2100 / 180 ms, land at Home, ready at 0.82) is unchanged underneath: these
 * effects ride its phases.
 *
 * - warp (Lab B `warpAmount`): the star warp, driven by the spin's speed — it
 *   grows with the spin through ACCELERATE, holds on the plateau and relaxes
 *   through SETTLE, scaled by an intensity floor;
 * - trail (Lab A): the orbit streaks' strength, min(1, velocity × 1.4);
 * - breath (Lab C): sin²(πp) × (0.5 + 0.5·intensity) — the switch camera's
 *   dolly-out, out-and-back yaw swing and lift toward top-down mid-switch, zero at
 *   both ends. The switch camera is Lab C's, copied from its code (owner
 *   S-SWIRL pick, 2026-10-04): Lab C's base yaw path (`switchBaseYaw`) plus
 *   Lab C's breath (`applySwitchBreath`);
 * - skyHue (Lab B `skyHueWeight`): the per-System sky tint crossfade weight,
 *   smooth over [SKY_HUE_START, 1]; reduced motion crossfades over the whole
 *   (180 ms) switch.
 * Reduced motion: no warp, trail or breath — only the crossfade.
 *
 * Worklet helpers are declared above their callers (Hermes forward-ref rule).
 * No Skia import (node-testable).
 */
import { type CameraPose, dollyFocalDistance } from "./orrery-camera-logic";
import { shortestYaw } from "./orrery-recovery-logic";
import {
  ACCELERATE_END,
  SETTLE_START,
  type SwitchChoreography,
} from "./orrery-switch-choreography";

/** Lab B `warpAmount`: the warp's floor and intensity share (0.35 + 0.65·i). */
export const WARP_INTENSITY_FLOOR = 0.35;
/** Lab A: the trail strength reaches 1 at this share of full spin speed (× 1.4). */
export const TRAIL_VELOCITY_GAIN = 1.4;
/** Lab B `SKY_HUE_START`: the sky-hue crossfade runs over [0.55, 1]. */
export const SKY_HUE_START = 0.55;

/** What the switch camera needs from the transition being drawn (C3-H1). */
export type SwitchCameraMotion = Pick<
  SwitchChoreography,
  "reducedMotion" | "intensity" | "spinTurns"
>;

/**
 * The switch camera's base yaw path. "lab-c": Lab C's raw linear mix
 * from → to (its `interpolateCamera`, `mix(from.yaw, to.yaw, 0)`); stored yaw
 * is normalised to [0, 2π) and Home's is 0, so a camera turned just short of
 * a full turn travels nearly the whole turn back. "shortest": the shortest arc
 * across the 0/2π wrap (Plan 13's first build).
 */
export type SwitchYawPath = "lab-c" | "shortest";

/** The switch camera's authored amounts (visual-tunables; Lab C's numbers). */
export interface SwitchCameraLook {
  /** The base yaw path (SWITCH_YAW_PATH). */
  yawPath: SwitchYawPath;
  /** Lab C SWITCH_PULLBACK: the dolly-out share of zoom at full breath. */
  breathPullback: number;
  /** Lab C SWITCH_YAW: the yaw swing (rad) added at full breath. */
  breathYaw: number;
  /** Lab C SWITCH_TILT: the tilt change at full breath (negative = toward top-down). */
  breathTilt: number;
}

/** The switch signal one frame draws (all zero / settled at rest). */
export interface SwitchFxSignal {
  generation: number;
  progress: number;
  running: boolean;
  reducedMotion: boolean;
  intensity: number;
  /** The spin's speed normalised to its plateau: 0 at rest, 1 at full spin. */
  velocity: number;
  /** The world's angular speed (radians per second at `durationMs`). */
  angularSpeed: number;
  warp: number;
  trail: number;
  breath: number;
  /** Sky-hue crossfade weight toward the destination System's hue. */
  skyHue: number;
}

export function fxClamp01(value: number): number {
  "worklet";
  return value <= 0 ? 0 : value >= 1 ? 1 : Number.isFinite(value) ? value : 0;
}

export function fxSmooth01(value: number): number {
  "worklet";
  const t = fxClamp01(value);
  return t * t * (3 - 2 * t);
}

/**
 * The spin's normalised speed (the choreography's angular velocity over its
 * plateau): (p / ACCELERATE_END)² while accelerating, 1 on the plateau,
 * ((1 − p) / (1 − SETTLE_START))² while settling.
 */
export function switchVelocity(progress: number): number {
  "worklet";
  const p = fxClamp01(progress);
  if (p >= 1) return 0;
  if (p < ACCELERATE_END) {
    const a = p / ACCELERATE_END;
    return a * a;
  }
  if (p < SETTLE_START) return 1;
  const s = (1 - p) / (1 - SETTLE_START);
  return s * s;
}

/**
 * The choreography's rotation plateau in turns-of-maximumRotation per unit
 * progress: 1 / the integral of `switchVelocity` over [0, 1] (the same
 * normalisation `sampleSwitchChoreography` uses).
 */
export function switchRotationPlateau(): number {
  "worklet";
  return (
    1 /
    (ACCELERATE_END / 3 +
      (SETTLE_START - ACCELERATE_END) +
      (1 - SETTLE_START) / 3)
  );
}

/** Lab C `switchBreath`: sin²(πp) — 0 at both ends, 1 mid-switch. */
export function switchBreath(progress: number): number {
  "worklet";
  const s = Math.sin(Math.PI * fxClamp01(progress));
  return s * s;
}

/** Lab B `skyHueWeight`: the sky tint's crossfade weight at `progress`. */
export function switchSkyHueWeight(
  progress: number,
  reducedMotion: boolean,
): number {
  "worklet";
  if (!(progress < 1)) return 1;
  if (reducedMotion) return fxSmooth01(progress);
  return fxSmooth01((progress - SKY_HUE_START) / (1 - SKY_HUE_START));
}

/** Whether a transition carries the spectacle (a spin; never reduced motion). */
export function switchHasSpectacle(motion: SwitchCameraMotion): boolean {
  "worklet";
  return !motion.reducedMotion && motion.spinTurns > 0;
}

/**
 * The switch signal for `transition` at `progress` (a pure function) of a
 * switch lasting `durationMs`. Zero spectacle at progress 0 and 1, for a
 * zero-intensity switch (no spin) and under reduced motion.
 */
export function sampleSwitchSignal(
  transition: Pick<
    SwitchChoreography,
    | "generation"
    | "reducedMotion"
    | "intensity"
    | "spinTurns"
    | "maximumRotation"
  >,
  fraction: number,
  durationMs: number,
): SwitchFxSignal {
  "worklet";
  const progress = fxClamp01(fraction);
  const running = progress < 1;
  const live = running && progress > 0 && switchHasSpectacle(transition);
  const intensity = fxClamp01(transition.intensity);
  const velocity = live ? switchVelocity(progress) : 0;
  const scale = 0.5 + 0.5 * intensity;
  return {
    generation: transition.generation,
    progress,
    running,
    reducedMotion: transition.reducedMotion,
    intensity,
    velocity,
    angularSpeed:
      live && durationMs > 0
        ? (transition.maximumRotation * velocity * switchRotationPlateau()) /
          (durationMs / 1000)
        : 0,
    warp:
      velocity *
      (WARP_INTENSITY_FLOOR + (1 - WARP_INTENSITY_FLOOR) * intensity),
    trail: Math.min(1, velocity * TRAIL_VELOCITY_GAIN),
    breath: live ? switchBreath(progress) * scale : 0,
    skyHue: switchSkyHueWeight(progress, transition.reducedMotion),
  };
}

/**
 * The switch camera's base yaw at eased progress `t` (smoothstep(p), as every
 * other pose axis). "lab-c" is Lab C's raw linear mix; "shortest" takes the
 * shortest arc. Both are exactly `fromYaw` at t 0; at t 1 "lab-c" is exactly
 * `toYaw` and "shortest" is `toYaw` mod 2π.
 */
export function switchBaseYaw(
  fromYaw: number,
  toYaw: number,
  t: number,
  path: SwitchYawPath,
): number {
  "worklet";
  const from = Number.isFinite(fromYaw) ? fromYaw : 0;
  const to = Number.isFinite(toYaw) ? toYaw : 0;
  return from + (path === "shortest" ? shortestYaw(from, to) : to - from) * t;
}

/**
 * Lab C's switch-camera breath (`OrreryWorld3D` sampled-camera breath, copied):
 * the zoom pulls back by `pullback × breath`, the focal distance is the dolly
 * focal of that zoom (Lab C `labFocalDistance(zoom)`), the yaw swings by
 * `yaw × breath` and the tilt moves by `tilt × breath` toward top-down (never
 * below 0). breath 0 returns the camera unchanged, so the landing is exact.
 */
export function applySwitchBreath(
  camera: CameraPose,
  breath: number,
  look: SwitchCameraLook,
): CameraPose {
  "worklet";
  if (!(breath > 0)) return camera;
  // Guard only: Lab C has no floor (identical for any pullback below 0.95).
  const zoom = camera.zoom * Math.max(0.05, 1 - look.breathPullback * breath);
  return {
    ...camera,
    zoom,
    focalDistance: dollyFocalDistance(zoom),
    yaw: (camera.yaw ?? 0) + look.breathYaw * breath,
    tilt: Math.max(0, (camera.tilt ?? 0) + look.breathTilt * breath),
  };
}
