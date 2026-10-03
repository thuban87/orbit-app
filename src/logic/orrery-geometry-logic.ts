/**
 * Pure orrery geometry math (ORR-01) — RN/Skia/expo-free, deterministic,
 * node-tested first (the repo's `*-logic.ts` convention).
 *
 * D-12 (38.7): contacts sit ON their orbit line. The legacy screen-space
 * helpers (`OrreryMetrics`, `drawnRadius`, `driftPush`, `hitTest`,
 * `deriveOrreryMetrics`) and the decay/rogue drift spans they carried are
 * retired; world placement lives in `orrery-world-logic.ts` and projection,
 * hit-testing and sizing in `orrery-camera-logic.ts`.
 *
 * ANGLE MAP IS ONE SWAPPABLE FN (A2). `progressToAngle` ships the linear full-orbit
 * map (0→top, 0.5→bottom, wraps each interval). A device-UAT tuning call (13-08)
 * that prefers a top/bottom-emphasis curve replaces ONLY this function's body — no
 * signature, caller, constant, or test change. Rejecting A2 on device is a bounded
 * single-function edit, not a structural change.
 */

// ── Tunable geometry constants (world units; owner/planner-tunable). ─────────
/** Central star disc radius. */
export const SUN_RADIUS = 30;
/** Sun glow halo radius. */
export const SUN_GLOW_RADIUS = 54;
/** Planet photo-circle radius. */
export const PLANET_RADIUS = 16;
/** Hit-test radius (≥44px-diameter tap target). */
export const HIT_RADIUS = 24;

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
 * The shortest signed angular delta from `from` to `to`, normalised into
 * [−π, π] — so interpolating 350°→10° goes +20°, not −340° (Pitfall 2). Camera recovery can interpolate
 * `from + t · shortestAngleDelta(from, to)` through the shortest yaw arc.
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
