import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { actionRowFit } from "./confirm-dialog-layout";

/**
 * MeasuredActionRow (D-11, carried from ADR-174 :38; 38.14 review B-WR-02 and
 * A-IN-08). The repo has no hook renderer, so the fit rule is node-tested here
 * and the wiring is pinned from source.
 */
const read = (file: string) =>
  readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const row = read("src/components/ui/MeasuredActionRow.tsx");

describe("actionRowFit", () => {
  it("fits when every width plus the gaps is within the row", () => {
    expect(actionRowFit({ items: [140, 200], row: 348, gap: 8 })).toBe(true);
    expect(actionRowFit({ items: [140, 200], row: 347, gap: 8 })).toBe(true);
    expect(actionRowFit({ items: [140, 200], row: 346, gap: 8 })).toBe(false);
  });

  it("stacks a large-text pair that cannot share the row", () => {
    expect(actionRowFit({ items: [245, 581], row: 600, gap: 8 })).toBe(false);
  });

  it("one action always fits once measured", () => {
    expect(actionRowFit({ items: [900], row: 320, gap: 8 })).toBe(true);
  });

  it("is null until the row and every action are measured", () => {
    expect(actionRowFit({ items: [140, 0], row: 348, gap: 8 })).toBeNull();
    expect(actionRowFit({ items: [140, 200], row: 0, gap: 8 })).toBeNull();
    expect(actionRowFit({ items: [], row: 348, gap: 8 })).toBeNull();
  });
});

describe("MeasuredActionRow wiring", () => {
  it("wraps only while measuring, then keeps one row or stacks full width", () => {
    expect(row).toMatch(
      /measuring: \{\s*flexDirection: "row",\s*flexWrap: "wrap",/,
    );
    expect(row).toMatch(/row: \{\s*flexDirection: "row",\s*\}/);
    expect(row).toMatch(
      /stacked: \{\s*flexDirection: "column",\s*alignItems: "stretch",/,
    );
    expect(row).toContain("actionRowFit({");
  });

  it("re-measures by remounting when the actions, width or font scale change", () => {
    expect(row).toMatch(
      /key=\{`\$\{keys\}\|\$\{width\}\|\$\{fontScale\}\|\$\{measureKey\}`\}/,
    );
  });

  it("event detail's visible actions and Compose's pinned bar use it, not a plain wrapping row", () => {
    const detail = read("src/screens/GroupEventDetailScreen.tsx");
    expect(detail).toMatch(/<MeasuredActionRow align="start"/);
    expect(detail).not.toMatch(/flexWrap/);
    const compose = read("src/screens/ComposeScreen.tsx");
    const bar = compose.slice(compose.indexOf('testID="compose-action-bar"'));
    expect(bar.indexOf("<MeasuredActionRow")).toBeGreaterThan(-1);
    expect(bar.indexOf("<MeasuredActionRow")).toBeLessThan(
      bar.indexOf('testID="compose-copy"'),
    );
    const barStyle = compose.slice(
      compose.indexOf("  actionBar: {"),
      compose.indexOf("},", compose.indexOf("  actionBar: {")),
    );
    expect(barStyle).not.toMatch(/flexWrap/);
  });
});
