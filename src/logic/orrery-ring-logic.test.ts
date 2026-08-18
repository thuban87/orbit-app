/**
 * orrery-ring-logic — proof (ORR-04).
 *
 * Locks the status→stroke vocabulary that extends `ringVisual` (colour reused,
 * never re-mapped) with the stroke axis (solid→dashed→faded→faintTrace), the
 * rogue ring/body split (ring = colors.rogue amber, body = rogueExtinguished),
 * and the canonical `null`→neutral fallback (colour = colors.border) that
 * `sun-occupant-logic` reuses (C2-2).
 *
 * C2-3 gate-safety: the palette input is sourced from THEME_PRESETS (this test is
 * under /logic/, NOT check:colors-exempt) — never an inline hex fake palette.
 */
import { ringVisual } from "@/components/contact-card-ring";
import { THEME_PRESETS } from "@/theme/theme-presets";
import { describe, expect, it } from "vitest";
import { orreryRingStyle } from "./orrery-ring-logic";

const colors = THEME_PRESETS["space-dark"].dark;

describe("orreryRingStyle", () => {
  it("stable → solid stroke, body = full statusStable, colour reused from ringVisual", () => {
    const style = orreryRingStyle("stable", colors);
    expect(style.strokeStyle).toBe("solid");
    expect(style.color).toBe(ringVisual("stable", colors).color);
    expect(style.color).toBe(colors.statusStable);
    expect(style.bodyFill).toBe(colors.statusStable);
  });

  it("wobble → dashed stroke, body = full statusWobble", () => {
    const style = orreryRingStyle("wobble", colors);
    expect(style.strokeStyle).toBe("dashed");
    expect(style.color).toBe(colors.statusWobble);
    expect(style.bodyFill).toBe(colors.statusWobble);
  });

  it("decay → faded stroke (lower opacity per ringVisual), body = full statusDecay", () => {
    const style = orreryRingStyle("decay", colors);
    expect(style.strokeStyle).toBe("faded");
    expect(style.color).toBe(colors.statusDecay);
    expect(style.bodyFill).toBe(colors.statusDecay);
    expect(style.opacity).toBe(ringVisual("decay", colors).opacity);
  });

  it("rogue → faintTrace stroke; RING is warm colors.rogue, BODY is cold rogueExtinguished", () => {
    const style = orreryRingStyle("rogue", colors);
    expect(style.strokeStyle).toBe("faintTrace");
    expect(style.color).toBe(colors.rogue);
    expect(style.bodyFill).toBe(colors.rogueExtinguished);
    expect(style.bodyFill).not.toBe(style.color);
  });

  it("null status → the canonical NEUTRAL fallback (colour = colors.border), never throws (C2-2 reuse point)", () => {
    const style = orreryRingStyle(null, colors);
    expect(style.color).toBe(colors.border);
    expect(style.color).toBe(ringVisual(null, colors).color);
  });

  it("mirrors ringVisual opacity+width for every real status (colour channel never re-mapped)", () => {
    for (const status of ["stable", "wobble", "decay", "rogue"] as const) {
      const rv = ringVisual(status, colors);
      const style = orreryRingStyle(status, colors);
      expect(style.color).toBe(rv.color);
      expect(style.opacity).toBe(rv.opacity);
      expect(style.width).toBe(rv.width);
    }
  });
});
