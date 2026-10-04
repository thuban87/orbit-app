/**
 * 38.7-09: the Orrery V2 environment and orbit look as single-number
 * tunables (CLAUDE.md: tuning is a one-number edit). No colour lives here —
 * every ink is an `orrery*` theme token (D-51); these are strengths, counts,
 * sizes and speeds only.
 *
 * Owner rulings (2026-10-03, 38.7-09): the grid "weaker" (D-09) and the
 * pulses "as in Lab B" (D-10); (38.7-10) faces "fine", wash-out "stronger",
 * the sun's shimmer "as in Lab A", the moon bump "as is"; see the phase 38.7
 * planning record 38.7-VISUAL-TUNING.md `## Rulings` and
 * `## Body rulings`.
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

// ── Moons and the far-zoom bump (38.7-10: D-31, D-54) ─────────────────────

/*
 * The bump is new (no lab drew one; HARVEST-MAP class N). It reads as a moon
 * peeking over the parent's rim: a half-disc in the moon ink, a touch smaller
 * than a split moon (MIN_SATELLITE_PX 10 → 5 dp radius) so it never reads as a
 * second body, and clearly larger than nothing at phone size. Owner G-BUMP
 * (2026-10-03, 38.7-10): "as is", with the D-47 split-by-zoom / names-by-size
 * difference accepted.
 */
/** Bump radius (screen dp) for a parent with one moon. */
export const MOON_BUMP_RADIUS_DP = 4;
/** Extra radius (dp) per additional moon. */
export const MOON_BUMP_STEP_DP = 0.75;
/** The bump never grows past this radius (dp). */
export const MOON_BUMP_MAX_DP = 6;

// ── Stack pips (38.7-10: D-54; Lab A deep-field-config §6) ────────────────

/** Pip radius (screen dp), Lab A STACK_PIP_R. */
export const PIP_RADIUS_DP = 3.2;
/** The dark plate ring around each pip (dp beyond the pip), Lab A. */
export const PIP_PLATE_DP = 1.3;
/** Plate alpha (Lab A: the background at 0.95). */
export const PIP_PLATE_ALPHA = 0.95;
/** Angular spacing between pips (radians), Lab A STACK_PIP_STEP. */
export const PIP_STEP = 0.42;
/**
 * Where the pips centre when the body has no moon bump (radians, screen
 * convention: −0.75 is up-right, Lab A STACK_PIP_ANGLE). With a bump they
 * centre on the opposite side (D-54).
 */
export const PIP_ANCHOR = -0.75;
/** How far a pip's centre sits outside the rim (× its radius), Lab A. */
export const PIP_OUTSET = 0.35;
/** The overflow ("more") marker: ring stroke width (dp) and inset (dp). */
export const PIP_MORE_STROKE_DP = 1.2;
export const PIP_MORE_INSET_DP = 0.6;

// ── Lit status bodies (38.7-10: D-13, D-14; Lab B labb-effects BODY_LIT) ──

/** How the sun lights a face. */
export interface FaceLight {
  /**
   * The darkest a face gets on its night side (0..1; 1 = no shading at all).
   * Lab B used 0.55 (dark) / 0.75 (light): the owner found that too dark.
   */
  floor: number;
  /** Light elevation out of the screen (higher = more frontal, softer terminator). */
  lightZ: number;
  /** Wrap lighting: softens the terminator (0 = hard Lambert). */
  wrap: number;
}
/**
 * The face shading per resolved mode (D-13). Owner G-FACE (2026-10-03,
 * 38.7-10): "fine" — the "current lighter" values (floor >= 0.8 on dark,
 * z 0.9, wrap 0.5) stay; the Lab B, halfway and flat options were dropped.
 */
export const FACE_LIGHT: Readonly<Record<ResolvedMode, FaceLight>> = {
  dark: { floor: 0.85, lightZ: 0.9, wrap: 0.5 },
  light: { floor: 0.9, lightZ: 0.9, wrap: 0.5 },
};

