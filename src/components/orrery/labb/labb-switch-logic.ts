/**
 * ORRERY LAB B — System-switch showcase: pure maths (WP-2.1).
 *
 * Every switch effect is a PURE FUNCTION of
 *   (switch signal = sampleSwitchSignal(transition, progress),
 *    per-entry role / stagger from the transition,
 *    the animated frame (the displayed body poses and camera))
 * — never wall-clock state. Pause, remount mid-switch, resume and a rapid
 * A→B→C retarget therefore stay correct by construction (research 03 §1.3).
 *
 * Phase map (choreography constants are NOT changed; effects live inside them):
 *   accelerate 0–0.20  hyperspace star streaks grow with the spin, nebula push,
 *                      corona flare, ring flow spools up, retained motion smears
 *   shed 0.18–0.58     leaving bodies dissolve into stateless particle bursts,
 *                      their rings unwind
 *   capture 0.44–0.82  entering bodies arrive behind comet streaks, their rings
 *                      draw on, a capture flare when each reaches its rail
 *   settle 0.72–1      streaks relax, one system-lock shockwave, sky hue settles
 * Reduced motion (transition.reducedMotion or the live signal): NONE of these —
 * only the existing short crossfade plus the sky-hue crossfade.
 * Intensity (membership change 0..1) scales particle count, streak length and
 * gates the shockwave (none below `SHOCK_MIN_INTENSITY`).
 *
 * Hermes rule: every helper is declared ABOVE its worklet callers (guarded by
 * `orrery-worklet-order.test.ts`). No Skia import here (node-testable).
 */

import {
  CAPTURE_END,
  CAPTURE_START,
  SETTLE_START,
  SHED_END,
  SHED_START,
  type SwitchChoreography,
  type SwitchSignal,
} from "@/logic/orrery-switch-choreography";
import type { OrrerySystemRef } from "@/logic/orrery-system-logic";

// --- Tunables -----------------------------------------------------------------
/** Particle Atlas capacity (fixed: buffer hooks re-create on a size change). */
export const PARTICLE_CAPACITY = 640;
/** Particles per leaving body at intensity 1 (scaled down by intensity). */
export const PARTICLES_PER_BODY = 36;
/** Every particle is dead by this progress (the destination settles clean). */
export const PARTICLE_END = 0.94;
/** Comet / smear Atlas capacity (entering + retained contacts). */
export const TRAIL_CAPACITY = 256;
/** Capture-flare Atlas capacity (entering contacts; 2 sprites each). */
export const FLARE_CAPACITY = 128;
/** Streak length (dp) of a star at the screen edge at full warp. */
export const STREAK_MAX_DP = 190;
/** Extra zoom of the sky at full warp ("pushing into" the cloud). */
export const WARP_PUSH = 0.14;
/** Vortex twist of the star streaks at full warp (radians, spin direction). */
export const WARP_SWIRL = 0.32;
/** Corona flare at full warp (+40 %, research 03 §1.3). */
export const CORONA_FLARE = 0.4;
/** Ring-flow comets advance this fraction of the system spin. */
export const FLOW_SPOOL = 0.55;
/** No system-lock shockwave below this membership-change intensity. */
export const SHOCK_MIN_INTENSITY = 0.25;
/** The shockwave runs over [SHOCK_START, 1]. */
export const SHOCK_START = 0.7;
/** Sky-hue crossfade window (normal motion); reduced motion uses all of it. */
export const SKY_HUE_START = 0.55;
/** Comet tail: sample the entering body this much progress earlier. */
export const COMET_LOOKBACK = 0.07;
/** Retained motion smear: sample this much progress earlier. */
export const SMEAR_LOOKBACK = 0.025;
/** Capture flare window (progress) after an entry's capture end. */
export const FLARE_LEAD = 0.07;
export const FLARE_SPAN = 0.15;

/** Role codes in the per-key role map. */
export const ROLE_RETAINED = 0;
export const ROLE_LEAVING = 1;
export const ROLE_ENTERING = 2;
export const ROLE_ANCHOR = 3;

// --- Basic helpers (worklets, declared first) ----------------------------------

export function clamp01(v: number): number {
  "worklet";
  return v <= 0 ? 0 : v >= 1 ? 1 : Number.isFinite(v) ? v : 0;
}

export function smooth01(v: number): number {
  "worklet";
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
}

