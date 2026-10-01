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
/**
 * PASS 3 reticle — authored in SCREEN dp around the DRAWN disc (projected
 * radius × visual × depth scale), so it is tight and the same weight at every
 * zoom; billboarded (the body Group has no tilt skew). Brackets are
 * axis-aligned once locked (a spinning square read as stray chevrons).
 *  - bracket box half-size = drawn + max(RETICLE_GAP_DP, drawn × RETICLE_GAP_FRAC)
 *  - arm = clamp(half × RETICLE_ARM_FRAC, RETICLE_ARM_MIN, RETICLE_ARM_MAX)
 */
export const RETICLE_GAP_DP = 5;
export const RETICLE_GAP_FRAC = 0.16;
export const RETICLE_ARM_FRAC = 0.34;
export const RETICLE_ARM_MIN = 6;
export const RETICLE_ARM_MAX = 15;
/** Bracket stroke (dp), inner lock ring offset outside the disc (dp) + alpha. */
export const RETICLE_STROKE_DP = 2;
export const RETICLE_RING_DP = 3.5;
export const RETICLE_RING_ALPHA = 0.55;
/** Cardinal instrument ticks just outside the lock ring (dp length). */
export const RETICLE_TICK_DP = 4;
/** Ambient "scan" arc on the lock ring: span (rad) + speed (rad/ms ≈ 9 s/turn).
 *  Static under reduced motion. */
export const RETICLE_SCAN_ARC = 0.8;
export const RETICLE_SCAN_SPEED = 0.0007;
/** Lock-on: total ms; converge occupies the first half (outBack overshoot),
 *  then a flash on the brackets + one ping ring. Start spread (× box) and
 *  rotation; ping reach (× drawn radius). Static under reduced motion. */
export const RETICLE_LOCK_MS = 760;
export const RETICLE_LOCK_SPREAD = 0.9;
export const RETICLE_LOCK_ROTATE = Math.PI / 4;
export const RETICLE_LOCK_OVERSHOOT = 1.6;
export const RETICLE_FLASH_ALPHA = 0.45;
export const RETICLE_PING_REACH = 0.9;
/** Focus emphasis (pass 3): fade (ms), other rings' hairline/segment dim,
 *  focused ring hairline → full status ink at this alpha + width (× status
 *  width), other bodies' alpha dim. Instant under reduced motion. */
export const FOCUS_FADE_MS = 320;
export const FOCUS_RING_DIM = 0.55;
export const FOCUS_RING_ALPHA = 0.85;
export const FOCUS_RING_WIDTH = 0.6;
export const FOCUS_BODY_DIM = 0.22;
/** Arrival ghosts (pass 3): unmounted entering contacts draw a neutral disc
 *  (background fill + tinted hairline) until their component mounts. */
export const GHOST_FILL_ALPHA = 0.92;
/** Ghost disc = background mixed this far toward grid ink; ghost orbit
 *  hairline alpha (× the ring hairline alpha). */
export const GHOST_BODY_TINT = 0.45;
export const GHOST_RING_ALPHA = 0.75;
export const GHOST_LINE_ALPHA = 0.75;
export const GHOST_LINE_DP = 1.3;
export const GHOST_LINE_TINT = 0.6;
/** Bodies fade in on mount (late-mounting entering bodies; ms). */
export const BODY_ENTER_FADE_MS = 280;
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

// ── PASS 2 ──────────────────────────────────────────────────────────────────
/**
 * Plane geometry is projected to SCREEN space on the CPU (the frame's own
 * homography) and stroked without a perspective canvas matrix. Pass 1 drew it
 * under `concat(H)`: Ganesh cannot stroke/dash under perspective on the GPU,
 * so every idle frame re-rasterised ~40 rings + grid as CPU masks (device:
 * ~5 fps idle on the Pixel). Segments per projected circle:
 */
export const PLANE_CIRCLE_SEGMENTS = 96;
/** Arc sampling step for status segments / ripples (rad). */
export const PLANE_ARC_STEP = (3 * Math.PI) / 180;
/** Near side of each ring is pulled this far toward its full status hue. */
export const RING_NEAR_TINT = 0.35;
/**
 * Depth haze: a screen gradient over the plane from the far edge (alpha) to
 * the plane centre (0), in background ink — far grid/rings recede. × tilt gate.
 */
