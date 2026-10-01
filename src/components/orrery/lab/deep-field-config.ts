/**
 * ORRERY LAB A — "Deep-field star chart" tunables (experiment branch only).
 *
 * Every visual number the Lab A renderer uses lives here so a device-review
 * pass is a single-number edit. Nothing in this file touches frame semantics:
 * these are presentation extents drawn OUTSIDE `radius`/`hitRadius`/label
 * metrics, which stay owned by `projectAnimatedFrame` + `allocateLabels`.
 *
 * Units: "px" = canvas dp (Skia canvas units), "world" = orrery world units.
 */

/** Master switch: false restores the pre-Lab flat renderer (A/B on device). */
export const DEEP_FIELD_ENABLED = true;

/** Experiment marker drawn in DEV builds only (and while this flag is on). */
export const LAB_MARKER_TEXT = "ORRERY LAB A — PRODUCTION SKIA";
/** Flip to false to hide the marker even in DEV builds. */
export const LAB_MARKER_ENABLED = true;
/** Marker inset from the usable rect's top-left corner (px). */
export const LAB_MARKER_INSET = 10;
/** Marker font size (px, not fontScale-scaled: it is a dev badge). */
export const LAB_MARKER_FONT = 9;

// ── 1. Environment ──────────────────────────────────────────────────────────
/** Nebula texture resolution in texture px per canvas dp (soft field → <1 ok). */
export const NEBULA_TEXTURE_SCALE = 0.75;
/** Nebula noise frequency (cycles across the short side). */
export const NEBULA_FREQUENCY = 2.4;
/** Nebula alpha over the background, dark (glow) vs light (chart wash). */
export const NEBULA_ALPHA_DARK = 0.8;
export const NEBULA_ALPHA_LIGHT = 0.55;
/** Pan parallax factors (fraction of the on-screen pan, px). Far → small. */
export const NEBULA_PAN_PARALLAX = 0.035;
export const STARS_FAR_PAN_PARALLAX = 0.05;
export const STARS_NEAR_PAN_PARALLAX = 0.12;
/** Fraction of camera yaw the sky rotates by (1 = sky locked to the world). */
export const SKY_YAW_FACTOR = 1;
/** Tilt → vertical sky slide (px per radian of tilt), per layer. */
export const NEBULA_TILT_SLIDE = 70;
export const STARS_FAR_TILT_SLIDE = 90;
export const STARS_NEAR_TILT_SLIDE = 160;
/** Zoom → layer scale (scale = 1 + log2(zoom) × factor). */
export const NEBULA_ZOOM_SCALE = 0.025;
export const STARS_FAR_ZOOM_SCALE = 0.035;
export const STARS_NEAR_ZOOM_SCALE = 0.09;
/** Star counts per layer (dark); light "chart" mode uses the INK counts. */
export const STARS_FAR_COUNT = 240;
export const STARS_NEAR_COUNT = 70;
export const STARS_FAR_COUNT_INK = 90;
export const STARS_NEAR_COUNT_INK = 26;
/** Radius bands (px). */
export const STARS_FAR_R: readonly [number, number] = [0.35, 0.95];
export const STARS_NEAR_R: readonly [number, number] = [0.7, 1.7];
/** How many of the near stars get a soft glow + diffraction spikes (dark). */
export const STARS_HERO_COUNT = 7;
/** Hero glow radius multiple of the star radius; spike length (px). */
export const STARS_HERO_GLOW = 5;
export const STARS_HERO_SPIKE = 9;
/** Twinkle: two near-star groups oscillate in opposite phase in this band. */
export const TWINKLE_MIN = 0.45;
export const TWINKLE_MAX = 1;
/** rad/ms → ~3.5 s period. */
export const TWINKLE_SPEED = 0.0018;
/** Vignette: edge alpha of `orreryVoid`, and where the falloff starts (0..1). */
export const VIGNETTE_ALPHA_DARK = 0.78;
export const VIGNETTE_ALPHA_LIGHT = 0.32;
export const VIGNETTE_INNER = 0.42;
/** Switch "jump": peak sky swing (rad) at full angular velocity. */
export const SWITCH_SKY_KICK = 0.16;
/** Switch "jump": peak near-star stretch (scale delta) at full velocity. */
export const SWITCH_STAR_STRETCH = 0.06;