/** Deterministic hash → [0, 1) (Hermes: no crypto). */
export function fxHash(a: number, b: number): number {
  "worklet";
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Whether the rich switch FX run at all for this signal. */
export function switchFxLive(
  signal: SwitchSignal | null,
  reducedNow: boolean,
): boolean {
  "worklet";
  return !!signal && signal.running && !signal.reducedMotion && !reducedNow;
}

/** Hyperspace warp amount 0..1: the normalised spin × an intensity floor. */
export function warpAmount(signal: SwitchSignal | null): number {
  "worklet";
  if (!signal?.running || signal.reducedMotion) return 0;
  return signal.velocity * (0.35 + 0.65 * clamp01(signal.intensity));
}

/** Settle-phase progress 0..1 (0 before SETTLE_START, 1 at rest). */
export function settleAmount(signal: SwitchSignal | null): number {
  "worklet";
  if (!signal?.running) return 1;
  return clamp01((signal.progress - SETTLE_START) / (1 - SETTLE_START));
}

/**
 * System-lock shockwave: [phase 0..1, strength 0..1]. Strength 0 below the
 * intensity gate, outside the window and under reduced motion.
 */
export function shockwaveState(signal: SwitchSignal | null): [number, number] {
  "worklet";
  if (
    !signal?.running ||
    signal.reducedMotion ||
    signal.intensity < SHOCK_MIN_INTENSITY
  )
    return [0, 0];
  const u = clamp01((signal.progress - SHOCK_START) / (1 - SHOCK_START));
  if (u <= 0 || u >= 1) return [u, 0];
  const envelope = Math.min(1, u * 7) * (1 - u) ** 1.4;
  const strength = 0.35 + 0.4 * clamp01(signal.intensity);
  return [u, envelope * strength];
}

/**
 * Sky-hue crossfade weight toward the destination System's hue. Reduced motion
 * crossfades over the whole (180 ms) switch; normal motion over the settle.
 */
export function skyHueWeight(signal: SwitchSignal | null): number {
  "worklet";
  if (!signal?.running) return 1;
  if (signal.reducedMotion) return smooth01(signal.progress);
  return smooth01((signal.progress - SKY_HUE_START) / (1 - SKY_HUE_START));
}

/** Capture-flare envelope 0..1 for an entering entry with `stagger`. */
export function flareEnvelope(progress: number, stagger: number): number {
  "worklet";
  const t = (progress - (CAPTURE_END + stagger - FLARE_LEAD)) / FLARE_SPAN;
  if (t <= 0 || t >= 1) return 0;
  return Math.sin(Math.PI * t) ** 1.3;
}

// --- Per-key roles (recomputed only when the transition is re-published) -------

export interface LabSwitchRoles {
  generation: number;
  /** key → [role code, stagger, entry index]. */
  byKey: Record<string, number[]>;
  /** Entry indices per role (contacts only). */
  leaving: number[];
  entering: number[];
  retained: number[];
}

export function switchRoles(transition: SwitchChoreography): LabSwitchRoles {
  "worklet";
  const byKey: Record<string, number[]> = {};
  const leaving: number[] = [];
  const entering: number[] = [];
  const retained: number[] = [];
  const entries = transition.entries;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const code =
      e.role === "leaving"
        ? ROLE_LEAVING
        : e.role === "entering"
          ? ROLE_ENTERING
          : e.role === "retained"
            ? ROLE_RETAINED
            : ROLE_ANCHOR;
    byKey[e.key] = [code, e.stagger, i];
    if (code === ROLE_LEAVING) leaving.push(i);
    else if (code === ROLE_ENTERING) entering.push(i);
    else if (code === ROLE_RETAINED) retained.push(i);
  }
  return {
    generation: transition.generation,
    byKey,
    leaving,
    entering,
    retained,
  };
}

/**
 * Class-ring visibility multiplier during a switch when the ring-trim effect
 * owns that key: a leaving ring is drawn by its unwinding trim ring instead
 * (0); an entering ring draws on as a trim ring and crossfades back into its
 * class style over the settle (settle amount).
 */
export function classRingSwitchFade(
  roles: LabSwitchRoles | null,
  key: string,
  signal: SwitchSignal | null,
  live: boolean,
): number {
  "worklet";
  if (!live || !roles || !signal || roles.generation !== signal.generation)
    return 1;
  const r = roles.byKey[key];
  if (!r) return 1;
  if (r[0] === ROLE_LEAVING) return 0;
  if (r[0] === ROLE_ENTERING) return settleAmount(signal);
  return 1;
}

/**
 * Trim ring for a leaving / entering key: [visible arc fraction 0..1 trailing
 * the body, alpha multiplier]. Leaving: the arc unwinds 1 → 0 across the
 * body's own shed window (reeled into the departing world). Entering: the arc
 * draws on 0 → 1 across its capture window, flashes as it locks, then fades as
 * the class ring crossfades back in over the settle.
 */
