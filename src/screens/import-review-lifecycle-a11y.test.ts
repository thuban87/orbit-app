import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 38.4 review Lane C WR-03 (a11y part): the single import review's
 * Bound/Unbound choice decides whether the contact gets reminders (D-57), so
 * TalkBack must hear which option is selected. Mirrors bulk setup's radio
 * group (Plan 21). Option order and colours are out of scope here.
 */
const screen = readFileSync(join(__dirname, "ImportReviewScreen.tsx"), "utf8");

function lifecycleBlock(): string {
  const start = screen.indexOf("Orbit participation\n");
  expect(start).toBeGreaterThan(-1);
  return screen.slice(start, screen.indexOf("</View>\n      </View>", start));
}

describe("ImportReviewScreen lifecycle radio semantics (Lane C WR-03)", () => {
  it("exposes the control as a labelled radio group", () => {
    const block = lifecycleBlock();
    expect(block).toContain('accessibilityRole="radiogroup"');
    expect(block).toContain('accessibilityLabel="Orbit participation"');
  });

  it("exposes each option as a radio with selected and checked state", () => {
    const block = lifecycleBlock();
    expect(block).toContain('accessibilityRole="radio"');
    expect(block).toMatch(
      /accessibilityState=\{\{\s*selected,\s*checked: selected\s*\}\}/,
    );
    expect(block).toContain("const selected = trackingEnabled === enabled;");
  });

  it("keeps the existing option order (Bound, then Unbound)", () => {
    expect(lifecycleBlock()).toContain("([true, false] as const).map(");
  });
});
