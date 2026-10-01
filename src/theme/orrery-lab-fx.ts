/**
 * ORRERY LAB B — lab effect tokens (experiment/orrery-skia-unleashed).
 *
 * LAB-ONLY. Per package × mode effect PROFILES for the Lab B renderer: global
 * intensity, blend family (additive glows on dark, multiply/shadow on light) and
 * which EXISTING palette tokens feed which lab role. Lab colours are always
 * resolved from `ThemePalette` tokens (or numeric mixes of them in
 * `labb-uniforms.ts`); this file adds no new colour literal. It lives under
 * `/theme/` so that, if a later WP genuinely needs a new lab colour, the literal
 * is legal here and must be labelled `LAB-ONLY` (research 03 §2.2, C-03).
 *
 * Tunables sit at the top so retuning is a single-number edit.
 */
import type { ThemePackage, ThemePalette } from "./theme-types";

export type LabThemeMode = "dark" | "light";
export type LabBlendFamily = "additive" | "multiply";

/** A palette token whose value is a single colour string. */
export type LabColorToken = {
  [K in keyof ThemePalette]: ThemePalette[K] extends string ? K : never;
}[keyof ThemePalette];

export interface LabFxProfile {
  /** Global effect intensity scalar (1 = Galaxy Dark hero). */
  intensity: number;
  blend: LabBlendFamily;
  /** Debug HUD roles (FPS overlay). */
  hud: {
    plate: LabColorToken;
    plateOpacity: number;
    text: LabColorToken;
    graph: LabColorToken;
    /** Frames over 16.7 ms. */
    warn: LabColorToken;
    /** Frames over 33 ms. */
    bad: LabColorToken;
  };
  /** L0 deep environment (WP-1.1): nebula + starfield tunables. */
  env: LabEnvProfile;
  /** L2–L5 worlds (WP-1.2): lighting, atmosphere, corona tunables. */
  bodies: LabBodyProfile;
  /** L1 instrument orbits (WP-1.3). */
  rings: LabRingProfile;
  /** L6 HUD-tag labels (WP-1.3). */
  labels: LabLabelProfile;
  /**
   * WP-2.2 Standard-package identity: a faint navigational chart graticule on
   * the world plane (null = none; Galaxy keeps its nebula drama instead).
   */
  chart: LabChartProfile | null;
  /** Roles reserved for WP-1.1+ layers (environment / bodies / rings). */
  roles: {
    sky: LabColorToken;
    skyAccent: LabColorToken;
    starDim: LabColorToken;
    starBright: LabColorToken;
    highlight: LabColorToken;
    instrument: LabColorToken;
  };
}

/**
 * L0 environment profile (WP-1.1). Colours are TOKEN references (a palette key
 * or a `starPalette` index); the numbers are effect strengths before the
 * profile `intensity` and the panel's global intensity multiply them.
 */
export interface LabEnvProfile {
  /** Nebula lobe A hue (token). */
  lobeA: LabColorToken;
  /** Nebula lobe B hue: index into `starPalette`. */
  lobeBStar: number;
  /** Ember tint where the two lobes overlap: index into `starPalette`. */
  emberStar: number;
  /** Max mix of the sky toward lobe A / lobe B (0..1). */
  strengthA: number;
  strengthB: number;
  /** Additive core glow (dark only; 0 on light — vellum has no emission). */
  glow: number;
  /** Ember overlap tint strength. */
  ember: number;
  /** Dust-lane darkening (0..1). */
  dust: number;
  /** Corner vignette strength (0..1). */
  vignette: number;
  /**
   * Vignette target: `null` = the sky token scaled toward zero by
   * `vignetteShade` (dark), else a token the corners wash toward (light).
   */
  vignetteTone: LabColorToken | null;
  vignetteShade: number;
  /** Neutral star tone (bright stars on dark, ink specks on light). */
  starTone: LabColorToken;
  /** Far-layer star tints: indices into `starPalette`. */
  starTintStars: readonly [number, number];
  /** Starfield: global star alpha, fraction of stars kept, glow sprites, blend. */
  starAlpha: number;
  starDensity: number;
  starSoft: boolean;
  starAdditive: boolean;
  /** Fraction of tinted (starPalette) stars vs neutral text-tone stars. */
  starTint: number;
  /** Mid/near twinkle amplitude (± fraction of alpha). */
  twinkle: number;
}

/**
 * L2–L5 worlds profile (WP-1.2). Token references + effect strengths (before
 * profile and panel intensity). Dark = lit worlds with additive status
 * atmospheres and an emissive corona; light = the same lighting with a higher
 * readability floor, a soft anti-sun contact shadow instead of a glow, and a
 * warm (non-additive) corona wash.
 */
