/**
 * Pure orrery geometry math (ORR-01 / ORR-04) — the correctness-critical layer
 * the Skia render surface (13-05 render / hit-test, 13-07 drag) is a thin
 * consumer of. RN/Skia/expo-free, deterministic, node-tested first — the repo's
 * `*-logic.ts` convention (`favourites-reorder-logic`, `birthday-logic`,
 * `compose-logic`).
 *
 * SINGLE-SOURCED STATUS CUTOFFS (Pitfall 1). The status buckets — `WOBBLE_MAX`
 * (decay band start), `ROGUE_K` (decay band end / rogue threshold) — are IMPORTED
 * from `@/db/status`, never re-typed here. They are the SAME numbers the query-
 * time engine and the notify path read; a local copy would drift silently. (This
 * module does not itself bucket a raw `progress` into a status — it receives the
 * already-computed `ProfileStatus` — but `drawnRadius` needs `WOBBLE_MAX`/`ROGUE_K`
 * to size the decay-band drift, so it imports them.)
 *
 * ONE MEASURED-CANVAS METRICS OBJECT (H2). `deriveOrreryMetrics(w, h, n)` is the
 * SINGLE source of responsive layout: it computes `cx`/`cy`/`DRIFT_MAX`/
 * `effectiveGap` from the MEASURED canvas dimensions + body count, folds in the
 * fixed geometry constants, and returns ONE object threaded to render, hit-test,
 * drag-preview and drag-release rank mapping. Every consumer reads spacing via the
 * SINGLE canonical pair `C.ringInner` / `C.effectiveGap`.
 *
 * NO RAW-GAP ALIAS (C2-6). The top-of-file `RING_INNER_SEED` / `RING_GAP_SEED` are
 * module-private INPUTS to `deriveOrreryMetrics` only; the metrics object exposes
 * NO `RING_INNER`/`RING_GAP` key. An executor therefore cannot wire the raw fixed
 * gap into one consumer and the (possibly compressed) `effectiveGap` into another —
 * there is exactly one spacing pair on the object every consumer must read.
 *
 * SAFE DIVISION DOMAIN (C2-4). `effectiveGap` is clamped to a positive `MIN_GAP`
 * floor, so on any canvas — short, degenerate, or a transient-zero first frame
 * where `DRIFT_MAX − ringInner ≤ 0` — it is ALWAYS > 0. The 13-07 drag-release
 * rank map `(releaseRadius − C.ringInner) / C.effectiveGap` can never divide by
 * zero or a negative.
 *
 * ANGLE MAP IS ONE SWAPPABLE FN (A2). `progressToAngle` ships the linear full-orbit
 * map (0→top, 0.5→bottom, wraps each interval). A device-UAT tuning call (13-08)
 * that prefers a top/bottom-emphasis curve replaces ONLY this function's body — no
 * signature, caller, constant, or test change. Rejecting A2 on device is a bounded
 * single-function edit, not a structural change.
 */

import type { ProfileStatus } from "@/db/contact-status-read";
import { ROGUE_K, WOBBLE_MAX } from "@/db/status";

// ── Tunable geometry constants (device px; owner/planner-tunable, UI-SPEC Canvas
//    Geometry table). Seeds feeding deriveOrreryMetrics + the fixed constants it
//    folds into the metrics object. ────────────────────────────────────────────
/** Central star disc radius. */
export const SUN_RADIUS = 30;
/** Sun glow halo radius. */
export const SUN_GLOW_RADIUS = 54;
/** Innermost orbit radius (rank 0) — module-private seed (C2-6: no object alias). */
const RING_INNER_SEED = SUN_RADIUS + 28; // 58
/** Uncompressed radial gap between successive ranks — module-private seed (C2-6). */
export const RING_GAP_SEED = 34;
/** Positive floor for effectiveGap (C2-4) — guarantees a safe, > 0 divisor. */
export const MIN_GAP = 8;
/** Planet photo-circle radius. */
export const PLANET_RADIUS = 16;
/** Hit-test radius (≥44px-diameter tap target). */
export const HIT_RADIUS = 24;
/** View-morph duration (ms). */
export const MORPH_MS = 500;
/** Outward drift span accrued across the full decay band [WOBBLE_MAX, ROGUE_K). */
export const DECAY_DRIFT_SPAN = 40;
/** Fixed outward drift for a rogue body — the furthest push (before DRIFT_MAX clamp). */
export const ROGUE_DRIFT_SPAN = 80;

