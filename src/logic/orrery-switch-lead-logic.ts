/**
 * 38.7-15 (D-76, owner-required): the System switch LEAD-IN — motion starts on
 * the tap, against the retained scene, while the destination loads.
 *
 * WHY: a switch could only begin once the destination scene had loaded (its
 * SQL read and geometry): on DEBUG the 6 Pro showed nothing moving for
 * ~2–2.5 s to/from All Contacts and ~0.75 s on Size 5 ↔ 120. The owner: "I
 * absolutely don't want a 2+ second wait…". Target: motion within ~100–200 ms
 * of the tap.
 *
 * WHAT: on the tap the current world starts the switch's own opening — the
 * spin accelerating exactly as a switch's ACCELERATE phase does (velocity
 * (a / ACCELERATE_END)², then its plateau), the star warp and orbit streaks
 * rising with it, and Lab C's camera breath easing in (D-77's camera, its
 * first ACCELERATE_END of the breath, then held) — and keeps spinning at the
 * plateau until the destination arrives. Every value is a pure function of
 * the lead state and its clock (Lab B's pure-signal pattern).
 *
 * HAND-OFF (continuity, Plan 13's "start from what is drawn"): the real switch
 * begins from the drawn world and the live pose, and INHERITS the lead's
 * momentum (`SwitchLeadCarry`): a coast offset whose angular speed starts at
 * the lead's ω and fades as ω·(1 − u²) over the switch's accelerate phase
 * (u = p / ACCELERATE_END) — exactly as the switch's own speed grows as ω·u² —
 * so the spin speed is continuous through the hand-off (and constant when the
 * two plateaus match). The coast angle is pre-applied to the switch's source
 * (+⅔ ω·window) and reaches exactly 0 at the end of the window, so the switch
 * still lands EXACTLY on its destination at Home. Warp, streaks and breath
 * fade the same way while the switch's own rise in. Reduced motion never
 * leads (the plain crossfade, D-24); a lead that ends without a destination
 * (a failed load) coasts back to its own world.
 *
 * Worklet helpers are declared above their callers (Hermes forward-ref rule).
 * No Skia import (node-testable).
 */
import type { WorldBody } from "./orrery-camera-logic";
import {
  ACCELERATE_END,
  type ChoreographyWorldBody,
  type SwitchChoreography,
  type SwitchLeadCarry,
  sampleSwitchChoreography,
  spinTurnsForIntensity,
} from "./orrery-switch-choreography";
import {
  fxClamp01,
  type SwitchFxSignal,
  sampleSwitchSignal,
  switchBreath,
  switchRotationPlateau,
  TRAIL_VELOCITY_GAIN,
  WARP_INTENSITY_FLOOR,
} from "./orrery-switch-fx-logic";

// --- Tunable constants (top-of-file per project convention) ------------------

/**
 * The lead's assumed intensity (the destination's membership change is not
 * known yet): it sets the lead's spin turns (1 + round(2·i)), warp and breath
 * strength. 0.5 = the middle (2 turns); the switch blends to its own.
 */
export const SWITCH_LEAD_INTENSITY = 0.5;
/** The breath eases in over the switch's first ACCELERATE_END, then holds. */
export const SWITCH_LEAD_BREATH_CAP = ACCELERATE_END;
/** The coast window (progress units): the switch's accelerate phase. */
export const SWITCH_LEAD_COAST = ACCELERATE_END;
/**
 * The lead clock's ceiling (ms). IN-05: a load slower than this does not
 * freeze mid-spin — over the last SWITCH_LEAD_REST_MS before it the spin,
 * warp, streaks and breath coast back to rest together (the accelerate phase
 * mirrored), so at the ceiling the world is still and nothing animates.
 */
export const SWITCH_LEAD_MAX_MS = 60_000;
/** IN-05: the coast to rest before the ceiling (ms). Tunable. */
export const SWITCH_LEAD_REST_MS = 2_000;

/** The UI-thread lead state (a SharedValue; the clock is its own). */
export interface SwitchLeadState {
  active: boolean;
  turns: number;
  intensity: number;
  /** Reduced motion arrived mid-lead: the spin holds; no warp, trail, breath. */
  still: boolean;
}

export const NO_SWITCH_LEAD: SwitchLeadState = Object.freeze({
  active: false,
  turns: 0,
  intensity: 0,
  still: false,
});