export const HAZE_ALPHA_DARK = 0.5;
export const HAZE_ALPHA_LIGHT = 0.55;
/** Cool horizon glow (nebulaB) just beyond the far bezel (dark only). */
export const HAZE_GLOW_ALPHA = 0.12;
/** Separation keyline just outside each body disc (dp) and its alpha. */
export const BODY_KEYLINE_DP = 1.6;
export const BODY_KEYLINE_ALPHA_DARK = 0.9;
export const BODY_KEYLINE_ALPHA_LIGHT = 0.95;
/** Stack pips: bodies closer than (rA + rB) × this overlap = one stack. */
export const STACK_OVERLAP = 0.8;
/** Pip radius (dp), max pips shown, angular spacing (rad), anchor angle. */
export const STACK_PIP_R = 3.2;
export const STACK_PIP_MAX = 4;
export const STACK_PIP_STEP = 0.42;
export const STACK_PIP_ANGLE = -0.75;
/** Far bodies draw up to this much smaller (presentation; × far 0..1). */
export const BODY_FAR_SHRINK = 0.16;
/** Orbit hairline of a moon around its parent (alpha × ring hairline ink). */
export const MOON_ORBIT_ALPHA = 0.42;
/** Moon visual minimum radius (dp) — presentation only (hit radius ≥ 22). */
export const MOON_VISUAL_MIN_RADIUS = 4.5;
export const MOON_VISUAL_MAX = 2.2;

// Switch "jump" (pass 2). All of these are 0 under reduced motion (fx idle).
/** Entering rings ink in from the sun outward: outer rings start this much
 *  later within their capture stage (0 = all together). */
export const INK_IN_SPREAD = 0.55;
/** Glint at the drawing head of an inking ring (px radius, alpha). */
export const INK_GLINT_R = 3.2;
export const INK_GLINT_ALPHA = 0.95;
/** Motion-blur trails from the bodies' real recent screen path (ms). */
export const TRAIL_MS = 160;
export const TRAIL_LEAVING_MS = 340;
/** Trail width as a multiple of the drawn body radius; peak alpha. */
export const TRAIL_WIDTH = 1.15;
/** Pass 3: trails thin + fade for inner rings (screen ring radius below
 *  TRAIL_INNER_REF × drawn body radius), floor TRAIL_INNER_FLOOR. */
export const TRAIL_INNER_REF = 9;
export const TRAIL_INNER_FLOOR = 0.3;
export const TRAIL_ALPHA_DARK = 0.42;
export const TRAIL_ALPHA_LIGHT = 0.26;
/** Longest trail arc about the sun (rad; < π keeps the stroke convex). */
export const TRAIL_MAX_ARC = 2.4;
/** Capture pulse: on-plane ripple over the last part of a body's capture. */
export const PULSE_START = 0.62;
export const PULSE_REACH = 2.6;
export const PULSE_ALPHA = 0.85;
/** Retained bodies pulse once as the system settles (progress window). */
export const SETTLE_PULSE_START = 0.8;
/** Bezel "dial" response: tick ring swings with the spin (rad at v = 1). */
export const BEZEL_SPIN = 0.42;
/** Grid brightens with spin velocity (× (1 + gain·v)). */
export const GRID_FX_GAIN = 0.9;
/** Starfield warp: ghost copies of the near stars scaled out from centre. */
export const WARP_COPIES = 5;
export const WARP_STEP = 0.014;
export const WARP_ALPHA = 0.55;

// ── ARCH PERF PASS: imperative scene renderer (lab/scene-draw.ts) ─────────
/** Photo cross-fade over the initials when it resolves (ms). */
export const PHOTO_FADE_MS = 260;
/**
 * Ambient (corona, granulation, reticle scan) redraw rate. The single clock
 * ticks at the display rate (120 Hz on the Pixel); the ambient time is
 * quantised to this rate so idle frames that would draw an identical-looking
 * corona never re-record or redraw anything. 0 under live reduced motion.
 */
export const AMBIENT_HZ = 30;
/** Fade bookkeeping window: how long re-records keep ticking after a spec
 *  change (≥ the longest fade above, plus slack for the JS→UI hand-off). */
export const SPEC_FADE_WINDOW_MS = 360;
