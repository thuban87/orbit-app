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
  vignette: 0.18,
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
      blend: "additive",
      hud: HUD,
      roles: ROLES,
    },
    light: {
      intensity: GALAXY_LIGHT_INTENSITY,
      env: LIGHT_ENV,
      blend: "multiply",
      hud: HUD,
      roles: ROLES,
    },
  },
  standard: {
    dark: {
      intensity: STANDARD_DARK_INTENSITY,
      env: DARK_ENV,
      blend: "additive",
      hud: HUD,
      roles: ROLES,
    },
    light: {
      intensity: STANDARD_LIGHT_INTENSITY,
      env: LIGHT_ENV,
      blend: "multiply",
      hud: HUD,
      roles: ROLES,
    },
  },
};

/** Resolve the lab profile; unknown inputs fall back to Galaxy Dark. */
export function resolveLabFxProfile(
  themePackage: string | undefined,
  mode: string | undefined,
): LabFxProfile {
  const byPackage =
    LAB_FX_PROFILES[(themePackage as ThemePackage) ?? "galaxy"] ??
    LAB_FX_PROFILES.galaxy;
  return byPackage[mode === "light" ? "light" : "dark"];
}

/** Read a lab role's token value from the live palette. */
export function labColor(colors: ThemePalette, token: LabColorToken): string {
  return colors[token];
}
