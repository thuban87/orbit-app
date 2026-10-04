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
 * - breath (Lab C): sin²(πp) × (0.5 + 0.5·intensity) — a dolly-out and a lift
 *   toward flat mid-switch, zero at both ends;
 * - swirl: an authored out-and-back camera yaw swing (fractional turns
 *   allowed), on top of the SHORTEST-arc yaw back to Home (the old raw linear
 *   yaw mix span the long way round across the 0/2π wrap);
 * - skyHue (Lab B `skyHueWeight`): the per-System sky tint crossfade weight,
 *   smooth over [SKY_HUE_START, 1]; reduced motion crossfades over the whole
 *   (180 ms) switch.
 * Reduced motion: no warp, trail, breath or swirl — only the crossfade.
 *
 * Worklet helpers are declared above their callers (Hermes forward-ref rule).
 * No Skia import (node-testable).
 */
import type { CameraPose } from "./orrery-camera-logic";
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

/** The camera composition's authored amounts (visual-tunables). */
export interface SwitchCameraLook {
  /** Peak extra camera turn mid-switch (fractional turns; 0 = shortest arc only). */
  swirlTurns: number;
  /** Lab C SWITCH_PULLBACK: the dolly-out share of zoom at full breath. */
  breathPullback: number;
  /** Lab C SWITCH_TILT: the tilt change at full breath (negative = toward flat). */
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
  /** The out-and-back swirl envelope 0..1..0. */
  swirl: number;
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

/** The swirl's out-and-back envelope: sin(π · smoothstep(p)). */
export function switchSwirlEnvelope(progress: number): number {
  "worklet";
  return Math.sin(Math.PI * fxSmooth01(progress));
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
    swirl: live ? switchSwirlEnvelope(progress) * scale : 0,
    skyHue: switchSkyHueWeight(progress, transition.reducedMotion),
  };
}

/**
 * The switch camera's yaw: the SHORTEST arc from `fromYaw` to `toYaw`
 * (smoothstep-eased, as every other pose axis) plus an authored out-and-back
 * swing of `swirlTurns` turns at `swirl` strength. Lands exactly on `toYaw`
 * (mod 2π) at progress 1; the swing is zero at both ends.
 */
export function switchSwirlYaw(
  fromYaw: number,
  toYaw: number,
  progress: number,
  swirlTurns: number,
  swirl: number,
): number {
  "worklet";
  const from = Number.isFinite(fromYaw) ? fromYaw : 0;
  const to = Number.isFinite(toYaw) ? toYaw : 0;
  const t = fxSmooth01(progress);
  return (
    from +
    shortestYaw(from, to) * t +
    Math.PI * 2 * (Number.isFinite(swirlTurns) ? swirlTurns : 0) * swirl
  );
}

/**
 * Lab C's breath on an interpolated camera, as ONE composition with the
 * swirl: the zoom pulls back by `pullback × breath` (the focal follows, the
 * dolly model), the tilt moves by `tilt × breath` toward flat (never below
 * 0). breath 0 returns the camera unchanged, so the landing is exact.
 */
export function applySwitchBreath(
  camera: CameraPose,
  breath: number,
  look: SwitchCameraLook,
): CameraPose {
  "worklet";
  if (!(breath > 0)) return camera;
  const keep = Math.max(0.05, 1 - look.breathPullback * breath);
  return {
    ...camera,
    zoom: camera.zoom * keep,
    focalDistance:
      camera.focalDistance === undefined
        ? undefined
        : camera.focalDistance / keep,
    tilt: Math.max(0, (camera.tilt ?? 0) + look.breathTilt * breath),
  };
}
