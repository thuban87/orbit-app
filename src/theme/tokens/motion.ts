/**
 * Motion tokens (UI-SPEC Motion Tokens — THEME-06).
 *
 * PURE DATA — no react-native import, no colour literal, node-importable.
 * Consumers import `@/theme/tokens/motion` directly (no barrel edit); the
 * reduced-motion signal that gates ambient motion lives in
 * `@/theme/use-reduced-motion`.
 *
 * `MOTION.fast/base/slow` are durations in MILLISECONDS. `MOTION.ambient` is a
 * per-second SPEED constant — a drift/angular RATE the Orrery worklet
 * multiplies into its `useDerivedValue`, deliberately NOT a duration, so the
 * Plan 04 ↔ Plan 06 seam consumes it without a unit mismatch.
 *
 * EASING carries pure-data DESCRIPTORS (`"inOut"` / `"out"`), not live `Easing`
 * functions — importing react-native-reanimated's `Easing` here would break the
 * node-importable / RN-free contract. The consuming surface maps a descriptor
 * to `Easing.inOut(Easing.ease)` / `Easing.out(Easing.ease)` at the call site.
 */

// --- Tunable ambient constants (single-number edits) -----------------------
// Radians per second — a very slow ambient drift/twinkle rate for the Galaxy
// background and Orrery. Lower = slower. At ~0.15 rad/s a full 2π sweep is ~42s,
// inside the UI-SPEC "very slow (8–30s loops)" ambient band for partial cycles.
const AMBIENT_SPEED = 0.15;

export const MOTION = {
  /** Taps, toggles, chip selection (ms). */
  fast: 120,
  /** Panel/sheet open, crossfades (ms). */
  base: 200,
  /** Full-screen transitions, morphs (ms). */
  slow: 320,
  /**
   * Ambient drift/twinkle SPEED — a per-second RATE (radians/s), NOT a
   * duration. The Orrery/Galaxy worklet multiplies this into `useDerivedValue`.
   */
  ambient: AMBIENT_SPEED,
} as const;

export type MotionToken = keyof typeof MOTION;

export const EASING = {
  /** `Easing.inOut(Easing.ease)` — default. */
  standard: "inOut",
  /** `Easing.out(Easing.ease)` — enter. */
  decelerate: "out",
} as const;

export type EasingToken = keyof typeof EASING;
