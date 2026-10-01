/**
 * ORRERY LAB B — WP-2.2 focus-card anchoring (M1-CRITIQUE: "the companion
 * popover hides the focused body's own label and, at detail zoom, half the
 * face").
 *
 * The legacy rule put the card's top edge just under the body
 * (`body.y + radius + SPACING.sm`), exactly where the allocator puts the body's
 * name tag, and clamped it back up over the face when the body sat low. This
 * pure worklet keeps the card OUT of a keep-out box around the locked body and
 * its label reserve (above or below — the allocator may flip the tag), trying,
 * in order: below, above, right, left. When none fits whole it docks the card
 * on the side with the most room and caps its height there (the card scrolls),
 * so the face and name stay visible whenever the usable rect allows it.
 *
 * Content, actions and accessibility of the card are untouched — only where it
 * sits. Node-testable; Hermes rule: no default parameters, helpers above.
 */

export interface FocusCardRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FocusCardPlacement {
  left: number;
  top: number;
  /** Height cap for this placement (the card scrolls past it). */
  maxHeight: number;
  side: "below" | "above" | "right" | "left" | "dock";
}

/** Gap between the keep-out box and the card (dp). */
export const FOCUS_CARD_GAP = 10;
/** Half-width the label may take around the body centre (dp, before fontScale). */
export const FOCUS_LABEL_HALF_WIDTH = 100;
/** Vertical reserve for the name tag + caption on either side (dp, before fontScale). */
export const FOCUS_LABEL_RESERVE = 58;
/** Smallest useful card height when docking (dp). */
export const FOCUS_CARD_MIN_HEIGHT = 96;

function clampTo(v: number, lo: number, hi: number): number {
  "worklet";
  return hi < lo ? lo : v < lo ? lo : v > hi ? hi : v;
}

/**
 * Where the focus card goes. `card.height` is the card's measured height (its
 * natural content height, already capped at half the region by the caller).
 */
export function focusCardPlacement(
  region: FocusCardRect,
  body: { x: number; y: number; radius: number },
  card: { width: number; height: number },
  fontScale: number,
): FocusCardPlacement {
  "worklet";
  const scale = fontScale > 0 ? fontScale : 1;
  const reserve = FOCUS_LABEL_RESERVE * scale;
  const half = Math.max(body.radius, FOCUS_LABEL_HALF_WIDTH * scale);
  const keep = {
    left: body.x - half,
    right: body.x + half,
    top: body.y - body.radius - reserve,
    bottom: body.y + body.radius + reserve,
  };
  const rx0 = region.x;
  const ry0 = region.y;
  const rx1 = region.x + region.width;
  const ry1 = region.y + region.height;
  const w = card.width;
  const h = card.height;
  const centredX = clampTo(body.x - w / 2, rx0, rx1 - w);
  const centredY = clampTo(body.y - h / 2, ry0, ry1 - h);
  const below = ry1 - (keep.bottom + FOCUS_CARD_GAP);
  const above = keep.top - FOCUS_CARD_GAP - ry0;
  const right = rx1 - (keep.right + FOCUS_CARD_GAP);
  const left = keep.left - FOCUS_CARD_GAP - rx0;
  if (below >= h)
    return {
      left: centredX,
      top: keep.bottom + FOCUS_CARD_GAP,
      maxHeight: h,
      side: "below",
    };
  if (above >= h)
    return {
      left: centredX,
      top: keep.top - FOCUS_CARD_GAP - h,
      maxHeight: h,
      side: "above",
    };
  if (right >= w)
    return {
      left: keep.right + FOCUS_CARD_GAP,
      top: centredY,
      maxHeight: h,
      side: "right",
    };
  if (left >= w)
    return {
      left: keep.left - FOCUS_CARD_GAP - w,
      top: centredY,
      maxHeight: h,
      side: "left",
    };
  // Nothing fits whole: take the roomier of below / above if it is still
  // useful (cap the height; the card scrolls), else dock at the region edge
  // farthest from the body.
  if (Math.max(below, above) >= FOCUS_CARD_MIN_HEIGHT) {
    if (below >= above)
      return {
        left: centredX,
        top: keep.bottom + FOCUS_CARD_GAP,
        maxHeight: below,
        side: "below",
      };
    return {
      left: centredX,
      top: ry0 + Math.max(0, above - h),
      maxHeight: above,
      side: "above",
    };
  }
  const lowHalf = body.y < ry0 + region.height / 2;
  return {
    left: centredX,
    top: lowHalf ? ry1 - h : ry0,
    maxHeight: h,
    side: "dock",
  };
}
