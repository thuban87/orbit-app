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

/**
 * Lab B's nebula strengths for one package × mode (`orrery-lab-fx.ts` env,
 * re-expressed against the V2 `orreryNebula` inks, which are darker / paler
 * than Lab B's accent and star-palette lobes, so the same look needs larger
 * mix fractions). All are scaled by `SkyLook.nebulaStrength`.
 */
export interface SkyNebulaLook {
  /** Max mix of the sky toward lobe A / lobe B at full density (0..1). */
  lobeA: number;
  lobeB: number;
  /** Additive quadratic core glow (dark only; 0 on light). */
  glow: number;
  /** The overlap tint where lobe A and lobe B meet. */
  ember: number;
  /** How much the dust lanes darken the clouds (0..1). */
  dust: number;
}

/** One package × mode's sky look. */
export interface SkyLook {
  /** Small background stars (the mid layer; the far layer is in the shader). */
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
  /**
   * The whole nebula's strength: 1 = "as in Lab B" (the per-lobe numbers in
   * `nebula`), lower = the same clouds, fainter (0 = no clouds).
   */
  nebulaStrength: number;
  /** Lab B's per-lobe strengths (before `nebulaStrength`). */
  nebula: SkyNebulaLook;
  /** Corner vignette strength (0..1; Lab B). */
  vignette: number;
  /**
   * Dark: how far the corners sink toward black. Light: unused (the corners
   * wash toward the first `orrerySkyStars` ink instead).
   */
  vignetteShade: number;
  /** The far star layer (drawn in the sky shader): alpha and cell density. */
  farStarAlpha: number;
  farStarDensity: number;
  /**
   * How far the per-System tint leans the nebula's lobe B toward the System
   * hue (0..1; Lab B leant it fully). Applied at draw time (H9).
   */
  tintStrength: number;
  /** A faint whole-sky wash of the System tint (0..1). */
  tintWash: number;
  /** Where the horizon→base gradient reaches the base (0..1 of the height). */
  horizonStop: number;
}

/**
 * Per package × mode. 38.7-09 rework (owner, 2026-10-03): the nebula is Lab
 * B's distant baked nebula. Galaxy Dark at 35 % of Lab B (owner, 2026-10-04); Standard Dark keeps
 * Lab B's calm graphite chart (barely-there clouds, no ember); light themes
 * Lab B's low-contrast vellum washes (no glow, src-over). Plan 14 tunes the
 * non-hero themes.
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
      // Owner ruling 2026-10-04 (G-NEBULA, CONTEXT D-75): 35 % of Lab B's
      // clouds, with the quieter far-star field.
      nebulaStrength: 0.35,
      nebula: { lobeA: 0.47, lobeB: 0.42, glow: 0.26, ember: 0.3, dust: 0.38 },
      vignette: 0.62,
      vignetteShade: 0.55,
      farStarAlpha: 1.0,
      farStarDensity: 0.8,
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
      nebulaStrength: 1,
      nebula: { lobeA: 0.3, lobeB: 0.24, glow: 0, ember: 0.08, dust: 0.04 },
      vignette: 0.09,
      vignetteShade: 0,
      farStarAlpha: 0.34,
      farStarDensity: 0.2,
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
      nebulaStrength: 1,
      nebula: { lobeA: 0.17, lobeB: 0.13, glow: 0.04, ember: 0, dust: 0.09 },
      vignette: 0.43,
      vignetteShade: 0.55,
      farStarAlpha: 0.64,
      farStarDensity: 0.28,
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
      nebulaStrength: 1,
      nebula: { lobeA: 0.22, lobeB: 0.18, glow: 0, ember: 0.03, dust: 0.02 },
      vignette: 0.05,
      vignetteShade: 0,
      farStarAlpha: 0.26,
      farStarDensity: 0.2,
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
/**
 * Parallax of the mid/near star batches: dp of shift per screen-width of pan
 * (the nebula and far stars use Lab B's depth factors below).
 */
export const SKY_PARALLAX_STARS = 7;
/** Parallax bound (dp). */
export const SKY_PARALLAX_MAX_DP = 22;
/** The margin the sky covers beyond each canvas edge (covers both offsets). */
export const SKY_MARGIN_DP = SKY_PARALLAX_MAX_DP + SKY_DRIFT_MAX_DP + 4;

/*
 * Lab B's baked nebula (labb LabEnvironment / labb-sky): a square, seamlessly
 * tiling DENSITY texture, baked once per (package, mode, size bucket).
 */