/**
 * A lead starting now, at `intensity` (callers pass SWITCH_LEAD_INTENSITY).
 * No default parameter: a worklet's default-parameter initializer runs in the
 * parameter scope, BEFORE the body unpacks the closure the worklets plugin
 * captured, so on the UI runtime a module identifier there does not exist
 * (DEBUG 6 Pro: `ReferenceError: Property 'SWITCH_LEAD_INTENSITY' doesn't
 * exist` on every System switch). orrery-worklet-default-params.test.ts.
 */
export function beginSwitchLead(intensity: number): SwitchLeadState {
  "worklet";
  const i = fxClamp01(intensity);
  return {
    active: true,
    turns: spinTurnsForIntensity(i),
    intensity: i,
    still: false,
  };
}

/** The lead's normalised spin speed at lead progress `a` (accelerate, then plateau). */
export function switchLeadVelocity(a: number): number {
  "worklet";
  if (!(a > 0)) return 0;
  if (a < ACCELERATE_END) {
    const r = a / ACCELERATE_END;
    return r * r;
  }
  return 1;
}

/** ∫₀ᵃ velocity — the lead's rotation in plateau-progress units. */
export function switchLeadRotationIntegral(a: number): number {
  "worklet";
  if (!(a > 0)) return 0;
  if (a < ACCELERATE_END)
    return (a * a * a) / (3 * ACCELERATE_END * ACCELERATE_END);
  return ACCELERATE_END / 3 + (a - ACCELERATE_END);
}

/**
 * IN-05: the lead's motion at lead progress `a`, on the switch's time scale
 * `durationMs`: its normalised velocity, the rotation integral (∫ velocity,
 * plateau-progress units) and the level scale of its breath (1 until the rest
 * window, then easing to 0 with the velocity). Inside the rest window
 * [start, end] the velocity is r² (r = (end − a) / (end − start): the
 * accelerate phase mirrored); from `end` (the clock's ceiling) on, all rest.
 */
export function switchLeadMotion(
  a: number,
  durationMs: number,
): { velocity: number; integral: number; ease: number } {
  "worklet";
  const end = durationMs > 0 ? SWITCH_LEAD_MAX_MS / durationMs : 0;
  const start = Math.max(
    ACCELERATE_END,
    end - (durationMs > 0 ? SWITCH_LEAD_REST_MS / durationMs : 0),
  );
  const at = end > 0 ? Math.min(a, end) : a;
  if (!(end > start) || !(at > start))
    return {
      velocity: switchLeadVelocity(at),
      integral: switchLeadRotationIntegral(at),
      ease: 1,
    };
  const span = end - start;
  const r = (end - at) / span;
  return {
    velocity: r * r,
    integral: switchLeadRotationIntegral(start) + (span / 3) * (1 - r * r * r),
    ease: r * r,
  };
}

/**
 * IN-05: whether a lead is still moving (the canvas's `busy`): active and
 * short of the clock's ceiling, where it has come to rest.
 */
export function switchLeadMoving(
  lead: SwitchLeadState,
  clockMs: number,
): boolean {
  "worklet";
  return lead.active && !(clockMs >= SWITCH_LEAD_MAX_MS);
}

/** The lead's plateau spin rate in rad per unit progress (a switch's own). */
export function switchLeadPlateau(turns: number): number {
  "worklet";
  return turns * Math.PI * 2 * switchRotationPlateau();
}

export interface SwitchLeadSample {
  /** The world's rotation so far (rad, forward). */
  rotation: number;
  velocity: number;
  /** The spin rate now (rad per unit progress). */
  omega: number;
  warp: number;
  trail: number;
  breath: number;
  /** The spin rate now (rad/s at `durationMs`). */
  angularSpeed: number;
}

/** The lead at `clockMs` since the tap, on the switch's time scale `durationMs`. */
export function sampleSwitchLead(
  lead: SwitchLeadState,
  clockMs: number,
  durationMs: number,
): SwitchLeadSample {
  "worklet";
  const a =
    durationMs > 0 && Number.isFinite(clockMs)
      ? Math.max(0, clockMs) / durationMs
      : 0;
  const plateau = switchLeadPlateau(lead.turns);
  const motion = switchLeadMotion(a, durationMs);
  const rotation = lead.active ? plateau * motion.integral : 0;
  if (!lead.active || lead.still)
    return {
      rotation,
      velocity: 0,
      omega: 0,
      warp: 0,
      trail: 0,
      breath: 0,
      angularSpeed: 0,
    };
  const v = motion.velocity;
  const i = fxClamp01(lead.intensity);
  return {
    rotation,
    velocity: v,
    omega: plateau * v,
    warp: v * (WARP_INTENSITY_FLOOR + (1 - WARP_INTENSITY_FLOOR) * i),
    trail: Math.min(1, v * TRAIL_VELOCITY_GAIN),
    breath:
      switchBreath(Math.min(a, SWITCH_LEAD_BREATH_CAP)) *
      (0.5 + 0.5 * i) *
      motion.ease,
    angularSpeed: durationMs > 0 ? (plateau * v) / (durationMs / 1000) : 0,
  };
}

