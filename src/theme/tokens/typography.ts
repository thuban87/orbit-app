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

/** Semantic font family — remapped to a loaded font key in AppText. */
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