export function trimRingState(
  roles: LabSwitchRoles | null,
  key: string,
  signal: SwitchSignal | null,
  live: boolean,
): [number, number] {
  "worklet";
  if (!live || !roles || !signal || roles.generation !== signal.generation)
    return [0, 0];
  const r = roles.byKey[key];
  if (!r) return [0, 0];
  const p = signal.progress;
  if (r[0] === ROLE_LEAVING) {
    const u = clamp01((p - (SHED_START + r[1])) / (SHED_END - SHED_START));
    return [1 - smooth01(u), 1];
  }
  if (r[0] === ROLE_ENTERING) {
    const u = clamp01(
      (p - (CAPTURE_START + r[1])) / (CAPTURE_END - CAPTURE_START),
    );
    const flash = flareEnvelope(p, r[1]);
    return [smooth01(u), (1 - settleAmount(signal)) * (1 + 1.6 * flash)];
  }
  return [0, 0];
}

/**
 * Dissolve / flare uniforms for one body: [dissolve 0..1, capture flare 0..1].
 * Leaving bodies dissolve ahead of their opacity fade (u^0.7 so the noise front
 * is visible while the body is still mostly opaque).
 */
export function bodySwitchFx(
  roles: LabSwitchRoles | null,
  key: string,
  signal: SwitchSignal | null,
  live: boolean,
): [number, number] {
  "worklet";
  if (!live || !roles || !signal || roles.generation !== signal.generation)
    return [0, 0];
  const r = roles.byKey[key];
  if (!r) return [0, 0];
  if (r[0] === ROLE_LEAVING) {
    const u = clamp01(
      (signal.progress - (SHED_START + r[1])) / (SHED_END - SHED_START),
    );
    return [u > 0 ? u ** 0.7 : 0, 0];
  }
  if (r[0] === ROLE_ENTERING) return [0, flareEnvelope(signal.progress, r[1])];
  return [0, 0];
}

// --- Stateless particles ---------------------------------------------------------

/** Particles per leaving body for this switch (fits the fixed capacity). */
export function particlesPerBody(nLeaving: number, intensity: number): number {
  "worklet";
  if (nLeaving <= 0) return 0;
  const want = Math.round(
    PARTICLES_PER_BODY * (0.4 + 0.6 * clamp01(intensity)),
  );
  return Math.max(1, Math.min(want, Math.floor(PARTICLE_CAPACITY / nLeaving)));
}

/** One particle on screen: diameter (dp), alpha, hot-spark flag (0/1). */
export interface LabParticle {
  x: number;
  y: number;
  size: number;
  alpha: number;
  hot: number;
}

/**
 * Particle `slot` of a leaving body, a pure function of (seed, slot, progress,
 * stagger, the body's displayed screen pose, the sun's screen centre). Emitted
 * across the body's shed window from its disc, flung outward from the sun
 * with a spread, trailing behind it along its spin, shrinking and fading. Null
 * outside its life (never alive at or after PARTICLE_END).
 */
export function particleAt(
  seed: number,
  slot: number,
  progress: number,
  stagger: number,
  bx: number,
  by: number,
  br: number,
  cx: number,
  cy: number,
): LabParticle | null {
  "worklet";
  const h1 = fxHash(seed, slot + 0.11);
  const h2 = fxHash(seed + 1.7, slot + 0.37);
  const h3 = fxHash(seed + 3.1, slot + 0.59);
  const h4 = fxHash(seed + 5.3, slot + 0.83);
  const h5 = fxHash(seed + 7.9, slot + 0.29);
  const start = SHED_START + stagger + h1 * (SHED_END - SHED_START) * 0.8;
  const life = Math.min(0.14 + 0.22 * h2, PARTICLE_END - start);
  if (!(life > 0.01) || !(br > 0)) return null;
  const a = (progress - start) / life;
  if (a < 0 || a >= 1) return null;
  let ox = bx - cx;
  let oy = by - cy;
  const d = Math.sqrt(ox * ox + oy * oy);
  if (d > 1e-3) {
    ox /= d;
    oy /= d;
  } else {
    ox = Math.cos(h3 * 6.2831853);
    oy = Math.sin(h3 * 6.2831853);
  }
  // Trail = against the clockwise spin: (oy, −ox).
  const tx = oy;
  const ty = -ox;
  const spread = (h3 - 0.5) * 2.2;
  const cs = Math.cos(spread);
  const sn = Math.sin(spread);
  const dx = ox * cs - oy * sn;
  const dy = ox * sn + oy * cs;
  const ease = 1 - (1 - a) * (1 - a);
  const dist = br * (0.35 + 0.6 * h4 + (1.1 + 2.6 * h4) * ease);
  const trail = br * 2.4 * a * h5;
  return {
    x: bx + dx * dist + tx * trail,
    y: by + dy * dist + ty * trail,
    size: Math.max(1.8, br * (0.16 + 0.3 * h5) * (1 - 0.5 * a)),
    alpha: (1 - a) ** 1.5 * (0.55 + 0.45 * h2),
    hot: h4 > 0.74 ? 1 : 0,
  };
}

