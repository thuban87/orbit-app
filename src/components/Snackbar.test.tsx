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

describe("Snackbar look (D-72; review WR-06; 38.10 D-132)", () => {
  const source = readFileSync(
    new URL("./Snackbar.tsx", import.meta.url),
    "utf8",
  );

  it("draws and announces from snackbarPresentation(kind)", () => {
    expect(source).toContain("snackbarPresentation(snackbar.kind)");
    expect(source).toContain("accessibilityLiveRegion={look.liveRegion}");
    expect(source).toContain("accessibilityRole={look.accessibilityRole}");
    expect(source).toContain("backgroundColor: colors[look.fillTone]");
    expect(source).toContain("borderColor: colors[look.borderTone]");
    expect(source).toContain("color: colors[look.labelTone]");
    expect(source).toContain("const actionColor = colors[look.actionTone];");
    expect(source).not.toContain("colors.accentText");
    expect(source).not.toContain("colors.surface");
    expect(source).not.toContain('accessibilityLiveRegion="polite"');
  });

  it("renders the warning glyph in the look's glyph tone, hidden from TalkBack", () => {
    expect(source).toMatch(
      /look\.glyphTone \? \([\s\S]*?importantForAccessibility="no-hide-descendants"[\s\S]*?<Icon name="warning" tone=\{look\.glyphTone\}/,
    );
  });
});

describe("Snackbar root geometry (38.10 D-132, D-143; O2, O5)", () => {
  const source = readFileSync(
    new URL("./Snackbar.tsx", import.meta.url),
    "utf8",
  );

  it("sizes and places the root pill above the FABs that show (D-143), held per message (D-151)", () => {
    expect(source).toContain("latchSnackbarLayout(latchRef.current, snackbar,");
    expect(source).toContain("selectSectionFabAvailable");
    expect(source).toContain("isFocusedWorkflow(");
    expect(source).toContain("selectSectionFabPresent");
    expect(source).toContain('s.rects["shell-fab"] !== undefined');
    expect(source).toContain("useWindowDimensions()");
    expect(source).toContain("const layout = latch.layout;");
    expect(source).toContain("alignItems: layout.alignItems");
    expect(source).toContain("width: layout.width");
    expect(source).toContain("paddingBottom: layout.paddingBottom");
    expect(source).toContain("useShownTabBarHeight()");
    expect(source).toContain("insetBottom: insets.bottom");
  });

  it("pads the text off the pill's top and bottom walls (D-143)", () => {
    expect(source).toMatch(/surface: \{[\s\S]*?paddingVertical: SPACING\.xs/);
    expect(source).toMatch(/label: \{[\s\S]*?paddingVertical: SPACING\.md/);
  });

  it("keeps only the pill touchable and lets the label wrap", () => {
    // Review CR-01: touch-transparent while the + dial is open.
    expect(source).toContain(
      'pointerEvents={fabDialOpen ? "none" : "box-none"}',
    );
    expect(source).not.toContain("numberOfLines");
  });

  it("pads the pill from snackbarPadding (O5)", () => {
    expect(source).toContain("snackbarPadding(");
  });
});