export interface LabBodyProfile {
  /** Lambert floor: the darkest terminator brightness (face readability). */
  lightFloor: number;
  /** Wrap-lighting term softening the terminator. */
  wrap: number;
  /** Status atmosphere glow strength. */
  atmosphere: number;
  /** 0 = normal (srcOver) glow, 1 = fully additive-looking glow. */
  atmosphereAdditive: number;
  /** Anti-sun contact shadow strength (light themes). */
  shadow: number;
  shadowInk: LabColorToken;
  /** Fresnel limb rim in the status hue. */
  fresnel: number;
  /** Crisp inner status rim (dp) and its strength. */
  rimPx: number;
  rimStrength: number;
  /** Specular glint strength. */
  spec: number;
  /** Max far-side haze toward the sky token. */
  haze: number;
  /** Near-white highlight token (specular, sun core). */
  highlight: LabColorToken;
  /** Sun corona strength and additivity. */
  corona: number;
  coronaAdditive: number;
  /** Initials ink over a stellar (plasma) self-sun surface. */
  sunInk: LabColorToken;
  /** Moon base tone and its lighting floor. */
  moonTone: LabColorToken;
  moonFloor: number;
  /** Procedural band contrast for initials bodies (0..1). */
  bandContrast: number;
}

/**
 * L1 instrument-orbit profile (WP-1.3). Hairline rings in the status hue (the
 * class colour/weight/style comes from `orreryRingStyle`), faded on the far
 * side of a tilted plane, with optional uniform energy flow (C-04), a progress
 * wake and drift tethers (C-17). Strengths before profile/panel intensity
 * where noted.
 */
export interface LabRingProfile {
  /** Base ring alpha (× the class alpha: faded 0.7, trace 0.42, neutral 0.5). */
  alpha: number;
  /** Alpha multiplier on the far side at maximum tilt. */
  farAlpha: number;
  /** Flow comet strength (scaled by intensity) and highlight token. */
  flow: number;
  flowHighlight: LabColorToken;
  /** Comet tail length and linear speed, world units (/s). */
  cometLength: number;
  cometSpeed: number;
  /** Progress wake: peak alpha at the body (fades toward north). */
  wakeAlpha: number;
  wakeWidthDp: number;
  /** Drift tether alpha, width and radial dash period (dp). */
  tetherAlpha: number;
  tetherWidthDp: number;
  tetherDash: number;
  /** Non-focused rings while something is focused. */
  focusDim: number;
  /** Focused ring: soft glow strokes beneath (wide/narrow alpha, widths dp). */
  glowWide: number;
  glowNarrow: number;
  glowWideDp: number;
  glowNarrowDp: number;
  /** Instrument ticks (north ticks at detail, focus tick scale). */
  tick: LabColorToken;
  tickAlpha: number;
  /** Compass chevron on the world rim (deferred from WP-1.2 Polaris). */
  compass: LabColorToken;
  compassAlpha: number;
}

/**
 * L6 HUD-tag label profile (WP-1.3). The plate keeps EXACTLY the prepared
 * text's width/height (allocation geometry); the tag adds a scrim halo under
 * it, a status-hue hairline on the body-facing edge and a leader tick toward
 * the body.
 */
export interface LabLabelProfile {
  /** Plate fill token + opacity (legacy: `surface` at 1). */
  plate: LabColorToken;
  plateOpacity: number;
  /** Plate outline (instrument hairline). */
  outline: LabColorToken;
  outlineAlpha: number;
  /** Scrim halo under the plate (contrast over the brightest nebula). */
  halo: LabColorToken;
  haloAlpha: number;
  haloSpread: number;
  haloBlur: number;
  /** Status hairline + leader tick. */
  hairlineDp: number;
  leaderDp: number;
}

/**
 * WP-2.2 chart graticule (Standard package identity): range rings at a "nice"
 * world step, radial bearing spokes and a degree scale on the outer ring, all
 * hairlines in a quiet token under the plane homography.
 */
export interface LabChartProfile {
  tone: LabColorToken;
  /** Range-ring / spoke alpha (before the density fade). */
  alpha: number;
  /** Outer degree-scale alpha. */
  scaleAlpha: number;
  /** Bearing spokes every N degrees. */
  spokeDeg: number;
  /** Target number of range rings across the scene extent. */
  rings: number;
}

/**
 * LAB-ONLY sprite MASK colours. The star atlas is drawn once as an alpha mask
 * (white RGB, shaped alpha) and every star is TINTED at draw time from palette
 * tokens through the Atlas colour buffer (`modulate`). These literals never
 * reach the screen as a colour on their own — they are the multiplicative
 * identity of the tint. Lives here because `/theme/` is the only sanctioned
 * home for a colour literal (check-colors).
 */
export const LAB_SPRITE_MASK = "#FFFFFF";
export const LAB_SPRITE_MASK_HALO = "#FFFFFF4D";
export const LAB_SPRITE_MASK_CLEAR = "#FFFFFF00";

