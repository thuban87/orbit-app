/**
 * ORRERY LAB B — R3 immersive header scrim profile (pure; see
 * `LabImmersiveHeader.tsx`). Token colour is applied by the component.
 */
/** Scrim opacity at the very top (continuous with the status-bar band). */
export const SCRIM_TOP = 0.96;
/** Scrim opacity at the bar's bottom edge (behind the title's baseline). */
export const SCRIM_BAR = 0.84;
/** Fade-out distance below the bar (dp). */
export const SCRIM_TAIL = 44;
/** Bands per segment (a stepped gradient; no gradient dependency). */
const BAR_BANDS = 4;
const TAIL_BANDS = 22;

/** Target scrim opacity at `y` dp below the top. */
export function labHeaderScrimAlpha(y: number, barHeight: number): number {
  if (y <= barHeight)
    return SCRIM_TOP + (SCRIM_BAR - SCRIM_TOP) * (y / Math.max(1, barHeight));
  const t = Math.min(1, (y - barHeight) / SCRIM_TAIL);
  return SCRIM_BAR * (1 - t) ** 2; // ease-out: most of the fade near the bar
}

/**
 * Nested bands, all anchored at the top: band k covers [0, end_k] with
 * opacity a_k, so each band EDGE is a single small alpha step and no two
 * band edges overlap (adjacent abutting bands showed hairline seams on
 * device, iteration 1). a_k solves 1 − Π(1 − a_i) = target alpha of the
 * segment just above end_k. Returns [height, opacity][] tallest first.
 */
export function labHeaderScrimBands(barHeight: number): [number, number][] {
  if (!(barHeight > 0)) return [];
  const ends: number[] = [];
  for (let i = 0; i < TAIL_BANDS; i++)
    ends.push(barHeight + SCRIM_TAIL * (1 - i / TAIL_BANDS));
  for (let i = 0; i < BAR_BANDS; i++)
    ends.push(barHeight * (1 - i / BAR_BANDS));
  const out: [number, number][] = [];
  let transmit = 1;
  for (let k = 0; k < ends.length; k++) {
    const next = k + 1 < ends.length ? ends[k + 1] : 0;
    const target = labHeaderScrimAlpha((ends[k] + next) / 2, barHeight);
    const want = 1 - target;
    const a = want >= transmit ? 0 : 1 - want / transmit;
    transmit *= 1 - a;
    if (a > 0) out.push([ends[k], a]);
  }
  return out;
}