/** One mode's status rim + atmosphere (Lab B DARK_BODIES / LIGHT_BODIES). */
export interface BodyLook {
  /** Crisp inner status rim width (dp) and its strength (0..1). */
  rimDp: number;
  rimStrength: number;
  /** Fresnel limb in the rim ink. */
  fresnel: number;
  /** Status atmosphere strength (× the status material's). */
  atmosphere: number;
  /** 0 = plain src-over glow, 1 = fully additive-looking (dark themes only). */
  atmosphereAdditive: number;
  /** Specular glint strength. */
  spec: number;
}
/**
 * Lab B's approved rim + atmosphere look, per resolved mode (D-14). Owner
 * G-RIM is OPEN (2026-10-03, 38.7-10): the owner is clarifying; these are
 * the "as in Lab B" values.
 */
export const BODY_LOOKS: Readonly<Record<ResolvedMode, BodyLook>> = {
  dark: {
    rimDp: 1.5,
    rimStrength: 0.9,
    fresnel: 0.35,
    atmosphere: 0.85,
    atmosphereAdditive: 0.65,
    spec: 0.14,
  },
  light: {
    rimDp: 2,
    rimStrength: 1,
    fresnel: 0.28,
    atmosphere: 0.22,
    atmosphereAdditive: 0,
    spec: 0.08,
  },
};
/**
 * The atmosphere's reach (× the body radius). Must stay ≤ the 1.3 culling
 * reach of `projectAnimatedFrame` (Lab B BODY_REACH).
 */
export const BODY_ATMOSPHERE_REACH = 1.3;
/**
 * How far the status rim / glow lean toward the `orreryRim` / `orreryGlow`
 * tokens (0 = the pure status colour, Lab B's look).
 */
export const BODY_RIM_TOKEN_MIX = 0;
export const BODY_GLOW_TOKEN_MIX = 0;

/**
 * How much a decay or rogue contact's photo / swatch is desaturated
 * (0 = off). Owner G-DESAT (2026-10-03, 38.7-10): "stronger" — rogue almost
 * grey, decay clearly muted (Lab B's C-16 values were 0.25 / 0.45). Only these
 * two statuses are ever desaturated.
 */
export const DECAY_DESATURATION = 0.6;
export const ROGUE_DESATURATION = 0.9;

/**
 * Per status: atmosphere, Fresnel and glint multipliers (Lab B
 * labBodyMaterial). Rogue: no atmosphere — drawn cold (D-14).
 */
export const STATUS_MATERIALS = {
  stable: { atmosphere: 1, fresnel: 1, spec: 1 },
  wobble: { atmosphere: 1, fresnel: 1, spec: 1 },
  decay: { atmosphere: 0.4, fresnel: 0.55, spec: 0.6 },
  rogue: { atmosphere: 0, fresnel: 0.3, spec: 0.3 },
  none: { atmosphere: 0, fresnel: 0, spec: 0 },
} as const;

// ── The star sun (38.7-10: D-15, D-37; Lab A deep-field-config §5) ────────

/** Corona quad half-size (× the sun radius), Lab A CORONA_EXTENT. */
export const SUN_CORONA_EXTENT = 2.7;
/** Corona intensity, dark / light (Lab A CORONA_ALPHA_DARK / _LIGHT). */
export const SUN_CORONA_ALPHA = { dark: 1, light: 0.85 } as const;
/**
 * D-37: the corona and granulation do not churn. Their shader time is a
 * fixed phase (Lab A's still frame: 1.7 corona, 2.3 granulation) that swings
 * ± these amounts with the existing sun pulse only; still under reduced motion.
 * Owner G-SUN (2026-10-03, 38.7-10): the shimmer "as in Lab A".
 */
export const SUN_CORONA_TIME = 1.7;
export const SUN_CORONA_SWING = 0.5;
export const SUN_GRANULE_TIME = 2.3;
export const SUN_GRANULE_SWING = 0.3;
/** The fine limb line just outside the disc (world units), Lab A. */
export const SUN_LIMB_GAP = 1;

// ── Focus: the reticle, dim-the-rest, the card-occlusion dim (38.7-11) ────

/**
 * D-18 (owner, 2026-10-03: "the reticle that the labs used … not this solid
 * circle"): Lab A's focus reticle (`reticle-draw.ts`, deep-field-config §6),
 * the corner-bracket instrument both Labs A and B drew, in the
 * `orreryReticle` token. Authored in screen dp around the DRAWN disc so it is
 * the same weight at every zoom.
 *   - bracket box half-size = drawn + max(RETICLE_GAP, drawn × RETICLE_GAP_FRAC)
 *   - arm = clamp(half × RETICLE_ARM_FRAC, RETICLE_ARM_MIN, RETICLE_ARM_MAX)
 */
