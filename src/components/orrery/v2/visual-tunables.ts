/**
 * 38.7-09: the Orrery V2 environment and orbit look as single-number
 * tunables (CLAUDE.md: tuning is a one-number edit). No colour lives here —
 * every ink is an `orrery*` theme token (D-51); these are strengths, counts,
 * sizes and speeds only.
 *
 * Owner rulings (2026-10-03, 38.7-09): the grid "weaker" (D-09) and the
 * pulses "as in Lab B" (D-10); see the phase 38.7 planning record
 * 38.7-VISUAL-TUNING.md `## Rulings`.
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

/**
 * Grid line opacity; 0 = the grid is not drawn at all. Owner G-GRID
 * (2026-10-03): "weaker" — a step below Lab C's 0.35 / 1.2 dp look.
 */
export const GRID_OPACITY = 0.15;
/** Guide circles across the grid's reach (Lab C's polar grid: 9). */
export const GRID_RINGS = 9;
/** Radial spokes (every 360 / GRID_SPOKES degrees; Lab C: 24). */
export const GRID_SPOKES = 24;
/** Grid line half-width (screen dp). Owner G-GRID "weaker". */
export const GRID_HALF_WIDTH_DP = 1.0;
/** The grid reaches this far past the outermost orbit (× its radius). */
export const GRID_EXTENT = 1.12;

// ── Orbit pulses (D-10, D-37, D-49) ───────────────────────────────────────

/*
 * Owner G-PULSE (2026-10-03): "as in Lab B" — Lab B's full FLOW look, which
 * supersedes the earlier "not very obvious" wording of D-10.
 */
/** Peak pulse alpha. */
export const PULSE_INTENSITY = 0.55;
/** Most pulses on screen at once (D-49 budget); 0 = none. */
export const PULSE_BUDGET = 40;
/** Pulse travel speed along its ring (radians per second, clockwise). */
export const PULSE_SPEED = 0.15;
/** One pulse slot's cycle: it travels, then rests (ms). */
export const PULSE_CYCLE_MS = 12000;
/**
 * The travelling part of each cycle (ms); the pulse fades in and out. Equal
 * to the cycle: always travelling, as in Lab B (no rest).
 */
export const PULSE_TRAVEL_MS = 12000;
/** Half the pulse's soft arc (radians of its ring). */
export const PULSE_ARC_HALF = 0.5;
/** Pulse line half-width (screen dp): the same for every status (D-10). */
export const PULSE_HALF_WIDTH_DP = 1.0;

// ── Thin sun-lit rings (D-11; Lab B labb-rings-logic) ─────────────────────

/**
 * Ring line width = today's status width × RING_WIDTH_SCALE + RING_WIDTH_BASE
 * (Lab B's ratios, so weight still orders status: stable 2 → 1.04 dp,
 * wobble/rogue 3 → 1.46 dp, decay 4 → 1.88 dp).
 */
export const RING_WIDTH_SCALE = 0.42;
export const RING_WIDTH_BASE = 0.2;
/** Dashed (wobble): period (screen dp) and on-fraction. */
export const RING_DASHED_PERIOD_DP = 11;
export const RING_DASHED_DUTY = 0.58;
/** Faint trace (rogue): period (screen dp) and on-fraction. */
export const RING_TRACE_PERIOD_DP = 6;
export const RING_TRACE_DUTY = 0.3;
/** Status alphas (Lab B): faded (decay) and faint trace (rogue). */
export const RING_FADED_ALPHA = 0.7;
export const RING_TRACE_ALPHA = 0.42;
/** Sun light reaches this fraction of the outermost orbit (Lab B R2). */
export const RING_SUN_LIGHT_RADIUS = 0.32;

/** One package × mode's ring lighting. */
export interface RingLook {
  /** Sun-light alpha gain at the sun (0 = no sun light). */
  lightGain: number;
  /** How far lit rings lean toward `orreryRingLight` (× the light). */
  lightMix: number;
  /** Far-side alpha at full perspective (1 = no depth fade). */
  farAlpha: number;
}

/** Lab B's R2 sun light (Galaxy Dark the hero, Standard calmer, light softer). */
export const RING_LOOKS: Readonly<
  Record<ThemePackage, Readonly<Record<ResolvedMode, RingLook>>>
> = {
  galaxy: {
    dark: { lightGain: 1.1, lightMix: 0.35, farAlpha: 0.55 },
    light: { lightGain: 0.35, lightMix: 0.35, farAlpha: 0.6 },
  },
  standard: {
    dark: { lightGain: 0.6, lightMix: 0.35, farAlpha: 0.55 },
    light: { lightGain: 0.35, lightMix: 0.35, farAlpha: 0.6 },
  },
};
