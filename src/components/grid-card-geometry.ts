/**
 * Contacts Grid card geometry (38.6 D-06, D-07). Pure and deterministic from the
 * window width and column count: no onLayout, no text measurement.
 *
 * D-06: the photo is sized from the nominal card width ("about 2× to start"),
 * never hard-coded. D-07: the favourite star and the selection checkbox sit
 * GRID_CORNER_INSET from their card corners, so the ring's top offset is solved
 * per width to keep the circle clear of both glyph boxes.
 *
 * Every tunable sits at the top of this file. The final numbers are
 * device-tuned with the owner in 38.6-07.
 */
import { ICON_SIZE } from "@/theme/tokens/icon-size";
import { SPACING } from "@/theme/tokens/spacing";

/** The grid's horizontal content padding (each side). Device-tuned in 38.6-07. */
export const GRID_CONTENT_PADDING = SPACING.base;
/** The gap between cards in a row, and between rows. Device-tuned in 38.6-07. */
export const GRID_COLUMN_GAP = SPACING.sm;
/** GlassSurface's container border width (GlassSurface `borderWidth: 1`). */
export const GRID_CARD_BORDER = 1;
/** The card's inner padding (was 12 before D-06). Device-tuned in 38.6-07. */
export const GRID_CARD_PADDING = SPACING.sm;
/** The gap between the photo and its status ring (D-73a). */
export const GRID_RING_INSET = SPACING.xs;
/** The smallest Grid photo (the pre-38.6 size). */
export const GRID_AVATAR_MIN = SPACING["2xl"];
/** The largest Grid photo (D-06 "about 2×" of 48). Device-tuned in 38.6-07. */
export const GRID_AVATAR_MAX = 96;
/** D-07: the visible corner glyph's distance from the card's outer edges. */
export const GRID_CORNER_INSET = 5;
/** The corner glyphs' rendered size (`Icon size="md"`). */
export const GRID_CORNER_GLYPH = ICON_SIZE.md;
/** The corner controls' hit area, anchored at the card corner (D-07). */
export const GRID_CORNER_HIT = SPACING["2xl"];
/** The minimum gap between the ring circle and either corner glyph box. */
export const GRID_CORNER_CLEARANCE = SPACING.xs;
/**
 * Compensates the glyph's internal padding inside its 20 px box so the VISIBLE
 * glyph lands GRID_CORNER_INSET from the edge. Measured on device in 38.6-07.
 */
export const GRID_CORNER_OPTICAL_OFFSET = 0;

export interface GridCardGeometry {
  /** The nominal card width (a short last row's cards stretch wider). */
  cardWidth: number;
  /** The Avatar diameter. */
  avatarSize: number;
  /** The status ring's square box: avatar + GRID_RING_INSET on every side. */
  ringBox: number;
  /** The ring box's top, measured from the card's OUTER top edge. */
  avatarTop: number;
}

/** Portrait grid count; device UAT owns the exact thresholds. */
export function gridColumnCount(width: number, fontScale: number): number {
  if (width < 360 || fontScale >= 1.4) return 2;
  if (width >= 768 && fontScale <= 1.2) return 5;
  if (width >= 600 && fontScale <= 1.3) return 4;
  return 3;
}

/** The nominal card width: the window minus content padding and column gaps. */
export function gridCardWidth(windowWidth: number, numColumns: number): number {
  return (
    (windowWidth -
      2 * GRID_CONTENT_PADDING -
      GRID_COLUMN_GAP * (numColumns - 1)) /
    numColumns
  );
}

/** Guards `Math.ceil` against float noise just above an exact integer. */
const CEIL_EPSILON = 1e-9;

export function gridCardGeometry(
  windowWidth: number,
  numColumns: number,
): GridCardGeometry {
  const cardWidth = gridCardWidth(windowWidth, numColumns);
  const avatarSize = Math.min(
    GRID_AVATAR_MAX,
    Math.max(
      GRID_AVATAR_MIN,
      Math.floor(
        cardWidth -
          2 * (GRID_CARD_PADDING + GRID_CARD_BORDER + GRID_RING_INSET),
      ),
    ),
  );
  const ringBox = avatarSize + 2 * GRID_RING_INSET;
  const radius = ringBox / 2;
  // The glyph box's inner corner, from the card's outer top and side edges.
  const glyphEdge = GRID_CORNER_INSET + GRID_CORNER_GLYPH;
  // Horizontal distance from the ring centre to either glyph box's inner edge.
  const dx = Math.max(0, cardWidth / 2 - glyphEdge);
  // (dx)² + (avatarTop + R − glyphEdge)² ≥ (R + clearance)², solved for avatarTop.
  const reach = radius + GRID_CORNER_CLEARANCE;
  const dy = Math.sqrt(Math.max(0, reach * reach - dx * dx));
  const solvedTop = Math.ceil(dy + glyphEdge - radius - CEIL_EPSILON);
  const avatarTop = Math.max(GRID_CARD_BORDER + GRID_CARD_PADDING, solvedTop);
  return { cardWidth, avatarSize, ringBox, avatarTop };
}
