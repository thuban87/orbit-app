/**
 * The see-through List row's backing while it is swiped (38.5 review WR-01;
 * owner ruling R1a, D-48, 2026-09-29).
 *
 * `ReanimatedSwipeable` paints the Log/Edit action panel BEHIND the row, and
 * shows it as soon as the row moves (its action layer goes from opacity 0 to 1
 * on the first non-zero translation). A row signed `seeThrough` draws only a
 * thin `surface` tint (0.05 in the signed v3 table), so mid-swipe the panel
 * showed through the row almost at full strength. The owner ruled that the
 * tint rises to `SWIPE_ROW_BACKING_OPACITY` while the row is swiped, and not
 * to a full backing: "I don't want to do a full backing on the row when it's
 * moving, that'll look funny. Can we try a 50% transparency maybe instead?"
 *
 * The mapping is a STEP, not a ramp: the panel appears on the first non-zero
 * translation, and at small translations the row's name and meta text already
 * sit over the panel fill (they start 74 px into the row; the panel is 96 px
 * wide). A ramp would leave that text over the panel below the proven 0.5.
 *
 * At rest the row keeps its signed level. Rows signed `full` (solid fill) or
 * `none` have no tint layer (`restTintOpacity` null) and are unaffected.
 *
 * Contrast (proven in `tokens/surface.test.ts`, "Swiped see-through List
 * row"): row text at 0.5 clears AA over the shipped art and over the panel's
 * fill and border in all 11 signed see-through List cells, and never reaches the
 * panel's label and icon glyphs. The row's trailing favourite/status icons and
 * its ring border do cross those glyphs in motion; that overlap fails at 0.5
 * and is an owner-accepted, recorded exemption (D-48), for icons and the ring
 * only.
 *
 * PURE: no react-native import, node-testable. `swipeRowTintOpacity` is a
 * worklet (it runs in the row tint's `useAnimatedStyle` on the UI thread), and
 * the constant it reads is declared above it.
 */

/** The see-through List row's tint opacity while the row is swiped (D-48). */
export const SWIPE_ROW_BACKING_OPACITY = 0.5;

/**
 * The List row's tint opacity at a swipe translation.
 *   - `restTintOpacity` null (a `full` or `none` row: no tint layer): null.
 *   - translation 0 (at rest): the signed level, unchanged.
 *   - any other translation: `SWIPE_ROW_BACKING_OPACITY`, or the signed level
 *     if that is ever higher (a swipe never makes a row thinner).
 */
export function swipeRowTintOpacity(
  restTintOpacity: number | null,
  translation: number,
): number | null {
  "worklet";
  if (restTintOpacity === null) return null;
  if (translation === 0) return restTintOpacity;
  return Math.max(restTintOpacity, SWIPE_ROW_BACKING_OPACITY);
}