/** The baked density texture's side (texels). */
export const SKY_NEBULA_TEX = 768;
/** Noise lattice period across the texture (base cloud cells per tile). */
export const SKY_NEBULA_PERIOD = 8;
/** Texels per dp: tile = 768 / 0.45 ≈ 1,700 dp, base cloud cell ≈ 213 dp. */
export const SKY_NEBULA_TEXELS_PER_DP = 0.45;
/**
 * Depth factors (Lab B NEBULA_FACTOR / FAR): the nebula moves 6 % of the
 * world's on-screen motion, the far stars 3 % — far behind the System.
 */
export const SKY_NEBULA_DEPTH = 0.06;
export const SKY_FAR_STAR_DEPTH = 0.03;
/** Zoom scale exponent per unit depth (nebula: zoom^(0.06 × 1.3)). */
export const SKY_ZOOM_DEPTH = 1.3;
/** Vertical sky shift at full tilt (dp), × (SKY_TILT_BASE + depth). */
export const SKY_TILT_SHIFT = 140;
export const SKY_TILT_BASE = 0.25;
/** The nebula's slow breathing warp: amplitude (dp) and period (s). */
export const SKY_BREATH_DP = 9;
export const SKY_BREATH_S = 40;
/** The frozen composition time under reduced motion (s). */
export const SKY_STILL_S = 23;
/** Canvas sizes are bucketed to this step (dp) for the bake cache key. */
export const SKY_SIZE_BUCKET_DP = 64;
/** The sky's star-field seed (fixed: the sky is the same every visit). */
export const SKY_STAR_SEED = 38;

// ── The System switch (38.7-13: D-24, D-32, D-53) ─────────────────────────

/*
 * Every number here is a lab value, ported AS DRAWN (execution policy §6):
 * Lab B's star warp (`labb-switch-logic.ts`, `LabEnvironment.tsx`
 * StarStreakAtlas), Lab A's orbit streaks (`deep-field-config.ts` TRAIL_*,
 * `world-plane.ts` §7a) and Lab C's camera breath (`OrreryWorld3D.tsx`).
 * The owner's S-WARP / S-TRAIL / S-SWIRL checkpoint picks "as in Lab X /
 * weaker / stronger / off" around these.
 */
/** Lab B STREAK_MAX_DP: streak length (dp) of an edge star at full warp. */
export const WARP_STREAK_MAX_DP = 190;
/** Lab B WARP_PUSH: the sky's extra zoom at full warp ("pushing into" it). */
export const WARP_PUSH = 0.14;
/** Lab B SKY_PUSH_BASE / SKY_PUSH_DEPTH: push per unit depth factor. */
export const WARP_PUSH_BASE = 0.6;
export const WARP_PUSH_DEPTH = 2.5;
/** Lab B WARP_SWIRL: the streaks' vortex twist at full warp (rad, spin-wise). */
export const WARP_SWIRL = 0.32;
/** Lab B STREAK_ALPHA: streak alpha × the star's own alpha. */
export const WARP_STREAK_ALPHA = 0.95;
/** Lab B STREAK_THICK: streak thickness × the star's own diameter. */
export const WARP_STREAK_THICK = 0.85;
/**
 * Lab B's parallax depth factors of its MID (0.1) and NEAR (0.22) star
 * layers: the V2 sky's small stars are the mid layer, its bright stars the
 * near layer. Streak length × (0.45 + 2.5 × factor); push × (0.6 + 2.5 × factor).
 */
export const WARP_LAYER_FACTOR = { mid: 0.1, near: 0.22 } as const;
/** Lab B's streak sprite: transparent tail → 0.30 halo at 72 % → full head. */
export const WARP_STREAK_HALO = 0.3;
export const WARP_STREAK_HALO_AT = 0.72;
/** Fade segments per streak (the sprite gradient as stepped alphas). */
export const WARP_STREAK_SEGMENTS = 3;
/**
 * Master warp strength (the owner option knob; 0 = off). 1 = Lab B's numbers;
 * 1.6 = Lab B's LOOK matched by eye on the Pixel 6 Pro (38.7-13 Task 3,
 * against Lab B 06-wp2.1-switch/01): at 1 V2's streaks read shorter and
 * sparser than Lab B's, mostly because V2's tilted plane hides most of the sky
 * that Lab B's flat camera shows. S-WARP picks the final value.
 */
export const WARP_STRENGTH = 1; // owner S-WARP 2026-10-04: Lab B's own numbers (D-76)

