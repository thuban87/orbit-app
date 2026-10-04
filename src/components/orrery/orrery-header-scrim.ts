/**
 * 38.7-12 (D-39): the fading scrim behind the Orrery title, ported as drawn
 * from Lab B's IMMERSE header (`labb-header-scrim.ts`, lab commit 13c706ad).
 * Pure profile math; `OrreryImmersiveHeader` paints it in a theme token.
 *
 * The scrim is dense behind the title bar (SCRIM_TOP at the very top, easing
 * to SCRIM_BAR at the bar's bottom edge) and fades to nothing SCRIM_TAIL dp
 * below the bar, so the map runs up under the title without a hard edge.
 * Legibility is re-proven numerically in Plan 14 (D-28).
 */

/** Scrim opacity at the very top, continuous with the status-bar band (Lab B 0.96). */
export const HEADER_SCRIM_TOP = 0.96;
/** Scrim opacity at the bar's bottom edge, behind the title (Lab B 0.84). */
export const HEADER_SCRIM_BAR = 0.84;
/** Fade-out distance below the bar, dp (Lab B 44). */
export const HEADER_SCRIM_TAIL = 44;
/** Bands across the bar and across the tail (Lab B 4 / 22): a stepped gradient, no gradient dependency. */
const BAR_BANDS = 4;
const TAIL_BANDS = 22;

/** Target scrim opacity `y` dp below the top of a bar `barHeight` dp tall. */
export function headerScrimAlpha(y: number, barHeight: number): number {
  if (y <= barHeight)
    return (
      HEADER_SCRIM_TOP +
      (HEADER_SCRIM_BAR - HEADER_SCRIM_TOP) * (y / Math.max(1, barHeight))
    );
  const t = Math.min(1, (y - barHeight) / HEADER_SCRIM_TAIL);
  return HEADER_SCRIM_BAR * (1 - t) ** 2; // ease-out: most of the fade near the bar
}

/**
 * Nested bands, all anchored at the top: band k covers [0, end_k] at opacity
 * a_k, so every band edge is one small alpha step and no two edges overlap
 * (abutting bands showed hairline seams on device in Lab B). a_k solves
 * 1 − Π(1 − a_i) = the target alpha just above end_k. Returns
 * [height, opacity][] tallest first; empty before the bar is measured.
 */
export function headerScrimBands(barHeight: number): [number, number][] {
  if (!(barHeight > 0) || !Number.isFinite(barHeight)) return [];
  const ends: number[] = [];
  for (let i = 0; i < TAIL_BANDS; i++)
    ends.push(barHeight + HEADER_SCRIM_TAIL * (1 - i / TAIL_BANDS));
  for (let i = 0; i < BAR_BANDS; i++)
    ends.push(barHeight * (1 - i / BAR_BANDS));
  const out: [number, number][] = [];
  let transmit = 1;
  for (let k = 0; k < ends.length; k++) {
    const next = k + 1 < ends.length ? ends[k + 1] : 0;
    const target = headerScrimAlpha((ends[k] + next) / 2, barHeight);
    const want = 1 - target;
    const a = want >= transmit ? 0 : 1 - want / transmit;
    transmit *= 1 - a;
    if (a > 0) out.push([ends[k], a]);
  }
  return out;
}
