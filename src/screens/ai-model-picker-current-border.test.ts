import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_PRESETS } from "@/theme/theme-presets";
import {
  SELECTED_SURFACE_BORDER_WIDTH,
  surfaceBorder,
} from "@/theme/tokens/surface";

/**
 * 38.4 D-73 (d) (owner): the model picker's saved model card gets a bright
 * green border — the success/stable status token, never a hard-coded colour —
 * in addition to its "Current model" text and selected state. Choosing another
 * model moves the saved id, so the border moves with it (`card.isCurrent`).
 */
describe("selected glass surface border (D-73d)", () => {
  const palette = THEME_PRESETS.galaxy.dark;

  it("uses the success/stable status token and a heavier width when selected", () => {
    expect(surfaceBorder(palette, "border", true)).toEqual({
      borderColor: palette.statusStable,
      borderWidth: SELECTED_SURFACE_BORDER_WIDTH,
    });
    expect(SELECTED_SURFACE_BORDER_WIDTH).toBeGreaterThan(1);
  });

  it("keeps the package's own border token otherwise", () => {
    expect(surfaceBorder(palette, "border", false)).toEqual({
      borderColor: palette.border,
      borderWidth: 1,
    });
  });
});

describe("AIModelPickerScreen marks the saved model's card (D-73d)", () => {
  const screen = readFileSync(
    join(__dirname, "AIModelPickerScreen.tsx"),
    "utf8",
  );

  it("each catalog card's surface is selected exactly when it is the saved model", () => {
    const start = screen.indexOf("visibleCards.map((card) => (");
    const card = screen.slice(start, screen.indexOf(">", start + 40) + 1);
    expect(card).toMatch(/<GlassSurface[\s\S]*selected=\{card\.isCurrent\}/);
  });

  it("the standalone Current model row (manual or hidden saved id) is selected too", () => {
    const at = screen.indexOf('testID="ai-model-picker-current"');
    const surface = screen.slice(screen.lastIndexOf("<GlassSurface", at), at);
    expect(surface).toContain("selected");
  });

  it("keeps the Current model text and the selected state on Choose", () => {
    expect(screen).toContain('<AppText role="caption">Current model</AppText>');
    expect(screen).toContain("selected={card.isCurrent}");
    expect(screen).toMatch(/accessibilityHint=\{\s*card\.isCurrent/);
  });
});

describe("GlassSurface applies the selected border (D-73d)", () => {
  const source = readFileSync(
    join(__dirname, "..", "components", "ui", "GlassSurface.tsx"),
    "utf8",
  );

  it("takes an optional selected prop and resolves its border through surfaceBorder", () => {
    expect(source).toMatch(/selected\?: boolean;/);
    expect(source).toMatch(/selected = false,/);
    expect(source).toMatch(
      /surfaceBorder\(\s*colors,\s*s\.borderTokenKey,\s*selected,?\s*\)/,
    );
  });
});
