/**
 * ORRERY LAB A (pass 2, pass 3) — focus card placement, presentation only.
 *
 * The card (`OrreryFocusContext`) follows the focused body on the UI thread.
 * Focus framing (`frameBodies` in OrreryScreen) centres the body in the
 * usable rect and does NOT treat the card as an obstacle (the card is
 * filtered out of the panel/controls viewports and never registers one), so
 * a tall card used to be clamped UP over the body and its reticle. Here the
 * card clears the drawn body + reticle and flips ABOVE the body when it
 * cannot fit below; only if neither side fits does it clamp (overlap).
 *
 * Pass 3: it also clears the focused body's own label plate (+ context line
 * at detail zoom). The plate's side mirrors `allocateLabels`: below the body
 * when it fits in the usable rect, else the fixed alternate above. Its size
 * mirrors `prepareOrreryText` (line height × font scale + vertical padding).
 */
import {
  RETICLE_RING_DP,
  RETICLE_STROKE_DP,
  RETICLE_TICK_DP,
} from "./deep-field-config";
import { bodyVisualScale, reticleGeometry } from "./deep-field-math";

/** Mirrors OrreryWorld LABEL_BODY_GAP / orrery-label-logic CONTEXT_GAP. */
export const FOCUS_LABEL_GAP = 8;
export const FOCUS_CONTEXT_GAP = 4;

/** Screen clearance below/above a focused body's centre (dp): reticle box. */
export function focusClearance(projectedRadius: number): number {
  "worklet";
  const drawn = projectedRadius * bodyVisualScale(projectedRadius);
  const { half } = reticleGeometry(drawn);
  const ticks = drawn + RETICLE_RING_DP + 1.5 + RETICLE_TICK_DP;
  return Math.max(half + RETICLE_STROKE_DP, ticks);
}

/**
 * Pass 3: the vertical room the card may use, given its horizontal span. The
 * camera's usable rect is the largest obstacle-free rectangle, so it excludes
 * the whole band beside the controls column even where the (narrower) card
 * would not touch it. Here only obstacles that overlap the card's own x-span
 * bound it; the result never shrinks below the usable rect.
 */
export function focusCardRoom(
  viewport: {
    width: number;
    height: number;
    usable?: { x: number; y: number; width: number; height: number };
    obstacles?: readonly {
      x: number;
      y: number;
      width: number;
      height: number;
    }[];
  },
  region: { y: number; height: number },
  left: number,
  width: number,
  bodyY: number,
  margin: number,
): { y: number; height: number } {
  "worklet";
  const limitTop = Math.max(0, viewport.usable?.y ?? 0);
  const limitBottom = Math.min(
    viewport.height,
    viewport.usable
      ? viewport.usable.y + viewport.usable.height
      : viewport.height,
  );
  let top = limitTop;
  let bottom = limitBottom;
  const obstacles = viewport.obstacles ?? [];
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    if (!(o.width > 0 && o.height > 0)) continue;
    if (o.x >= left + width || o.x + o.width <= left) continue;
    if (o.y >= bodyY) bottom = Math.min(bottom, o.y - margin);
    else if (o.y + o.height <= bodyY)
      top = Math.max(top, o.y + o.height + margin);
  }
  const y = Math.min(top, region.y);
  const end = Math.max(bottom, region.y + region.height);
  return { y, height: Math.max(0, end - y) };
}

/** Smallest card height we will shrink to (the card scrolls inside). */
export const FOCUS_CARD_MIN_HEIGHT = 112;

export interface FocusCardPlacement {
  top: number;
  maxHeight: number;
}

/**
 * The focused body's label stack, in dp from the body EDGE (frame radius):
 * `name` = gap + name plate (decides the side, as the allocator does);
 * `block` = the whole stack incl. the context line when it can show.
 */
export interface FocusLabelBlock {
  name: number;
  block: number;
}

export function focusLabelBlock(
  fontScale: number,
  lineHeight: number,
  verticalPadding: number,
  withContext: boolean,
): FocusLabelBlock {
  "worklet";
  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const plate = lineHeight * scale + verticalPadding * 2;
  const name = FOCUS_LABEL_GAP + plate;
  return {
    name,
    block: withContext ? name + FOCUS_CONTEXT_GAP + plate : name,
  };
}

/**
 * Below the body if the card fits, else above it, else the roomier side with
 * the card's height capped to that room (its content scrolls) so it never
 * covers the focused body, its reticle or its label plate. Only when even the
 * minimum height does not fit does it clamp into the region (overlap).
 */
