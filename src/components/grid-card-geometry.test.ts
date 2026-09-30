import { describe, expect, it } from "vitest";
import {
  GRID_AVATAR_MAX,
  GRID_AVATAR_MIN,
  GRID_CARD_BORDER,
  GRID_CARD_PADDING,
  GRID_CORNER_CLEARANCE,
  GRID_CORNER_GLYPH,
  GRID_CORNER_INSET,
  GRID_RING_INSET,
  type GridCardGeometry,
  gridCardGeometry,
  gridCardWidth,
  gridColumnCount,
} from "./grid-card-geometry";

/** Distance from the ring circle to the nearer corner glyph box, minus the radius. */
function cornerGap(geometry: GridCardGeometry, avatarTop: number): number {
  const radius = geometry.ringBox / 2;
  const centreX = geometry.cardWidth / 2;
  const centreY = avatarTop + radius;
  const boxNear = GRID_CORNER_INSET;
  const boxFar = GRID_CORNER_INSET + GRID_CORNER_GLYPH;
  // Both glyph boxes are mirror images about the card's vertical centre line,
  // so the left box (x in [inset, inset + glyph]) decides both gaps.
  const nearestX = Math.min(Math.max(centreX, boxNear), boxFar);
  const nearestY = Math.min(Math.max(centreY, boxNear), boxFar);
  const rightNearestX = Math.min(
    Math.max(centreX, geometry.cardWidth - boxFar),
    geometry.cardWidth - boxNear,
  );
  const left = Math.hypot(centreX - nearestX, centreY - nearestY) - radius;
  const right =
    Math.hypot(centreX - rightNearestX, centreY - nearestY) - radius;
  return Math.min(left, right);
}

describe("gridCardWidth (D-06: nominal card width from the window)", () => {
  it("subtracts the content padding and the column gaps", () => {
    expect(gridCardWidth(393, 3)).toBe(115);
    expect(gridCardWidth(412, 3)).toBeCloseTo(121.333, 3);
    expect(gridCardWidth(393, 2)).toBe(176.5);
  });
});

describe("gridCardGeometry (D-06 photo size, D-07 corner clearance)", () => {
  it("sizes a 393 dp three-column card's photo from its width", () => {
    const geometry = gridCardGeometry(393, 3);
    expect(geometry).toEqual({
      cardWidth: 115,
      avatarSize: 89,
      ringBox: 97,
      avatarTop: 18,
    });
    expect(geometry.avatarSize).toBeGreaterThan(72);
    expect(geometry.avatarSize).toBeLessThanOrEqual(96);
    expect(geometry.avatarSize).toBeGreaterThanOrEqual(1.5 * 48);
  });

  it("caps the photo at GRID_AVATAR_MAX in two-column mode", () => {
    expect(gridCardGeometry(393, 2).avatarSize).toBe(GRID_AVATAR_MAX);
    expect(GRID_AVATAR_MAX).toBe(96);
  });

  it("never drops below GRID_AVATAR_MIN on a narrow three-column card", () => {
    expect(gridCardGeometry(320, 3).avatarSize).toBeGreaterThanOrEqual(
      GRID_AVATAR_MIN,
    );
  });

  it("keeps the ring box the avatar plus the ring inset on every side", () => {
    for (const [width, columns] of [
      [320, 2],
      [393, 3],
      [412, 3],
      [700, 4],
      [1024, 5],
    ] as const) {
      const geometry = gridCardGeometry(width, columns);
      expect(geometry.ringBox).toBe(geometry.avatarSize + 2 * GRID_RING_INSET);
    }
  });

  it("clears both corner glyphs at every width and font scale, with the smallest top that does", () => {
    const minTop = GRID_CARD_BORDER + GRID_CARD_PADDING;
    for (let width = 320; width <= 1024; width += 8) {
      for (const fontScale of [1.0, 1.15, 1.3, 1.4, 2.0]) {
        const columns = gridColumnCount(width, fontScale);
        const geometry = gridCardGeometry(width, columns);
        const where = `width ${width}, fontScale ${fontScale}, ${columns} columns`;

        expect(Number.isInteger(geometry.avatarTop), where).toBe(true);
        expect(geometry.avatarTop, where).toBeGreaterThanOrEqual(minTop);
        expect(geometry.avatarSize, where).toBeGreaterThanOrEqual(
          GRID_AVATAR_MIN,
        );
        expect(geometry.avatarSize, where).toBeLessThanOrEqual(GRID_AVATAR_MAX);
        // The ring (plus its inset gap) fits inside the card's padded width.
        expect(
          geometry.ringBox + 2 * (GRID_CARD_BORDER + GRID_CARD_PADDING),
          where,
        ).toBeLessThanOrEqual(geometry.cardWidth);
        expect(
          cornerGap(geometry, geometry.avatarTop),
          where,
        ).toBeGreaterThanOrEqual(GRID_CORNER_CLEARANCE - 1e-9);
        // Smallest integer: one pixel higher either breaks the floor or the gap.
        const higher = geometry.avatarTop - 1;
        expect(
          higher < minTop ||
            cornerGap(geometry, higher) < GRID_CORNER_CLEARANCE - 1e-9,
          where,
        ).toBe(true);
      }
    }
  });
});

describe("gridColumnCount (moved from CardGrid, unchanged)", () => {
  it("keeps the portrait thresholds", () => {
    expect(gridColumnCount(359, 1)).toBe(2);
    expect(gridColumnCount(393, 1.4)).toBe(2);
    expect(gridColumnCount(393, 1)).toBe(3);
    expect(gridColumnCount(600, 1.3)).toBe(4);
    expect(gridColumnCount(768, 1.2)).toBe(5);
    expect(gridColumnCount(768, 1.3)).toBe(4);
  });
});