/** The shared measured-canvas metrics object every orrery consumer threads (H2). */
export interface OrreryMetrics {
  /** Canvas centre x (= canvasWidth / 2). */
  cx: number;
  /** Canvas centre y (= canvasHeight / 2). */
  cy: number;
  /** Absolute drawn-radius bound — a body never draws beyond this (on-screen + tappable). */
  DRIFT_MAX: number;
  /** Innermost orbit radius (rank 0) — the ONLY canonical inner-radius key (C2-6). */
  ringInner: number;
  /** Radial gap per rank, possibly compressed, always > 0 (C2-4) — the ONLY canonical gap key. */
  effectiveGap: number;
  PLANET_RADIUS: number;
  SUN_RADIUS: number;
  SUN_GLOW_RADIUS: number;
  HIT_RADIUS: number;
  MORPH_MS: number;
  DECAY_DRIFT_SPAN: number;
  ROGUE_DRIFT_SPAN: number;
}

/** A placed body for hit-testing — screen-space centre + its contact id. */
export interface OrreryBody {
  id: number;
  x: number;
  y: number;
  /**
   * The body's effective outward drift above its ring (`driftPush`), carried on
   * the drag snapshot so the release-rank map can invert it (WR-01). Optional —
   * hit-testing ignores it; only the 13-07 drag path reads it.
   */
  push?: number;
}

/**
 * Map interval progress (elapsed ÷ interval, PROGRESS_SQL) to a screen angle:
 * 0 at 12 o'clock, clockwise, one full interval = one revolution, wrapping each
 * interval. `progress mod 1` via floor is negative-safe. A2 — swap ONLY this body
 * to retune the sweep shape.
 */
export function progressToAngle(progress: number): number {
  const frac = progress - Math.floor(progress); // progress mod 1, always ≥ 0
  return frac * 2 * Math.PI; // 0→top, 0.5→bottom (6 o'clock), 1→top
}

/**
 * Project polar (radius, angle) to screen x/y — clockwise from the top on a
 * y-grows-down screen: angle 0 → (cx, cy−r), π/2 → (cx+r, cy), π → (cx, cy+r).
 */
export function polarToXY(
  cx: number,
  cy: number,
  radius: number,
  angle: number,
): { x: number; y: number } {
  return {
    x: cx + radius * Math.sin(angle),
    y: cy - radius * Math.cos(angle),
  };
}

/**
 * The on-ring radius for a rank — the SHARED axis, fixed across the morph. Reads
 * the canonical `C.ringInner` / `C.effectiveGap` (C2-6), never a raw fixed seed,
 * so the same (possibly compressed) gap governs every consumer.
 */
export function ringRadius(rank: number, C: OrreryMetrics): number {
  return C.ringInner + rank * C.effectiveGap;
}

/**
 * The DRAWN radius of a body = its ring radius + an outward drift push carrying
 * overdue-ness, hard-clamped to `C.DRIFT_MAX` so a far-out rank + rogue push can
 * never leave the screen (ORR-04 — always on-screen & tappable).
 *
 * - stable / wobble → sit exactly on their ring (no push).
 * - decay (progress ∈ [WOBBLE_MAX, ROGUE_K)) → push grows 0→DECAY_DRIFT_SPAN
 *   linearly across the band (A3 tunable curve).
 * - rogue (progress ≥ ROGUE_K, or rarely_responds) → a fixed ROGUE_DRIFT_SPAN push.
 */
export function drawnRadius(
  progress: number,
  rank: number,
  status: ProfileStatus,
  C: OrreryMetrics,
): number {
  const base = ringRadius(rank, C);
  let push = 0;
  if (status === "decay") {
    const t = (progress - WOBBLE_MAX) / (ROGUE_K - WOBBLE_MAX); // 0→1 across the band
    push = clamp01(t) * C.DECAY_DRIFT_SPAN;
  } else if (status === "rogue") {
    push = C.ROGUE_DRIFT_SPAN; // furthest
  }
  return Math.min(base + push, C.DRIFT_MAX); // hard clamp → always on-screen
}

/**
 * The EFFECTIVE outward drift a body is DRAWN above its ring (13-07 drag-release
 * inversion) — `drawnRadius − ringRadius`, i.e. the push AFTER the DRIFT_MAX clamp
 * render applies, so a rim-clamped body reports its true (reduced) offset, not the
 * nominal decay/rogue span. The drag-release rank map subtracts THIS from the
 * finger radius so a drifted (decay/rogue) body inverts back to its OWN ring: a
 * no-move release is net-zero for EVERY body, clamped or not. Reuses drawnRadius/
 * ringRadius — the SAME push render applies — never a re-derived drift formula.
 */
