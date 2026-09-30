/**
 * PhotoLightbox tunables and pure math (38.6 D-03/D-15/D-16).
 *
 * Tunables sit at the top so device tuning with the owner (38.6-07) is a
 * single-number edit. Every colour stays a theme token in the component; these
 * are opacities over `colors.background`, never colours.
 */

/** Scrim opacity over `colors.background` — near-opaque (D-16). */
export const LIGHTBOX_SCRIM_OPACITY = 0.96;

/** Opacity of the `colors.background` circle behind the ✕ glyph. */
export const LIGHTBOX_CLOSE_BACKING_OPACITY = 0.7;
