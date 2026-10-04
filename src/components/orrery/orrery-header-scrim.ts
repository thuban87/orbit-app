/**
 * 38.7-12 (D-39): the fading scrim behind the Orrery title, ported as drawn
 * from Lab B's IMMERSE header (`labb-header-scrim.ts`, lab commit 13c706ad).
 * Pure profile math; `OrreryImmersiveHeader` paints it in a theme token.
 *
 * The scrim is dense behind the title bar (SCRIM_TOP at the very top, easing
 * to SCRIM_BAR at the bar's bottom edge) and fades to nothing SCRIM_TAIL dp
 * below the bar, so the map runs up under the title without a hard edge.
 * Legibility is re-proven numerically in Plan 14 (D-28): `surface.test.ts`
 * "Orrery title over the V2 sky" composites the bar's chrome scrim over this
 * scrim at HEADER_SCRIM_BAR over pure black and pure white content. Per-theme
 * minimum scrim under the title for 4.5:1 (38.7-14; Lab B's 0.84 passes all):
 * Galaxy Dark 0.61, Standard Light 0.04, Galaxy Light and Standard Dark 0
 * (their bar's own chrome scrim is opaque enough on its own).
 *
 * 38.7-14 (owner-approved fix, light mode only): over a light map the bar's
 * own `surface` chrome scrim (ShellAppBar, unchanged) ended at the bar's
 * bottom edge while this scrim continued at SCRIM_BAR in `background`, so the
 * bar showed a visible step there (Standard Light luma ~248 → 241 → 228). In
 * light mode the scrim is now painted in the bar's own `surface` ink and its
 * tail starts, right at the bar's clipped edge, at the bar's COMBINED opacity
 * 1 − (1 − SCRIM_BAR)(1 − bar scrim): the composite is identical on both
 * sides of the edge for every map pixel, then fades as before. Dark mode
 * (Galaxy Dark matches Lab B) is unchanged.
 */

/** Scrim opacity at the very top, continuous with the status-bar band (Lab B 0.96). */
export const HEADER_SCRIM_TOP = 0.96;
/** Scrim opacity at the bar's bottom edge, behind the title (Lab B 0.84). */
export const HEADER_SCRIM_BAR = 0.84;
/** Fade-out distance below the bar, dp (Lab B 44). */
export const HEADER_SCRIM_TAIL = 44;
/**
 * The light-mode step fix (see above). false = Lab B's look in light mode too
 * (the "before" for the owner's before/after).
 */
export const HEADER_SCRIM_LIGHT_CONTINUOUS = true;
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
 * 1 − Π(1 − a_i) = the target alpha sampled in [next end, end_k] (its
 * middle, or with `atTop` its top edge, so the stack's first sliver is exact).
 * `ends` run tallest first; returns [height, opacity][] tallest first.
 */
function nestedBands(
  ends: readonly number[],
  alphaAt: (y: number) => number,
  atTop = false,
): [number, number][] {
  const out: [number, number][] = [];
  let transmit = 1;
  for (let k = 0; k < ends.length; k++) {
    const next = k + 1 < ends.length ? ends[k + 1] : 0;
    const target = alphaAt(atTop ? next : (ends[k] + next) / 2);
    const want = 1 - target;
    const a = want >= transmit ? 0 : 1 - want / transmit;
    transmit *= 1 - a;
    if (a > 0) out.push([ends[k], a]);
  }
  return out;
}

/**
 * Lab B's bands over the bar and its tail in one top-anchored stack; empty
 * before the bar is measured.
 */
export function headerScrimBands(barHeight: number): [number, number][] {
  if (!(barHeight > 0) || !Number.isFinite(barHeight)) return [];
  const ends: number[] = [];
  for (let i = 0; i < TAIL_BANDS; i++)
    ends.push(barHeight + HEADER_SCRIM_TAIL * (1 - i / TAIL_BANDS));
  for (let i = 0; i < BAR_BANDS; i++)
    ends.push(barHeight * (1 - i / BAR_BANDS));
  return nestedBands(ends, (y) => headerScrimAlpha(y, barHeight));
}

/** The palette token the scrim is painted in, per resolved mode. */
export function headerScrimInkKey(
  mode: "dark" | "light",
): "surface" | "background" {
  return mode === "light" && HEADER_SCRIM_LIGHT_CONTINUOUS
    ? "surface"
    : "background";
}

/**
 * The scrim's layout. `barScrim` is the bar's own chrome scrim opacity
 * (`chromeScrimOpacity`); `barEdge` is where that scrim ends (the bar's clip:
 * its height less one hairline).
 *   - `bar`: top-anchored nested bands; in dark mode (or with the light fix
 *     off) Lab B's single stack over the bar AND the tail.
 *   - `tail`: light mode only — a second nested stack starting at `top`
 *     (= barEdge), from the bar's combined opacity down to 0 over SCRIM_TAIL.
 */
export function headerScrimLayout(
  barHeight: number,
  mode: "dark" | "light",
  barScrim: number,
  barEdge: number,
): {
  ink: "surface" | "background";
  bar: [number, number][];
  tail: { top: number; bands: [number, number][] } | null;
} {
  const ink = headerScrimInkKey(mode);
  if (ink === "background" || !(barHeight > 0) || !Number.isFinite(barHeight))
    return { ink, bar: headerScrimBands(barHeight), tail: null };
  const edge =
    Number.isFinite(barEdge) && barEdge > 0 && barEdge <= barHeight
      ? barEdge
      : barHeight;
  const ends: number[] = [];
  for (let i = 0; i < BAR_BANDS; i++) ends.push(edge * (1 - i / BAR_BANDS));
  const bar = nestedBands(ends, (y) => headerScrimAlpha(y, edge));
  // The bar's composite just above its edge: this stack, under the bar's own
  // chrome scrim. The tail starts exactly there.
  let barTransmit = 1;
  for (const [height, opacity] of bar)
    if (height >= edge) barTransmit *= 1 - opacity;
  const s = Number.isFinite(barScrim) ? Math.max(0, Math.min(1, barScrim)) : 0;
  const start = 1 - barTransmit * (1 - s);
  const tailEnds: number[] = [];
  for (let i = 0; i < TAIL_BANDS; i++)
    tailEnds.push(HEADER_SCRIM_TAIL * (1 - i / TAIL_BANDS));
  const tail = nestedBands(
    tailEnds,
    (y) => start * (1 - Math.min(1, y / HEADER_SCRIM_TAIL)) ** 2,
    true,
  );
  return { ink, bar, tail: { top: edge, bands: tail } };
}
