/** ORRERY LAB A (pass 3): focus card layout, reticle geometry, plane guards. */
import { describe, expect, it } from "vitest";
import {
  bodyDepthScale,
  bodyVisualScale,
  easeOutBack,
  moonVisualScale,
  orbitBodyScale,
  reticleDrawnRadius,
  reticleGeometry,
} from "./deep-field-math";
import {
  FOCUS_CARD_NARROW,
  focusCardLayout,
  focusCardPlacement,
  focusCardRoom,
  focusClearance,
  focusLabelBlock,
} from "./focus-card";

describe("reticle geometry", () => {
  it("hugs the drawn disc: box just outside it, arms bounded", () => {
    for (const drawn of [4.5, 13, 21, 40, 90]) {
      const { half, arm } = reticleGeometry(drawn);
      expect(half).toBeGreaterThan(drawn);
      expect(half - drawn).toBeLessThanOrEqual(
        Math.max(5, drawn * 0.16) + 1e-9,
      );
      expect(arm).toBeGreaterThanOrEqual(6);
      expect(arm).toBeLessThanOrEqual(15);
      expect(arm).toBeLessThan(half);
    }
  });
  it("drawn radius matches each body's root Group scale", () => {
    // Contact: world radius × orbitBodyScale == projected × visual × depth.
    const world = 18;
    const proj = 0.8;
    const far = 0.2;
    expect(reticleDrawnRadius("contact", world * proj, far)).toBeCloseTo(
      world * orbitBodyScale(proj, world, far),
      9,
    );
    expect(reticleDrawnRadius("contact", 13, 0)).toBeCloseTo(
      13 * bodyVisualScale(13) * bodyDepthScale(0),
      9,
    );
    expect(reticleDrawnRadius("sun", 30, 0.3)).toBe(30);
    expect(reticleDrawnRadius("satellite", 2, 0)).toBeCloseTo(
      2 * moonVisualScale(2),
      9,
    );
  });
  it("easeOutBack lands exactly and overshoots in between", () => {
    expect(easeOutBack(0, 1.6)).toBeCloseTo(0, 9);
    expect(easeOutBack(1, 1.6)).toBeCloseTo(1, 9);
    expect(
      Math.max(...[0.6, 0.7, 0.8].map((x) => easeOutBack(x, 1.6))),
    ).toBeGreaterThan(1);
  });
});

describe("focus card vs label plate", () => {
  const region = { y: 0, height: 700 };
  const label = focusLabelBlock(1.3, 20, 4, true);
  it("clears the label stack below the body", () => {
    const p = focusCardPlacement(region, 200, 20, 150, 8, label);
    expect(p.top).toBeGreaterThanOrEqual(200 + 20 + label.block);
  });
  it("clears a label that flipped above (no room below for it)", () => {
    const p = focusCardPlacement(region, 690, 20, 150, 8, label);
    expect(p.top + p.maxHeight).toBeLessThanOrEqual(690 - 20 - label.block);
  });
  it("without a label it only clears the reticle", () => {
    const p = focusCardPlacement(region, 200, 20, 150, 8);
    expect(p.top).toBeCloseTo(200 + focusClearance(20) + 8, 9);
  });
});

describe("focus card room + layout", () => {
  const viewport = {
    width: 411,
    height: 725,
    obstacles: [
      { x: 16, y: 16, width: 143, height: 48 },
      { x: 195, y: 472, width: 200, height: 173 },
    ],
  };
  const region = { x: 0, y: 64, width: 411, height: 408 };
  it("only obstacles under the card's own span bound the room", () => {
    const blocked = focusCardRoom(viewport, region, 65, 280, 268, 8);
    expect(blocked.y + blocked.height).toBeLessThanOrEqual(472);
    const clear = focusCardRoom(viewport, region, 16, 168, 268, 8);
    expect(clear.y + clear.height).toBe(725);
  });
  it("slips a narrower card beside the blocking obstacle", () => {
    const layout = focusCardLayout(viewport, region, 205, 268, 28, 200, 8, 280);
    expect(layout.width).toBeGreaterThanOrEqual(FOCUS_CARD_NARROW);
    expect(layout.left + layout.width).toBeLessThanOrEqual(195);
    expect(layout.maxHeight).toBeGreaterThanOrEqual(200);
    expect(layout.top).toBeGreaterThan(268);
  });
  it("keeps the centred card when it already fits", () => {
    const layout = focusCardLayout(viewport, region, 205, 150, 20, 100, 8, 280);
    expect(layout.width).toBe(280);
    expect(layout.maxHeight).toBe(100);
  });
});