// --- Tunables -----------------------------------------------------------------
const GALAXY_DARK_INTENSITY = 1;
const GALAXY_LIGHT_INTENSITY = 0.7;
const STANDARD_DARK_INTENSITY = 0.85;
/** Standard Light is the deliberately muted variant (≈0.5× Galaxy Light). */
const STANDARD_LIGHT_INTENSITY = 0.35;
const HUD_PLATE_OPACITY = 0.82;

/** Dark "deep field": luminous clouds, additive stars, strong vignette. */
const DARK_ENV: LabEnvProfile = {
  lobeA: "accent",
  lobeBStar: 3,
  emberStar: 2,
  strengthA: 0.28,
  strengthB: 0.27,
  glow: 0.16,
  ember: 0.22,
  dust: 0.38,
  vignette: 0.62,
  vignetteTone: null,
  vignetteShade: 0.55,
  starTone: "textPrimary",
  starTintStars: [4, 0],
  starAlpha: 0.9,
  starDensity: 1,
  starSoft: true,
  starAdditive: true,
  starTint: 0.32,
  twinkle: 0.3,
};
/** Light "vellum": low-contrast ink washes, sparse ink-speck stars, no glow. */
const LIGHT_ENV: LabEnvProfile = {
  lobeA: "accent",
  lobeBStar: 3,
  emberStar: 2,
  strengthA: 0.16,
  strengthB: 0.13,
  glow: 0,
  ember: 0.08,
  dust: 0.05,
  vignette: 0.13,
  vignetteTone: "textSecondary",
  vignetteShade: 0,
  starTone: "textSecondary",
  starTintStars: [4, 0],
  starAlpha: 0.42,
  starDensity: 0.4,
  starSoft: false,
  starAdditive: false,
  starTint: 0.15,
  twinkle: 0,
};

const DARK_BODIES: LabBodyProfile = {
  lightFloor: 0.55,
  wrap: 0.35,
  atmosphere: 0.85,
  atmosphereAdditive: 0.65,
  shadow: 0,
  shadowInk: "background",
  fresnel: 0.35,
  rimPx: 1.5,
  rimStrength: 0.9,
  spec: 0.14,
  haze: 0.15,
  highlight: "avatarSwatchText",
  corona: 1,
  coronaAdditive: 0.7,
  sunInk: "background",
  moonTone: "textSecondary",
  moonFloor: 0.22,
  bandContrast: 0.8,
};
const LIGHT_BODIES: LabBodyProfile = {
  lightFloor: 0.75,
  wrap: 0.35,
  atmosphere: 0.22,
  atmosphereAdditive: 0,
  shadow: 0.3,
  shadowInk: "textPrimary",
  fresnel: 0.28,
  rimPx: 2,
  rimStrength: 1,
  spec: 0.08,
  haze: 0.1,
  highlight: "avatarSwatchText",
  corona: 0.6,
  coronaAdditive: 0,
  sunInk: "textPrimary",
  moonTone: "textSecondary",
  moonFloor: 0.45,
  bandContrast: 0.4,
};

const DARK_RINGS: LabRingProfile = {
  alpha: 0.5,
  farAlpha: 0.32,
  flow: 1,
  flowHighlight: "textPrimary",
  cometLength: 48,
  cometSpeed: 36,
  wakeAlpha: 0.3,
  wakeWidthDp: 2.6,
  tetherAlpha: 0.6,
  tetherWidthDp: 1,
  tetherDash: 4,
  focusDim: 0.35,
  glowWide: 0.1,
  glowNarrow: 0.22,
  glowWideDp: 7,
  glowNarrowDp: 3.2,
  tick: "textSecondary",
  tickAlpha: 0.7,
  compass: "accent",
  compassAlpha: 0.6,
};
const LIGHT_RINGS: LabRingProfile = {
  alpha: 0.7,
  farAlpha: 0.4,
  flow: 0.5,
  flowHighlight: "textPrimary",
  cometLength: 48,
  cometSpeed: 36,
  wakeAlpha: 0.28,
  wakeWidthDp: 2.6,
  tetherAlpha: 0.7,
  tetherWidthDp: 1,
  tetherDash: 4,
  focusDim: 0.4,
  glowWide: 0.08,
  glowNarrow: 0.18,
  glowWideDp: 7,
  glowNarrowDp: 3.2,
  tick: "textSecondary",
  tickAlpha: 0.75,
  compass: "accent",
  compassAlpha: 0.7,
};
const DARK_LABELS: LabLabelProfile = {
  plate: "surface",
  plateOpacity: 0.9,
  outline: "textSecondary",
  outlineAlpha: 0.22,
  halo: "background",
  haloAlpha: 0.55,
  haloSpread: 3,
  haloBlur: 5,
  hairlineDp: 1.25,
  leaderDp: 6,
};
const LIGHT_LABELS: LabLabelProfile = {
  plate: "surface",
  plateOpacity: 0.94,
  outline: "textSecondary",
  outlineAlpha: 0.25,
  halo: "background",
  haloAlpha: 0.5,
  haloSpread: 3,
  haloBlur: 5,
  hairlineDp: 1.5,
  leaderDp: 6,
};