export function driftPush(
  progress: number,
  rank: number,
  status: ProfileStatus,
  C: OrreryMetrics,
): number {
  return drawnRadius(progress, rank, status, C) - ringRadius(rank, C);
}

/**
 * Relationship-view resting angle — a uniform `index/count` spread (A4). The rings
 * already separate everyone by radius, so the angle axis is free. count 0 → 0.
 */
export function evenSpreadAngle(index: number, count: number): number {
  return count > 0 ? (index / count) * 2 * Math.PI : 0;
}

/**
 * Nearest body within `HIT_RADIUS` of (px, py), or null when the tap is outside
 * every body. `≤` on the running-best distance means the LAST body in the array
 * (the top-drawn one) wins ties / exact overlaps. Empty bodies → null.
 */
export function hitTest(
  px: number,
  py: number,
  bodies: OrreryBody[],
  hitRadius: number,
): number | null {
  let best: number | null = null;
  let bestD2 = hitRadius * hitRadius;
  for (const b of bodies) {
    const d2 = (px - b.x) ** 2 + (py - b.y) ** 2;
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = b.id; // ≤ so the last-drawn (top) body wins ties
    }
  }
  return best;
}

/**
 * The shortest signed angular delta from `from` to `to`, normalised into
 * [−π, π] — so interpolating 350°→10° goes +20°, not −340° (Pitfall 2). The morph
 * interpolates `from + t · shortestAngleDelta(from, to)` to take the short way
 * round the wrap.
 */
export function shortestAngleDelta(from: number, to: number): number {
  const TWO_PI = 2 * Math.PI;
  let d = (to - from) % TWO_PI;
  if (d > Math.PI) {
    d -= TWO_PI;
  } else if (d < -Math.PI) {
    d += TWO_PI;
  }
  return d;
}

/**
 * The SINGLE source of measured-canvas responsive layout (H2). Computes the
 * centre, the absolute `DRIFT_MAX` drawn-radius bound, and the per-rank
 * `effectiveGap` from the MEASURED canvas dimensions + body count, and folds in
 * the fixed geometry constants — returning ONE object every consumer threads.
 *
 * `effectiveGap = max(MIN_GAP, min(RING_GAP_SEED, (DRIFT_MAX − ringInner) / (n−1)))`:
 *  - Small n (no overflow): the `min` keeps it at `RING_GAP_SEED`.
 *  - Large n (overflow): the `min` compresses it proportionally so the furthest
 *    ring `ringInner + (n−1)·effectiveGap` stays ≤ `DRIFT_MAX`.
 *  - C2-4: the `max(MIN_GAP, …)` floor keeps it strictly > 0 on any canvas —
 *    including a short/degenerate/transient-zero one where `DRIFT_MAX − ringInner`
 *    is ≤ 0 — so no downstream division by `effectiveGap` hits zero or a negative.
 *
 * C2-6: the raw `RING_INNER_SEED`/`RING_GAP_SEED` are consumed HERE only; the
 * returned object surfaces spacing solely as `ringInner`/`effectiveGap`.
 */
export function deriveOrreryMetrics(
  canvasWidth: number,
  canvasHeight: number,
  bodyCount: number,
): OrreryMetrics {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const DRIFT_MAX = Math.min(cx, cy) - PLANET_RADIUS - 8;
  const ringInner = RING_INNER_SEED;
  const span = DRIFT_MAX - ringInner;
  const denom = Math.max(bodyCount - 1, 1);
  const effectiveGap = Math.max(MIN_GAP, Math.min(RING_GAP_SEED, span / denom));
  return {
    cx,
    cy,
    DRIFT_MAX,
    ringInner,
    effectiveGap,
    PLANET_RADIUS,
    SUN_RADIUS,
    SUN_GLOW_RADIUS,
    HIT_RADIUS,
    MORPH_MS,
    DECAY_DRIFT_SPAN,
    ROGUE_DRIFT_SPAN,
  };
}

/** Clamp a value into [0, 1]. */
function clamp01(t: number): number {
  if (t < 0) {
    return 0;
  }
  if (t > 1) {
    return 1;
  }
  return t;
}
