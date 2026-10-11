/**
 * Selected colour swatch on Settings > Appearance (38.9 D-60, audit K-28).
 * RN-free and node-testable.
 *
 * K-28: the selected swatch used an `accent` ring, and the selected accent
 * swatch's fill IS the accent, so the ring vanished. D-60 (owner): the selected
 * swatch (accent and star rows) shows an outer ring in `textPrimary`, separated
 * from the fill by a `surface` gap, plus a check mark on the fill. Unselected
 * swatches keep the `border` ring.
 *
 * Check colour on the fill (cycle-5 C5-L9):
 *   - accent rows: that accent's `onAccent` (AA-tested against every fill,
 *     `accents.test.ts`). The selected accent swatch is the ACTIVE accent, so
 *     the provider's `onAccent` already is `ACCENTS[id][mode].onAccent`.
 *   - star rows: the star colours are palette tokens with no accent id, so
 *     `starSwatchCheckTone` picks whichever of `textPrimary` and `background`
 *     contrasts more with that star colour (this plan only choice of
 *     candidates).
 */
import { contrastRatio } from "@/theme/contrast";
import type { ThemePalette } from "@/theme/theme-types";

/** The selected swatch's outer ring token (D-60). */
export const SWATCH_RING_TOKEN = "textPrimary" as const;
/** The gap between the ring and the fill (D-60). */
export const SWATCH_GAP_TOKEN = "surface" as const;
/** The unselected swatch's ring token. */
export const SWATCH_IDLE_RING_TOKEN = "border" as const;

export type StarSwatchCheckTone = "textPrimary" | "background";

/**
 * The check tone for a selected star swatch: the candidate with the higher
 * contrast against `fill` (ties go to `textPrimary`).
 */
export function starSwatchCheckTone(
  fill: string,
  palette: Pick<ThemePalette, "textPrimary" | "background">,
): StarSwatchCheckTone {
  return contrastRatio(palette.background, fill) >
    contrastRatio(palette.textPrimary, fill)
    ? "background"
    : "textPrimary";
}
