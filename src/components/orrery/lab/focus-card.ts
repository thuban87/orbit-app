/**
 * ORRERY LAB A (pass 2) — focus card placement, presentation only.
 *
 * The card (`OrreryFocusContext`) follows the focused body on the UI thread.
 * Focus framing (`frameBodies` in OrreryScreen) centres the body in the
 * usable rect and does NOT treat the card as an obstacle (the card is
 * filtered out of the panel/controls viewports and never registers one), so
 * a tall card used to be clamped UP over the body and its reticle. Here the
 * card clears the drawn body + reticle and flips ABOVE the body when it
 * cannot fit below; only if neither side fits does it clamp (overlap).
 */
import { RETICLE_ARM, RETICLE_GAP } from "./deep-field-config";
import { bodyVisualScale } from "./deep-field-math";

/** Screen clearance below/above a focused body's centre (dp). */
export function focusClearance(projectedRadius: number): number {
  "worklet";
  const drawn = projectedRadius * bodyVisualScale(projectedRadius);
  // Reticle = (r + gap) local units at scale ≈ drawn / r_world; brackets add
  // ~RETICLE_ARM of the radius. Approximated in screen space.
  return drawn * (1 + RETICLE_ARM * 0.5) + RETICLE_GAP * 1.6;
}

/** Smallest card height we will shrink to (the card scrolls inside). */
export const FOCUS_CARD_MIN_HEIGHT = 112;

export interface FocusCardPlacement {
  top: number;
  maxHeight: number;
}

/**
 * Below the body if the card fits, else above it, else the roomier side with
 * the card's height capped to that room (its content scrolls) so it never
 * covers the focused body or its reticle. Only when even the minimum height
 * does not fit does it clamp into the region (overlap, last resort).
 */
export function focusCardPlacement(
  region: { y: number; height: number },
  bodyY: number,
  projectedRadius: number,
  cardHeight: number,
  gap: number,
): FocusCardPlacement {
  "worklet";
  const clear = focusClearance(projectedRadius) + gap;
  const bottom = region.y + region.height;
  const below = bodyY + clear;
  const aboveEdge = bodyY - clear;
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
