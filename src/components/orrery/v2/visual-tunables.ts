/**
 * 38.7-09: the Orrery V2 environment and orbit look as single-number
 * tunables (CLAUDE.md: tuning is a one-number edit). No colour lives here —
 * every ink is an `orrery*` theme token (D-51); these are strengths, counts,
 * sizes and speeds only.
 *
 * Owner checkpoints set GRID_OPACITY (D-09) and PULSE_INTENSITY (D-10); see
 * the phase 38.7 planning record 38.7-VISUAL-TUNING.md for the rulings.
 */
import type { ResolvedMode, ThemePackage } from "@/theme/theme-types";

// ── Painted sky (D-07, D-27, D-36) ────────────────────────────────────────

/** One package × mode's sky look. */
export interface SkyLook {
  /** Small background stars. */
  starCount: number;
  /** Larger, brighter stars on top (part of "more visible stars", D-07). */
  brightStarCount: number;
  /** Small star radius range (dp). */
  starRadius: readonly [number, number];
  /** Bright star radius range (dp). */
  brightRadius: readonly [number, number];
  /** Star alpha range before the twinkle. */
  starAlpha: readonly [number, number];
  /** Twinkle depth: the share of a star's alpha the twinkle swings (0 = still). */
  twinkleDepth: number;
  /** Peak nebula alpha baked into the neutral sky image (quiet: D-07/D-27). */
  nebulaStrength: number;
  /**
   * How far the per-System tint pushes the nebula toward its hue (0..1;
   * additive on dark, a src-over lerp on light).
   */
  tintStrength: number;
  /** A faint whole-sky wash of the System tint (0..1). */
  tintWash: number;
  /** Where the horizon→base gradient reaches the base (0..1 of the height). */
  horizonStop: number;
}

/**
 * Per package × mode. Galaxy: deeper, more stars (more than Lab A's 240 + 70),
 * a quieter nebula than Lab A and much quieter than Lab B. Standard: Lab B's
 * calm graphite chart (sparse crisp stars, barely-there clouds). Light: Lab B's
 * light sky (sparse ink specks, no twinkle, low-contrast washes).
 */
export const SKY_LOOKS: Readonly<
  Record<ThemePackage, Readonly<Record<ResolvedMode, SkyLook>>>
> = {
  galaxy: {
    dark: {
      starCount: 300,
      brightStarCount: 60,
      starRadius: [0.45, 1.05],
      brightRadius: [1.1, 1.8],
      starAlpha: [0.35, 0.9],
      twinkleDepth: 0.45,
      nebulaStrength: 0.22,
      tintStrength: 0.35,
      tintWash: 0.05,
      horizonStop: 0.6,
    },
    light: {
      starCount: 110,
      brightStarCount: 14,
      starRadius: [0.45, 0.9],
      brightRadius: [0.9, 1.3],
      starAlpha: [0.25, 0.5],
      twinkleDepth: 0,
      nebulaStrength: 0.3,
      tintStrength: 0.3,
      tintWash: 0.05,
      horizonStop: 0.6,
    },
  },
  standard: {
    dark: {
      starCount: 170,
      brightStarCount: 26,
      starRadius: [0.45, 0.95],
      brightRadius: [1, 1.5],
      starAlpha: [0.3, 0.75],
      twinkleDepth: 0.12,
      nebulaStrength: 0.1,
      tintStrength: 0.3,
      tintWash: 0.04,
      horizonStop: 0.65,
    },
    light: {
      starCount: 80,
      brightStarCount: 8,
      starRadius: [0.45, 0.85],
      brightRadius: [0.85, 1.2],
      starAlpha: [0.22, 0.42],
      twinkleDepth: 0,
      nebulaStrength: 0.22,
      tintStrength: 0.25,
      tintWash: 0.04,
      horizonStop: 0.65,
    },
  },
};

/** Twinkle phase groups (stars are drawn in batches; each batch has a phase). */
export const SKY_TWINKLE_GROUPS = 3;
/** Twinkle angular speed (rad/ms) → ~2.6 s period, as before 38.7-09. */
export const SKY_TWINKLE_SPEED = 0.0024;

/** Sky drift: path speed (dp per minute) and the wander's bound (dp). */
export const SKY_DRIFT_DP_PER_MIN = 6;
export const SKY_DRIFT_MAX_DP = 10;
/** Parallax: dp of sky shift per screen-width of pan (nebula / stars). */
export const SKY_PARALLAX_NEBULA = 4;
export const SKY_PARALLAX_STARS = 7;
/** Parallax bound (dp). */
export const SKY_PARALLAX_MAX_DP = 22;
/** The margin the sky covers beyond each canvas edge (covers both offsets). */
export const SKY_MARGIN_DP = SKY_PARALLAX_MAX_DP + SKY_DRIFT_MAX_DP + 4;

/** Neutral sky bake resolution (texels per dp; the nebula is soft). */
export const SKY_BAKE_PX_PER_DP = 0.25;
/** The bake's longest side is capped at this many texels. */
export const SKY_BAKE_MAX_PX = 256;
/** Canvas sizes are bucketed to this step (dp) for the bake cache key. */
export const SKY_SIZE_BUCKET_DP = 64;
/** The sky's star-field seed (fixed: the sky is the same every visit). */
export const SKY_STAR_SEED = 38;

// ── Orbital-plane grid (D-09) ─────────────────────────────────────────────

/** Grid line opacity; 0 = the grid is not drawn at all. Owner: G-GRID. */
export const GRID_OPACITY = 0.12;
/** Concentric guides across the outermost ring. */
export const GRID_RINGS = 6;
/** Radial spokes (every 360 / GRID_SPOKES degrees). */
export const GRID_SPOKES = 12;
/** Grid line half-width (screen dp). */
export const GRID_HALF_WIDTH_DP = 0.4;
/** The grid reaches this far past the outermost orbit (× its radius). */
export const GRID_EXTENT = 1.12;

// ── Orbit pulses (D-10, D-37, D-49) ───────────────────────────────────────

/** Peak pulse alpha ("not very obvious"). Owner: G-PULSE. */
export const PULSE_INTENSITY = 0.25;
/** Most pulses on screen at once; 0 = none. */
export const PULSE_BUDGET = 8;
/** Pulse travel speed along its ring (screen-independent: radians per second). */
export const PULSE_SPEED = 0.35;
/** One pulse's soft arc length (radians of its ring). */
export const PULSE_ARC = 0.55;
/** Pulse cycle: travel time plus rest, so each ring pulses now and then (ms). */
export const PULSE_CYCLE_MS = 9000;
/** Pulse line half-width over the ring's own half-width (a soft halo). */
export const PULSE_WIDTH_SCALE = 1.8;

// ── Thin sun-lit rings (D-11) ─────────────────────────────────────────────

/** Ring line width scale over today's status widths (Lab B thin lines). */
export const RING_WIDTH_SCALE = 0.5;
/** Ring line width floor (dp), so weight still orders status. */
export const RING_WIDTH_BASE = 0.35;
/** Sun-lit rim: alpha gain on the sun-facing side (dark / light). */
export const RING_RIM_GAIN = { dark: 0.6, light: 0.35 } as const;
/** Sun-lit rim: how far the ink moves toward `orreryRingLight` (dark / light). */
export const RING_RIM_MIX = { dark: 0.35, light: 0.2 } as const;
