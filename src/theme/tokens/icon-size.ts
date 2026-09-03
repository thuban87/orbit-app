/**
 * Icon size tokens (THEME-09 / D-06, UI-SPEC Icon Sizes).
 *
 * The FOUR sanctioned icon dimensions (px). `Icon` resolves its rendered size
 * through this set ONLY — never a hardcoded pixel size — so the whole icon
 * system scales from one place. Lives under `/theme/` beside the other token
 * files (radii/spacing/motion); PURE DATA, no react-native import, no colour.
 *
 *   sm 16 — dense inline / metadata glyphs
 *   md 20 — default (body-adjacent controls)
 *   lg 24 — tab bar / primary affordances
 *   xl 28 — prominent / touch-forward actions
 */
export const ICON_SIZE = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
} as const;

export type IconSizeToken = keyof typeof ICON_SIZE;
