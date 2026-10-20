/**
 * Typography tokens (THEME-07, UI-SPEC Typography — dossier §H).
 *
 * FIVE semantic roles (display / heading / body / label / caption) over exactly
 * FOUR distinct sizes (28 / 20 / 16 / 14) and exactly TWO weights (Regular 400,
 * SemiBold 600). Roles — not raw font sizes — are what screens consume, so a font
 * family remap is a one-file edit with no screen rewrite.
 *
 * `label` and `caption` deliberately SHARE the 14 step and diverge by weight +
 * colour token (Label = SemiBold on textPrimary; Caption = Regular on
 * textSecondary), keeping a clear hierarchical step at every size with no 1px
 * near-collision.
 *
 * PURE DATA: this module imports nothing from react-native (node-testable) and
 * carries NO colour literal — each role names a colour TOKEN resolved through
 * `useTheme().colors[colorToken]` at render (AppText), never a hex. `lineHeight`
 * is an absolute px derived from the UI-SPEC multiplier; it is not a fixed height
 * or clamp, so OS text scaling still reflows (THEME-07).
 */

/** The five semantic typography roles (dossier §H). */
export type TypographyRole =
  | "display"
  | "heading"
  | "body"
  | "label"
  | "caption";

/** Semantic font family — remapped to a loaded font key by `resolveFontFamily`. */
export type FontFamily = "Space Grotesk" | "Inter";

/** The only two weights this phase ships. */
export type FontWeight = 400 | 600;

/** Colour is a TOKEN NAME (a `ThemePalette` text key), never a literal. */
export type TypographyColorToken = "textPrimary" | "textSecondary";

export interface TypographyStyle {
  family: FontFamily;
  size: number;
  weight: FontWeight;
  /** Absolute line height in px (size × UI-SPEC multiplier), reflow-friendly. */
  lineHeight: number;
  colorToken: TypographyColorToken;
}

export const TYPOGRAPHY: Record<TypographyRole, TypographyStyle> = {
  // 28 × 1.2
  display: {
    family: "Space Grotesk",
    size: 28,
    weight: 600,
    lineHeight: 34,
    colorToken: "textPrimary",
  },
  // 20 × 1.25
  heading: {
    family: "Space Grotesk",
    size: 20,
    weight: 600,
    lineHeight: 25,
    colorToken: "textPrimary",
  },
  // 16 × 1.5
  body: {
    family: "Inter",
    size: 16,
    weight: 400,
    lineHeight: 24,
    colorToken: "textPrimary",
  },
  // 14 × 1.4 — shares the 14 step with caption, diverges by weight + colour
  label: {
    family: "Inter",
    size: 14,
    weight: 600,
    lineHeight: 20,
    colorToken: "textPrimary",
  },
  // 14 × 1.4
  caption: {
    family: "Inter",
    size: 14,
    weight: 400,
    lineHeight: 20,
    colorToken: "textSecondary",
  },
};

/**
 * The Profile heading levels (38.14 D-52 scale S2, D-56).
 *
 * A Profile-ONLY scale, kept apart from `TYPOGRAPHY` so the global five-role /
 * four-size contract above (dossier §H) stays intact. Used by
 * `ProfileHeading` on the Profile alone; no other screen adopts it (D-56).
 *  - `h1` — a top-level Profile section heading (26), on the page with a rule;
 *  - `h2` — a sub-section heading on its card (20), in the accent text tone;
 *  - `h3` — a group label such as MOST RECENT / PREVIOUS (14), upper-case,
 *    letter-spaced and muted. The bundled font has no true small caps, so
 *    upper-case + letter-spacing is the rendering, as the owner-picked S2
 *    mockup draws it (RESEARCH A4).
 * All three use the bundled Space Grotesk SemiBold (no new font file). Colour
 * is a TOKEN name resolved through `useTheme()` at render, never a literal.
 */
export type ProfileHeadingLevel = "h1" | "h2" | "h3";

export type ProfileHeadingColorToken =
  | "textPrimary"
  | "textSecondary"
  | "accentText";

export interface ProfileHeadingStyle {
  family: FontFamily;
  size: number;
  weight: FontWeight;
  /** Absolute line height in px (size × multiplier), reflow-friendly. */
  lineHeight: number;
  colorToken: ProfileHeadingColorToken;
  /** Extra tracking in px; 0 for none. */
  letterSpacing: number;
  /** Whether the label renders upper-case (the H3 small-caps rendering). */
  uppercase: boolean;
}

export const PROFILE_HEADING_SCALE: Record<
  ProfileHeadingLevel,
  ProfileHeadingStyle
> = {
  // 26 × 1.2
  h1: {
    family: "Space Grotesk",
    size: 26,
    weight: 600,
    lineHeight: 31,
    colorToken: "textPrimary",
    letterSpacing: 0,
    uppercase: false,
  },
  // 20 × 1.25
  h2: {
    family: "Space Grotesk",
    size: 20,
    weight: 600,
    lineHeight: 25,
    colorToken: "accentText",
    letterSpacing: 0,
    uppercase: false,
  },
  // 14 × 1.4
  h3: {
    family: "Space Grotesk",
    size: 14,
    weight: 600,
    lineHeight: 20,
    colorToken: "textSecondary",
    letterSpacing: 1.2,
    uppercase: true,
  },
};

/**
 * The smallest share of its role size a one-line label may shrink to when it
 * is allowed to shrink rather than truncate (`adjustsFontSizeToFit` with
 * `minimumFontScale`). Below this floor the label truncates as usual.
 * First consumer: the Card view's one-line no-contact text (38.13 D-88).
 */
export const FIT_TEXT_MIN_SCALE = 0.75;

/**
 * Map the semantic family + weight to the concrete expo-font key registered in
 * `src/theme/fonts.ts` (`Inter-Regular` / `Inter-SemiBold` /
 * `SpaceGrotesk-SemiBold`). A distinct key per weight is required because
 * Android will not reliably synthesize a weight from one custom family, and the
 * bare semantic names ("Inter" / "Space Grotesk") are NOT registered. Every
 * `<Text>` that styles from `TYPOGRAPHY` resolves its `fontFamily` here — AppText
 * and the dashboard contact renderers alike (RG-031 ui-accessibility/AUD-UIA-015).
 */
export function resolveFontFamily(
  family: FontFamily,
  weight: FontWeight,
): string {
  if (family === "Space Grotesk") {
    return "SpaceGrotesk-SemiBold";
  }
  return weight === 600 ? "Inter-SemiBold" : "Inter-Regular";
}
