/**
 * Spacing tokens (UI-SPEC Spacing Scale — dossier §J).
 *
 * All values are multiples of 4. Principle: compact WITHIN components, generous
 * BETWEEN conceptual groups. `md = 12` is intentionally kept (grid-aligned, real
 * need for dense row inner padding where 8 is too tight and 16 too loose).
 *
 * PURE DATA — no react-native import, no colour literal. The 44×44 minimum touch
 * target is a floor, not a spacing token; user-controlled density is out of scope.
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
} as const;

export type SpacingToken = keyof typeof SPACING;