/** Lab A TRAIL_MS / TRAIL_LEAVING_MS: the arc a streak covers (ms of motion). */
export const TRAIL_MS = 160;
export const TRAIL_LEAVING_MS = 340;
/** Lab A TRAIL_MAX_ARC: the longest streak (radians about the sun). */
export const TRAIL_MAX_ARC = 2.4;
/** Lab A TRAIL_WIDTH: streak width × the drawn body radius. */
export const TRAIL_WIDTH = 1.15;
/** Lab A TRAIL_ALPHA_DARK / _LIGHT: the streak's peak alpha. */
export const TRAIL_ALPHA = { dark: 0.42, light: 0.26 } as const;
/** Lab A: a leaving body's streak is this much stronger. */
export const TRAIL_LEAVING_GAIN = 1.25;
/** Lab A TRAIL_INNER_REF / _FLOOR: inner rings thin and soften their streaks. */
export const TRAIL_INNER_REF = 9;
export const TRAIL_INNER_FLOOR = 0.3;
/**
 * Lab A's streak gradient: 0 at the tail, TRAIL_RAMP_MID at 55 % (that stop
 * lives in the ring shader, RING_PLANE_SKSL `TRAIL_AT`), full at the body.
 */
export const TRAIL_RAMP_MID = 0.35;
/** Most orbit streaks drawn at once (nearest the camera first; D-53). */
export const TRAIL_BUDGET = 120;
/** Master streak strength (1 = as in Lab A; the owner option knob; 0 = off). */
export const TRAIL_STRENGTH = 0.5; // owner S-TRAIL 2026-10-04: "weaker" (D-76)

/**
 * The switch camera is Lab C's, copied from its code (owner S-SWIRL pick,
 * 2026-10-04: "a zigzag to get back to center and then pull back"). Lab C
 * `use-orrery-switch-runtime.ts` interpolateCamera (every axis
 * smoothstep-mixed, yaw a raw linear mix) plus the `OrreryWorld3D.tsx` breath:
 * b = sin²(πp) × (0.5 + 0.5·intensity); zoom × (1 − PULLBACK·b) with the
 * dolly focal of that zoom, yaw + YAW·b, tilt + TILT·b (never below 0). Zero at
 * both ends; reduced motion / a spinless switch has no breath.
 *
 * SWITCH_YAW_PATH: the base yaw path. "lab-c" (Lab C's raw linear mix: stored
 * yaw is in [0, 2π) and Home's is 0, so a camera turned just short of a full
 * turn swings nearly the whole turn back) or "shortest" (the shortest arc).
 */
export const SWITCH_YAW_PATH: "lab-c" | "shortest" = "lab-c";
/** Lab C SWITCH_PULLBACK: dolly-out share of zoom at full breath. */
export const SWITCH_BREATH_PULLBACK = 0.24;
/** Lab C SWITCH_YAW: yaw swing (rad, ≈ 22°) out and back at full breath. */
export const SWITCH_BREATH_YAW = 0.38;
/** Lab C SWITCH_TILT: tilt change (rad) at full breath; negative = toward top-down. */
export const SWITCH_BREATH_TILT = -0.1;

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
/*
 * D-55: what the Orrery draws under every Orrery text surface is dimmed. The
 * dim's strength is a proven theme value (38.7-14): `ORRERY_OCCLUSION_DIM` in
 * src/theme/tokens/surface.ts, capped by the owner's D-62 ceiling 0.7, read
 * by draw-overlay through the overlay spec.
 *
 * ORRERY_OCCLUSION_STYLE (38.7-14 T-DIM: the owner compares the two looks):
 *   - "full-rect": every pixel inside the text surface's rect (sky, rings,
 *     bodies, labels) is dimmed toward `orreryOcclusion` (Plan 11's dim; the
 *     one `surface.test.ts` proves). The default.
 *   - "lab-b": as in Lab B (`labb-card-channel.ts:8-11`, LabLayerPictures R1):
 *     no fill — the sky and the rings show through the glass untouched; a body
 *     (contact, moon or sun, with its pips) whose reach touches a rect, padded
 *     OCCLUDE_PAD_DP, draws at OCCLUDED_BODY_ALPHA, and a label or caption
 *     plate touching a rect is dropped. Lab B applied it to the focus card
 *     only; here it applies to every occlusion rect (the card and the static
 *     panels), since there is no fill under them either.
 */
export const ORRERY_OCCLUSION_STYLE: "full-rect" | "lab-b" = "full-rect";
/** Lab B OCCLUDED_ALPHA: a body under a card draws at this alpha. */
export const OCCLUDED_BODY_ALPHA = 0.12;
/** Lab B OCCLUDE_PAD: padding (dp) around a rect for the body test. */
export const OCCLUDE_PAD_DP = 4;