export function focusCardPlacement(
  region: { y: number; height: number },
  bodyY: number,
  projectedRadius: number,
  cardHeight: number,
  gap: number,
  label?: FocusLabelBlock,
): FocusCardPlacement {
  "worklet";
  const reticle = focusClearance(projectedRadius);
  const bottom = region.y + region.height;
  // Allocator order: the plate goes below when it fits, else above.
  const labelBelow = !!label && bodyY + projectedRadius + label.name <= bottom;
  const labelReach = label ? projectedRadius + label.block : 0;
  const clearBelow = Math.max(reticle, labelBelow ? labelReach : 0) + gap;
  const clearAbove =
    Math.max(reticle, label && !labelBelow ? labelReach : 0) + gap;
  const below = bodyY + clearBelow;
  const aboveEdge = bodyY - clearAbove;
  if (below + cardHeight <= bottom)
    return { top: below, maxHeight: cardHeight };
  if (aboveEdge - cardHeight >= region.y)
    return { top: aboveEdge - cardHeight, maxHeight: cardHeight };
  const roomBelow = bottom - below;
  const roomAbove = aboveEdge - region.y;
  if (Math.max(roomBelow, roomAbove) >= FOCUS_CARD_MIN_HEIGHT) {
    return roomBelow >= roomAbove
      ? { top: below, maxHeight: roomBelow }
      : { top: region.y, maxHeight: roomAbove };
  }
  const h = Math.min(cardHeight, region.height);
  return {
    top: Math.max(region.y, Math.min(bottom - h, below)),
    maxHeight: h,
  };
}

/** Narrowest card we will use to slip beside an obstacle (dp). */
export const FOCUS_CARD_NARROW = 168;
/** Extra height allowed for a narrowed card: its measured (wide) content
 *  height can grow when a text line wraps at the narrower width. The card
 *  only has a max height, so unused slack is never drawn. */
export const FOCUS_CARD_NARROW_SLACK = 44;

export interface FocusCardLayout {
  left: number;
  width: number;
  top: number;
  maxHeight: number;
}

type Rect = { x: number; y: number; width: number; height: number };

/**
 * Pass 3: the full card layout. Centred on the body at `maxWidth` first; if
 * that cannot show the whole card (it would be capped / scroll), try a
 * narrower card (≥ FOCUS_CARD_NARROW) beside each obstacle below the body
 * that blocks it,
 * and keep whichever candidate shows the most of the card. Presentation
 * only — obstacles and the usable rect are read, never changed.
 */
export function focusCardLayout(
  viewport: {
    width: number;
    height: number;
    usable?: Rect;
    obstacles?: readonly Rect[];
  },
  region: Rect,
  bodyX: number,
  bodyY: number,
  projectedRadius: number,
  cardHeight: number,
  gap: number,
  maxWidth: number,
  label?: FocusLabelBlock,
): FocusCardLayout {
  "worklet";
  const width = Math.min(maxWidth, region.width);
  const left = Math.max(
    region.x,
    Math.min(region.x + region.width - width, bodyX - width / 2),
  );
  const wide = focusCardPlacement(
    focusCardRoom(viewport, region, left, width, bodyY, gap),
    bodyY,
    projectedRadius,
    cardHeight,
    gap,
    label,
  );
  let best: FocusCardLayout = { left, width, ...wide };
  if (wide.maxHeight >= cardHeight) return best;
  const obstacles = viewport.obstacles ?? [];
  const minX = region.x + gap;
  const maxX = region.x + region.width - gap;
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    if (!(o.width > 0 && o.height > 0)) continue;
    if (o.x >= left + width || o.x + o.width <= left) continue;
    // Only obstacles BELOW the body block the preferred (below) side.
    if (o.y < bodyY) continue;
    const sides = [
      { from: minX, to: o.x - gap },
      { from: o.x + o.width + gap, to: maxX },
    ];
    for (let k = 0; k < sides.length; k++) {
      const w = Math.min(width, sides[k].to - sides[k].from);
      if (w < FOCUS_CARD_NARROW) continue;
      const l = Math.max(
        sides[k].from,
        Math.min(sides[k].to - w, bodyX - w / 2),
      );
      const p = focusCardPlacement(
        focusCardRoom(viewport, region, l, w, bodyY, gap),
        bodyY,
        projectedRadius,
        w < width ? cardHeight + FOCUS_CARD_NARROW_SLACK : cardHeight,
        gap,
        label,
      );
      if (p.maxHeight > best.maxHeight + 0.5)
        best = { left: l, width: w, ...p };
    }
  }
  return best;
}
