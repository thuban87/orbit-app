import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Source contract for the universal FAB (RG-039 ui-accessibility/AUD-UIA-023
 * and the D-20 glyph rider under RG-029). Reads the component source from disk
 * and asserts its structural shape; the native accessibility-tree evidence
 * lives in 38.4-INVESTIGATIONS.md.
 */
const fab = readFileSync("src/components/UniversalFab.tsx", "utf8");

/** The `<Animated.Text …>` opener that draws the "+" glyph. */
function glyphRegion(): string {
  const start = fab.indexOf("<Animated.Text");
  expect(start).toBeGreaterThan(-1);
  const end = fab.indexOf(">", fab.indexOf("style=", start));
  return fab.slice(start, end + 1);
}

describe("UniversalFab glyph foreground (D-20)", () => {
  it("draws the glyph in the accent's role foreground", () => {
    expect(glyphRegion()).toContain("color: colors.onAccent");
  });

  it("does not paint the glyph with the background token", () => {
    expect(glyphRegion()).not.toContain("colors.background");
  });
});
