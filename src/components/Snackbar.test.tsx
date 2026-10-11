import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Snackbar actionless rendering", () => {
  it("uses project typography and renders no empty action target", () => {
    const source = readFileSync(
      new URL("./Snackbar.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("<AppText");
    expect(source).toContain("snackbar.action ?");
  });
});

describe("Snackbar error look (D-72; review WR-06)", () => {
  const source = readFileSync(
    new URL("./Snackbar.tsx", import.meta.url),
    "utf8",
  );

  it("draws and announces from snackbarPresentation(kind)", () => {
    expect(source).toContain("snackbarPresentation(snackbar.kind)");
    expect(source).toContain("accessibilityLiveRegion={look.liveRegion}");
    expect(source).toContain("accessibilityRole={look.accessibilityRole}");
    expect(source).toContain("borderColor: colors[look.borderTone]");
    expect(source).not.toContain('accessibilityLiveRegion="polite"');
  });

  it("renders the warning glyph in the danger token, hidden from TalkBack", () => {
    expect(source).toMatch(
      /look\.warningGlyph \? \([\s\S]*?importantForAccessibility="no-hide-descendants"[\s\S]*?<Icon name="warning" tone="danger"/,
    );
  });
});