export const RETICLE_GAP = 5;
export const RETICLE_GAP_FRAC = 0.16;
export const RETICLE_ARM_FRAC = 0.34;
export const RETICLE_ARM_MIN = 6;
export const RETICLE_ARM_MAX = 15;
/** Bracket stroke (dp). */
export const RETICLE_STROKE_DP = 2;
/** The thin lock ring just outside the disc (dp) and its alpha. */
export const RETICLE_RING_DP = 3.5;
export const RETICLE_RING_ALPHA = 0.55;
/** The four cardinal instrument ticks outside the lock ring (dp). */
export const RETICLE_TICK_DP = 4;
/**
 * The bright arc on the lock ring (radians of span). Lab A swept it round on
 * the ambient clock; D-37 allows no idle reticle motion, so it sweeps in
 * during the lock-on (RETICLE_SCAN_SWEEP) and then parks at RETICLE_SCAN_PARK
 * (radians clockwise from 12 o'clock).
 */
export const RETICLE_SCAN_ARC = 0.8;
export const RETICLE_SCAN_SWEEP = Math.PI;
export const RETICLE_SCAN_PARK = Math.PI / 4;
/**
 * The lock-on (Lab A): over RETICLE_LOCK_MS the brackets converge from
 * RETICLE_LOCK_SCALE × the box, rotated RETICLE_LOCK_ROTATE, with an
 * outBack snap (RETICLE_LOCK_OVERSHOOT); then a bracket flash and one ping
 * ring that leaves the lock ring (RETICLE_PING_REACH × the drawn radius).
 * Static afterwards; instant (already locked) under reduced motion.
 */
export const RETICLE_LOCK_MS = 760;
export const RETICLE_LOCK_SCALE = 1.9;
export const RETICLE_LOCK_ROTATE = Math.PI / 4;
export const RETICLE_LOCK_OVERSHOOT = 1.6;
export const RETICLE_FLASH_ALPHA = 0.45;
export const RETICLE_PING_REACH = 0.9;
/** The lock timeline's end: 0 → 1 converge, 1 → 2 flash and ping. */
export const RETICLE_LOCK_END = 2;

/**
 * D-21: Lab B's world response to focus (`labb-focus-logic`, BODY_LIT
 * `uK.w`): it fades in over FOCUS_MIX_MS and out over FOCUS_RELEASE_MS.
 * At full focus every other body is defocused at FOCUS_DIM (Lab B's full
 * strength: desaturate 30 %, darken 32 %, atmosphere −55 % in the body
 * shader) and sinks FOCUS_SINK toward the sky behind it; a flat or moon body
 * (no shader) loses FLAT_FOCUS_DIM of its alpha. The sun is never dimmed, nor
 * a focused parent's moons.
 */
export const FOCUS_MIX_MS = 340;
export const FOCUS_RELEASE_MS = 260;
export const FOCUS_DIM = 1;
export const FOCUS_SINK = 0.22;
export const FLAT_FOCUS_DIM = 0.4;
/**
 * Other orbits at full focus keep 1 − this of their alpha (Lab B ring
 * `focusDim` floors 0.35 dark / 0.4 light).
 */
export const RING_FOCUS_DIM = { dark: 0.65, light: 0.6 } as const;
/**
 * Other labels' TEXT never drops below this alpha (Lab B R1
 * LABEL_TEXT_DIM_MIN: ≥ 4.95:1 over the extreme backdrop in all four themes);
 * their plates keep full scrim.
 */
export const LABEL_DIM_FLOOR = 0.66;
/**
 * D-55: what the Orrery draws under every Orrery text surface is dimmed
 * toward `orreryOcclusion` at this strength (the card glass itself never
 * changes, D-20/D-35). Lab B's card occlusion drew bodies under the card at
 * 0.12 alpha (≈ 0.88 dim); D-62 caps this lever at 0.7, so it starts at the
 * cap. Plan 14 tunes it by the ADR-169 contrast proof.
 */
export const OCCLUSION_DIM = 0.7;
