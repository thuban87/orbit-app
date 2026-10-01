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

// --- Tunables -----------------------------------------------------------------
const GALAXY_DARK_INTENSITY = 1;
const GALAXY_LIGHT_INTENSITY = 0.7;
const STANDARD_DARK_INTENSITY = 0.85;
/** Standard Light is the deliberately muted variant (≈0.5× Galaxy Light). */
const STANDARD_LIGHT_INTENSITY = 0.35;
const HUD_PLATE_OPACITY = 0.82;

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
      blend: "additive",
      hud: HUD,
      roles: ROLES,
    },
    light: {
      intensity: GALAXY_LIGHT_INTENSITY,
      blend: "multiply",
      hud: HUD,
      roles: ROLES,
    },
  },
  standard: {
    dark: {
      intensity: STANDARD_DARK_INTENSITY,
      blend: "additive",
      hud: HUD,
      roles: ROLES,
    },
    light: {
      intensity: STANDARD_LIGHT_INTENSITY,
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
