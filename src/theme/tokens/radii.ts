/**
 * Radii tokens (UI-SPEC Radii & Geometry — dossier §I).
 *
 * Orbit embraces a VERY ROUNDED visual language (the orbit/planet/ring metaphor),
 * but rounding still preserves hierarchy — not everything is a circle. `pill` (999)
 * fully rounds a rectangular control's ends; `full` (9999) is for circles
 * (avatars, status rings, circular icon buttons).
 *
 * PURE DATA — no react-native import, no colour literal.
 */
export const RADII = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof RADII;