// --- Streak sprites (RSXform + rect buffer band selection) ---------------------

/** Streak texture: STREAK_BANDS rows of height STREAK_BAND_H, each a streak of
 * a different length (geometric from STREAK_MIN to STREAK_MAX texels), head at
 * the right end, core thickness STREAK_CORE texels. */
export const STREAK_BANDS = 32;
export const STREAK_BAND_H = 8;
export const STREAK_MIN = 8;
export const STREAK_MAX = 256;
export const STREAK_CORE = 3;

export function streakBandLength(band: number): number {
  "worklet";
  return STREAK_MIN * (STREAK_MAX / STREAK_MIN) ** (band / (STREAK_BANDS - 1));
}

/** Band whose streak length (texels) is nearest `texels` (log scale). */
export function streakBand(texels: number): number {
  "worklet";
  if (!(texels > STREAK_MIN)) return 0;
  const b = Math.round(
    (Math.log(texels / STREAK_MIN) / Math.log(STREAK_MAX / STREAK_MIN)) *
      (STREAK_BANDS - 1),
  );
  return Math.max(0, Math.min(STREAK_BANDS - 1, b));
}

/**
 * Placement of a streak sprite whose HEAD sits at (hx, hy), pointing along the
 * unit direction (dx, dy) (tail → head), with screen thickness `thick` dp and
 * length `len` dp. Returns [scos, ssin, tx, ty, band, bandLength].
 */
export function streakXform(
  hx: number,
  hy: number,
  dx: number,
  dy: number,
  thick: number,
  len: number,
): number[] {
  "worklet";
  const k = Math.max(1e-3, thick / STREAK_CORE);
  const band = streakBand(len / k);
  const w = streakBandLength(band);
  const sc = k * dx;
  const ss = k * dy;
  const half = STREAK_BAND_H / 2;
  return [
    sc,
    ss,
    hx - (sc * w - ss * half),
    hy - (ss * w + sc * half),
    band,
    w,
  ];
}

// --- Sky hue per System (owner glance C-05) ------------------------------------

/** starPalette candidates for a System's sky hue (index 3 violet = default). */
const SKY_HUE_CANDIDATES = [4, 2, 5, 3, 0, 1];

/**
 * Deterministic starPalette index for a System's sky (nebula lobe B). All
 * Contacts keeps the default so the home sky is unchanged; every other System
 * hashes its identity (kind + id/uid) — stable across launches, NOT across a
 * re-key (an owner decision: C-05).
 */
export function systemSkyIndex(
  system: OrrerySystemRef | null | undefined,
  paletteLength: number,
  fallback: number,
): number {
  if (!system || paletteLength <= 0) return fallback;
  if (system.kind === "builtin" && system.id === "all-contacts")
    return fallback;
  const id = system.kind === "builtin" ? system.id : system.uid;
  let h = 2166136261;
  const key = `${system.kind}:${id}`;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const pick = SKY_HUE_CANDIDATES[(h >>> 0) % SKY_HUE_CANDIDATES.length];
  return Math.min(pick, paletteLength - 1);
}

/** UI-thread sky-hue state: crossfade `from` → `to` for generation `gen`. */
export interface LabSkyHueState {
  from: number[];
  to: number[];
  gen: number;
}

/**
 * The displayed sky hue for the current signal. Robust to the order in which
 * the new transition (UI thread) and the new scene's hue (React) arrive: a
 * signal older than the hue target shows `from`, a newer one shows `to`.
 */
export function displayedSkyHue(
  state: LabSkyHueState,
  signal: SwitchSignal | null,
): number[] {
  "worklet";
  if (!signal) return state.to;
  if (signal.generation < state.gen) return state.from;
  if (signal.generation > state.gen) return state.to;
  const w = skyHueWeight(signal);
  return [
    state.from[0] + (state.to[0] - state.from[0]) * w,
    state.from[1] + (state.to[1] - state.from[1]) * w,
    state.from[2] + (state.to[2] - state.from[2]) * w,
  ];
}
