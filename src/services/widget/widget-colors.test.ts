/**
 * widget-colors — node-side proof of the headless status→ring resolver (WDG-01).
 *
 * The widget bitmap renders in a headless task with NO ThemeProvider, so colours
 * must resolve from `theme-presets` directly (never `useTheme`). These are PURE
 * table lookups — no native import, no mock needed.
 *
 * Coverage: the full colour + weight table for stable/wobble/decay/rogue/null
 * against a palette fixture, plus that `widgetPalette()` resolves the space-dark
 * dark palette (the tokens 12-01 introduced).
 */
import { describe, expect, it } from "vitest";
import type { ThemePalette } from "@/theme/theme-types";
import { ringColor, ringWeight, widgetPalette } from "./widget-colors";

// A palette fixture with sentinel values, so each mapping asserts EXACT routing
// (not a coincidental colour match). Only the fields the resolver reads matter.
const fixture = {
  statusStable: "STABLE",
  statusWobble: "WOBBLE",
  statusDecay: "DECAY",
  rogue: "ROGUE",
  border: "BORDER",
} as unknown as ThemePalette;

describe("ringColor", () => {
  it("routes each status to its token", () => {
    expect(ringColor("stable", fixture)).toBe("STABLE");
    expect(ringColor("wobble", fixture)).toBe("WOBBLE");
    expect(ringColor("decay", fixture)).toBe("DECAY");
    expect(ringColor("rogue", fixture)).toBe("ROGUE");
    expect(ringColor(null, fixture)).toBe("BORDER");
  });
});

describe("ringWeight", () => {
  it("escalates weight with overdue-ness (UI-SPEC)", () => {
    expect(ringWeight("stable")).toBe(2);
    expect(ringWeight("wobble")).toBe(3);
    expect(ringWeight("decay")).toBe(4);
    expect(ringWeight("rogue")).toBe(3);
    expect(ringWeight(null)).toBe(2);
  });
});

describe("widgetPalette", () => {
  it("resolves the space-dark dark palette (status tokens present, no theme hook)", () => {
    const p = widgetPalette();
    // The four shared status tokens (12-01) the headless render consumes.
    expect(typeof p.statusStable).toBe("string");
    expect(typeof p.statusWobble).toBe("string");
    expect(typeof p.statusDecay).toBe("string");
    expect(typeof p.rogue).toBe("string");
    // ringColor reads them straight off the resolved palette.
    expect(ringColor("stable", p)).toBe(p.statusStable);
    expect(ringColor("decay", p)).toBe(p.statusDecay);
  });
});