/** What a switch inherits from the lead sample it takes over. */
export function switchLeadCarry(sample: SwitchLeadSample): SwitchLeadCarry {
  "worklet";
  return {
    coast: sample.omega * SWITCH_LEAD_COAST,
    velocity: sample.velocity,
    warp: sample.warp,
    trail: sample.trail,
    breath: sample.breath,
    angularSpeed: sample.angularSpeed,
  };
}

/** The carry's weight at switch progress `p`: 1 − u², 0 from the window's end. */
export function switchLeadFade(progress: number): number {
  "worklet";
  const u = Math.max(0, progress) / SWITCH_LEAD_COAST;
  return u < 1 ? 1 - u * u : 0;
}

/** The angle pre-applied to the switch's source at the hand-off (+⅔·coast). */
export function switchLeadCoastStart(carry: SwitchLeadCarry): number {
  "worklet";
  return (2 / 3) * carry.coast;
}

/**
 * The coast offset at switch progress `p`: −coast·(⅔ − u + u³/3). It starts
 * at −⅔·coast (cancelling the pre-rotation), its rate is ω·(1 − u²), and it
 * is exactly 0 from the end of the window on (the landing is unchanged).
 */
export function switchLeadCoastOffset(
  carry: SwitchLeadCarry,
  progress: number,
): number {
  "worklet";
  const u = Math.max(0, progress) / SWITCH_LEAD_COAST;
  if (!(u < 1)) return 0;
  return -carry.coast * (2 / 3 - u + (u * u * u) / 3);
}

/** The world rotated forward by `angle` about the sun (the choreography's sense). */
export function rotateSwitchWorld<B extends WorldBody>(
  world: readonly B[],
  angle: number,
): B[] {
  "worklet";
  if (!(Math.abs(angle) > 0) || !Number.isFinite(angle)) return [...world];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const out: B[] = [];
  for (let i = 0; i < world.length; i++) {
    const body = world[i];
    out.push({
      ...body,
      x: body.x * c - body.y * s,
      y: body.x * s + body.y * c,
    });
  }
  return out;
}

/**
 * The world a switch draws at `progress` — its choreography sample plus, for
 * a switch that took over a lead, the coast offset. The ONE world sampler
 * (C3-H1): the frame worklet, a retarget's displayed world and the reduced-
 * motion retarget all use it, so a retarget always starts from what is drawn.
 */
export function sampleSwitchWorld(
  transition: SwitchChoreography,
  progress: number,
): ChoreographyWorldBody[] {
  "worklet";
  const world = sampleSwitchChoreography(transition, progress).world;
  const carry = transition.lead;
  if (!carry) return world;
  const offset = switchLeadCoastOffset(carry, progress);
  return offset === 0 ? world : rotateSwitchWorld(world, offset);
}

/**
 * The switch signal one frame draws: the lead's own while a lead runs on a
 * settled scene; otherwise the switch's (`sampleSwitchSignal`) plus a carried
 * lead's levels fading over the accelerate window.
 */
export function sampleSwitchSignalWithLead(
  transition: SwitchChoreography,
  progress: number,
  durationMs: number,
  lead: SwitchLeadState,
  leadClockMs: number,
): SwitchFxSignal {
  "worklet";
  if (lead.active && progress >= 1) {
    const s = sampleSwitchLead(lead, leadClockMs, durationMs);
    return {
      generation: transition.generation,
      progress: 1,
      running: true,
      reducedMotion: false,
      intensity: fxClamp01(lead.intensity),
      velocity: s.velocity,
      angularSpeed: s.angularSpeed,
      warp: s.warp,
      trail: s.trail,
      breath: s.breath,
      skyHue: 1,
    };
  }
  const base = sampleSwitchSignal(transition, progress, durationMs);
  const carry = transition.lead;
  if (!carry || !(progress < 1)) return base;
  const f = switchLeadFade(progress);
  if (!(f > 0)) return base;
  return {
    ...base,
    running: true,
    velocity: base.velocity + carry.velocity * f,
    angularSpeed: base.angularSpeed + carry.angularSpeed * f,
    warp: base.warp + carry.warp * f,
    trail: Math.min(1, base.trail + carry.trail * f),
    breath: base.breath + carry.breath * f,
  };
}
