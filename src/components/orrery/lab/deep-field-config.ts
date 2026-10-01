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
/**
 * Nebula (pass 1): baked on the CPU into a NEBULA_BAKE_SIZE² RGBA texture and
 * cached per theme ink (see nebula-bake.ts). Peak alpha is deliberately low —
 * the nebula is a value step BELOW rings and bodies, never a wash.
 */
export const NEBULA_BAKE_SIZE = 256;
/** Peak alpha over the background, dark (glow) vs light (chart wash). */
export const NEBULA_ALPHA_DARK = 0.32;
export const NEBULA_ALPHA_LIGHT = 0.34;
/** Band orientation (rad, screen) and gaussian half-width (texture units). */
export const NEBULA_BAND_ANGLE = -0.62;
export const NEBULA_BAND_WIDTH = 0.11;
/** Density gain before the alpha clamp (shapes how much of the band saturates). */
export const NEBULA_GAIN = 1.8;
/** Chart (light) mode: how far the pale wash is shaded toward the grid ink. */
export const NEBULA_CHART_INK = 0.2;
/** Dust-lane darkening inside the band (0..1). */
export const NEBULA_DUST_STRENGTH = 0.75;
/** Fade-in (ms) the first time a palette's nebula is baked (0 under RM). */
export const NEBULA_FADE_MS = 450;
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
/** Inner grid fades as orbit count N rises: × clamp(REF / N, FLOOR, 1). */
export const GRID_DENSITY_REF = 8;
export const GRID_DENSITY_FLOOR = 0.3;
/** Grid stroke (screen px; drawn in world units ÷ zoom so perspective thins it). */
export const GRID_STROKE_PX = 0.9;
/** Sun-lit pool on the plane: alpha at the sun, radius as extent multiple. */
export const LIT_POOL_ALPHA_DARK = 0.16;
export const LIT_POOL_ALPHA_LIGHT = 0.12;
export const LIT_POOL_REACH = 0.85;

// ── 3. Orbits as instruments ────────────────────────────────────────────────
/**
 * PASS 1 hierarchy inversion — rings are instruments, bodies are the subject.
 * Hairline width = status width (2/3/4 channel) × RING_HAIR_SCALE px.
 */
export const RING_HAIR_SCALE = 0.42;
/** Hairline alpha (× the canonical status alpha factor). */
export const RING_HAIR_ALPHA_DARK = 0.5;
export const RING_HAIR_ALPHA_LIGHT = 0.55;
/** Hairline alpha boost (×) for sparse Systems, fading out by this count. */
export const RING_SPARSE_BOOST = 1.7;
export const RING_SPARSE_COUNT = 12;
/** How far the hairline ink moves from neutral grid ink toward the status hue. */
export const RING_TINT_DARK = 0.55;
export const RING_TINT_LIGHT = 0.6;
/** Far side alpha floor at full tilt (near side stays 1). */
export const RING_FAR_ALPHA = 0.32;
/** Screen-px dash interval (kept from the canonical [6,6] language). */
export const RING_DASH = 6;
/** Status segment: trail behind the body (rad, capped at progress) + lead. */
export const SEGMENT_TRAIL = (75 * Math.PI) / 180;
export const SEGMENT_LEAD = (14 * Math.PI) / 180;
/** Segment stroke = status width × this (px); peak alpha at the body. */
export const SEGMENT_SCALE = 0.7;
export const SEGMENT_ALPHA_DARK = 1;
export const SEGMENT_ALPHA_LIGHT = 0.95;

// ── 4. Bodies lit by the sun ────────────────────────────────────────────────
/**
 * PASS 1 presence: overview bodies are drawn up to BODY_VISUAL_MIN_RADIUS dp
 * (≤ the 22 dp min tap radius) with a cap of BODY_VISUAL_MAX× the projected
 * radius. Presentation only — frame radius/hitRadius/label metrics unchanged.
 * Visual extent (disc × halo) can exceed the 1.3r culling reach → a body
 * whose centre is just past the viewport edge pops (documented, accepted).
 */
export const BODY_VISUAL_MIN_RADIUS = 21;
export const BODY_VISUAL_MAX = 1.6;
/** Crisp edge line (status hue) strength on the lit / night side. */
export const BODY_EDGE_LIT = 0.95;
export const BODY_EDGE_NIGHT = 0.4;
/** Soft specular highlight (starlight) on the sun-facing hemisphere. */
export const BODY_SPEC_DARK = 0.22;
export const BODY_SPEC_LIGHT = 0.12;
/** Max night-side darkening of the photo (0..1). Photos must stay readable. */
export const BODY_SHADOW_MAX_DARK = 0.55;
export const BODY_SHADOW_MAX_LIGHT = 0.36;
/** Lit-side rim light strength (status hue). */
export const BODY_RIM_DARK = 0.85;
export const BODY_RIM_LIGHT = 0.7;
/** Atmosphere halo reach (multiple of the drawn disc; see culling note above). */
export const BODY_HALO_REACH = 1.5;
export const BODY_HALO_ALPHA_DARK = 0.5;
export const BODY_HALO_ALPHA_LIGHT = 0.8;
/** Far-depth tint strength (0..1) at the far edge of the system. */
export const BODY_FAR_TINT = 0.38;
/** Contact shadow on the plane: length / width as body-radius multiples. */
export const SHADOW_LENGTH = 2.6;
export const SHADOW_WIDTH = 1.05;
export const SHADOW_OFFSET = 1.1;
export const SHADOW_ALPHA_DARK = 0.55;
export const SHADOW_ALPHA_LIGHT = 0.16;
/** Contact shadows fade in with tilt: 0 at tilt 0, full at this tilt (rad). */
export const SHADOW_TILT_FULL = 0.45;

// ── 5. Sun as a star ────────────────────────────────────────────────────────
/** Corona quad half-size as a sun-radius multiple (culling reach is 2r). */
export const CORONA_EXTENT = 2.7;
/** Corona animation speed (shader time units per ms). */
export const CORONA_SPEED = 0.00045;
/** Corona intensity (dark / light). */
export const CORONA_ALPHA_DARK = 1;
export const CORONA_ALPHA_LIGHT = 0.85;

/** Sun disc granulation speed (shader time units per ms; static under RM). */
export const SUN_GRANULE_SPEED = 0.00035;

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