// ── 2. World plane / astrolabe ──────────────────────────────────────────────
/** Reference ring spacing (world units). */
export const GRID_RING_STEP = 48;
/** Grid reaches this multiple of the scene extent; bezel sits at the edge. */
export const GRID_REACH = 1.12;
/** Radial spokes every N degrees; bezel ticks every M degrees. */
export const GRID_SPOKE_DEGREES = 30;
export const GRID_TICK_DEGREES = 3;
/** Bezel tick lengths (world units, minor / every-5th major). */
export const GRID_TICK_MINOR = 4;
export const GRID_TICK_MAJOR = 10;
/** Grid alpha at the sun and at the bezel (dark / light). */
export const GRID_ALPHA_INNER_DARK = 0.34;
export const GRID_ALPHA_OUTER_DARK = 0.07;
export const GRID_ALPHA_INNER_LIGHT = 0.3;
export const GRID_ALPHA_OUTER_LIGHT = 0.09;
export const GRID_BEZEL_ALPHA_DARK = 0.42;
export const GRID_BEZEL_ALPHA_LIGHT = 0.45;
/** Grid stroke (screen px; drawn in world units ÷ zoom so perspective thins it). */
export const GRID_STROKE_PX = 0.9;
/** Sun-lit pool on the plane: alpha at the sun, radius as extent multiple. */
export const LIT_POOL_ALPHA_DARK = 0.16;
export const LIT_POOL_ALPHA_LIGHT = 0.26;
export const LIT_POOL_REACH = 0.85;

// ── 3. Orbits as instruments ────────────────────────────────────────────────
/** Ring core stroke = status width × this (screen px before perspective). */
export const RING_CORE_SCALE = 0.72;
/** Dark-mode luminous underglow: width multiple of the core + alpha. */
export const RING_GLOW_WIDTH = 3.0;
export const RING_GLOW_ALPHA = 0.12;
/** Far side alpha floor at full tilt (near side stays 1). */
export const RING_FAR_ALPHA = 0.32;
/** Screen-px dash interval (kept from the canonical [6,6] language). */
export const RING_DASH = 6;
/** Progress trail: head alpha, stroke width (px), dark / light. */
export const TRAIL_ALPHA_DARK = 0.62;
export const TRAIL_ALPHA_LIGHT = 0.34;
export const TRAIL_WIDTH_PX = 5.5;
export const TRAIL_CORE_WIDTH_PX = 1.6;
/** Progress tick at the body's angle on its ring (world half-length). */
export const RING_TICK_HALF = 5;

// ── 4. Bodies lit by the sun ────────────────────────────────────────────────
/** Max night-side darkening of the photo (0..1). Photos must stay readable. */
export const BODY_SHADOW_MAX_DARK = 0.62;
export const BODY_SHADOW_MAX_LIGHT = 0.36;
/** Lit-side rim light strength (status hue). */
export const BODY_RIM_DARK = 0.85;
export const BODY_RIM_LIGHT = 0.7;
/** Atmosphere halo reach (radius multiple; MUST stay ≤ 1.3 = culling reach). */
export const BODY_HALO_REACH = 1.28;
export const BODY_HALO_ALPHA_DARK = 0.55;
export const BODY_HALO_ALPHA_LIGHT = 0.8;
/** Far-depth tint strength (0..1) at the far edge of the system. */
export const BODY_FAR_TINT = 0.38;
/** Contact shadow on the plane: length / width as body-radius multiples. */
export const SHADOW_LENGTH = 2.6;
export const SHADOW_WIDTH = 1.05;
export const SHADOW_OFFSET = 1.1;
export const SHADOW_ALPHA_DARK = 0.7;
export const SHADOW_ALPHA_LIGHT = 0.16;

// ── 5. Sun as a star ────────────────────────────────────────────────────────
/** Corona quad half-size as a sun-radius multiple (culling reach is 2r). */
export const CORONA_EXTENT = 2.7;
/** Corona animation speed (shader time units per ms). */
export const CORONA_SPEED = 0.00045;
/** Corona intensity (dark / light). */
export const CORONA_ALPHA_DARK = 1;
export const CORONA_ALPHA_LIGHT = 0.85;

// ── 6. HUD ──────────────────────────────────────────────────────────────────
/** Reticle bracket gap outside the body (px, local) and arm length (radius ×). */
export const RETICLE_GAP = 7;
export const RETICLE_ARM = 0.42;
/** Reticle spin (rad/ms) → one turn ≈ 21 s. Static under reduced motion. */
export const RETICLE_SPEED = 0.0003;
/** Label plate alpha + hairline border alpha + status tick width (px). */
export const PLATE_ALPHA = 0.9;
export const PLATE_BORDER_ALPHA = 0.55;
export const PLATE_TICK_WIDTH = 2.5;
/** Leader hairline alpha (px width 1). */
export const LEADER_ALPHA = 0.7;

// ── 7. System switch as a jump ──────────────────────────────────────────────
/** Streak arc length (rad) at full angular velocity; leaving bodies × boost. */
export const STREAK_ARC = 0.55;
export const STREAK_LEAVING_BOOST = 1.5;
/** Streak stroke width as a multiple of the body world radius. */
export const STREAK_WIDTH = 0.95;
export const STREAK_ALPHA_DARK = 0.7;
export const STREAK_ALPHA_LIGHT = 0.35;
/** Sun flare peak (corona gain) at capture. */
export const FLARE_GAIN = 1.25;
