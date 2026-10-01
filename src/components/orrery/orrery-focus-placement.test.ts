import { describe, expect, it } from "vitest";
import {
  FOCUS_CARD_GAP,
  FOCUS_LABEL_RESERVE,
  focusCardPlacement,
} from "./orrery-focus-placement";

const region = { x: 0, y: 60, width: 420, height: 700 };
const card = { width: 280, height: 160 };

function overlaps(
  place: { left: number; top: number; maxHeight: number },
  body: { x: number; y: number; radius: number },
  height: number,
) {
  const h = Math.min(height, place.maxHeight);
  const keepTop = body.y - body.radius - FOCUS_LABEL_RESERVE;
  const keepBottom = body.y + body.radius + FOCUS_LABEL_RESERVE;
  const vertical = place.top < keepBottom && place.top + h > keepTop;
  const horizontal =
    place.left < body.x + 100 && place.left + card.width > body.x - 100;
  return vertical && horizontal;
}

describe("WP-2.2 focus card anchoring", () => {
  it("goes below the body AND its label reserve when there is room", () => {
    const body = { x: 210, y: 300, radius: 40 };
    const p = focusCardPlacement(region, body, card, 1);
    expect(p.side).toBe("below");
    expect(p.top).toBe(300 + 40 + FOCUS_LABEL_RESERVE + FOCUS_CARD_GAP);
    expect(overlaps(p, body, card.height)).toBe(false);
  });
  it("flips above a low body instead of clamping over its face", () => {
    const body = { x: 210, y: 650, radius: 40 };
    const p = focusCardPlacement(region, body, card, 1);
    expect(p.side).toBe("above");
    expect(overlaps(p, body, card.height)).toBe(false);
  });
  it("uses the side when a big detail-zoom body fills the middle", () => {
    const wide = { x: 0, y: 60, width: 900, height: 420 };
    const body = { x: 300, y: 270, radius: 120 };
    const p = focusCardPlacement(wide, body, card, 1);
    expect(p.side).toBe("right");
    expect(p.left).toBeGreaterThanOrEqual(300 + 120);
  });
  it("caps the height on the roomier side when nothing fits whole", () => {
    const body = { x: 210, y: 360, radius: 120 };
    const p = focusCardPlacement(region, body, { width: 280, height: 400 }, 1);
    expect(["below", "above"]).toContain(p.side);
    expect(p.maxHeight).toBeLessThan(400);
    expect(overlaps(p, body, 400)).toBe(false);
  });
  it("scales the label reserve with the font scale", () => {
    const body = { x: 210, y: 300, radius: 40 };
    const a = focusCardPlacement(region, body, card, 1);
    const b = focusCardPlacement(region, body, card, 1.5);
    expect(b.top - a.top).toBeCloseTo(FOCUS_LABEL_RESERVE * 0.5, 6);
  });
  it("stays inside the usable region horizontally", () => {
    const body = { x: 15, y: 300, radius: 20 };
    const p = focusCardPlacement(region, body, card, 1);
    expect(p.left).toBeGreaterThanOrEqual(region.x);
    expect(p.left + card.width).toBeLessThanOrEqual(region.x + region.width);
  });
});