/**
 * WP-2.2 Standard Dark identity: the Standard package promises "flatter and
 * calmer", so its sky is a quiet graphite chart, not a nebula — barely-there
 * clouds, no ember, crisp sparse stars with almost no twinkle, a softer
 * vignette; the chart graticule (below) carries the identity instead.
 */
const STANDARD_DARK_ENV: LabEnvProfile = {
  ...DARK_ENV,
  strengthA: 0.09,
  strengthB: 0.07,
  glow: 0.02,
  ember: 0,
  dust: 0.1,
  vignette: 0.5,
  starDensity: 0.55,
  starSoft: false,
  starAlpha: 0.7,
  starTint: 0.1,
  twinkle: 0.06,
};
/** Standard Dark rings: calmer flow (C-04 stays on, at half strength). */
const STANDARD_DARK_RINGS: LabRingProfile = { ...DARK_RINGS, flow: 0.45 };
const STANDARD_DARK_CHART: LabChartProfile = {
  tone: "textSecondary",
  alpha: 0.1,
  scaleAlpha: 0.3,
  spokeDeg: 30,
  rings: 6,
};
const STANDARD_LIGHT_CHART: LabChartProfile = {
  tone: "textSecondary",
  alpha: 0.1,
  scaleAlpha: 0.26,
  spokeDeg: 30,
  rings: 6,
};

const HUD: LabFxProfile["hud"] = {
  plate: "surface",
  plateOpacity: HUD_PLATE_OPACITY,
  text: "textPrimary",
  graph: "statusStable",
  warn: "statusWobble",
  bad: "statusDecay",
};
const ROLES: LabFxProfile["roles"] = {
  sky: "background",
  skyAccent: "accent",
  starDim: "textSecondary",
  starBright: "textPrimary",
  highlight: "textPrimary",
  instrument: "accent",
};

export const LAB_FX_PROFILES: Readonly<
  Record<ThemePackage, Record<LabThemeMode, LabFxProfile>>
> = {
  galaxy: {
    dark: {
      intensity: GALAXY_DARK_INTENSITY,
      env: DARK_ENV,
      bodies: DARK_BODIES,
      rings: DARK_RINGS,
      labels: DARK_LABELS,
      chart: null,
      blend: "additive",
      hud: HUD,
      roles: ROLES,
    },
    light: {
      intensity: GALAXY_LIGHT_INTENSITY,
      env: LIGHT_ENV,
      bodies: LIGHT_BODIES,
      rings: LIGHT_RINGS,
      labels: LIGHT_LABELS,
      chart: null,
      blend: "multiply",
      hud: HUD,
      roles: ROLES,
    },
  },
  standard: {
    dark: {
      intensity: STANDARD_DARK_INTENSITY,
      env: STANDARD_DARK_ENV,
      bodies: DARK_BODIES,
      rings: STANDARD_DARK_RINGS,
      labels: DARK_LABELS,
      chart: STANDARD_DARK_CHART,
      blend: "additive",
      hud: HUD,
      roles: ROLES,
    },
    light: {
      intensity: STANDARD_LIGHT_INTENSITY,
      env: LIGHT_ENV,
      bodies: LIGHT_BODIES,
      rings: LIGHT_RINGS,
      labels: LIGHT_LABELS,
      chart: STANDARD_LIGHT_CHART,
      blend: "multiply",
      hud: HUD,
      roles: ROLES,
    },
  },
};

/**
 * Resolve the lab profile; unknown inputs fall back to Galaxy Dark.
 * `standardIdentity` false (panel flag `stdChart` off) restores the pre-WP-2.2
 * Standard profiles (Galaxy's sky / rings at Standard intensity, no chart) for
 * the A/B.
 */
export function resolveLabFxProfile(
  themePackage: string | undefined,
  mode: string | undefined,
  standardIdentity = true,
): LabFxProfile {
  const byPackage =
    LAB_FX_PROFILES[(themePackage as ThemePackage) ?? "galaxy"] ??
    LAB_FX_PROFILES.galaxy;
  const profile = byPackage[mode === "light" ? "light" : "dark"];
  if (standardIdentity || themePackage !== "standard") return profile;
  return mode === "light"
    ? { ...profile, chart: null }
    : { ...profile, env: DARK_ENV, rings: DARK_RINGS, chart: null };
}

/** Read a lab role's token value from the live palette. */
export function labColor(colors: ThemePalette, token: LabColorToken): string {
  return colors[token];
}
