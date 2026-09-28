import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SHEET_BODY_FLEX,
  SHEET_BODY_SCROLLS,
  SHEET_HEIGHT_PERCENT,
  SHEET_VARIANTS,
  sheetKeyboardLayout,
} from "./sheet-contract";

describe("Sheet variant contract", () => {
  it("retains the compact/detail dimensions while adding only an explicit expanded variant", () => {
    expect(SHEET_VARIANTS).toEqual(["compact", "detail", "expanded"]);
    expect(SHEET_HEIGHT_PERCENT.compact).toBe("40%");
    expect(SHEET_HEIGHT_PERCENT.detail).toBe("60%");
    expect(SHEET_HEIGHT_PERCENT.expanded).toBe("92%");
  });

  it("allocates remaining body height only to expanded workflows", () => {
    expect(SHEET_BODY_FLEX.compact).toBe(0);
    expect(SHEET_BODY_FLEX.detail).toBe(0);
    expect(SHEET_BODY_FLEX.expanded).toBe(1);
  });

  it("scrolls the body of the percent-capped variants only (D-32)", () => {
    expect(SHEET_BODY_SCROLLS).toEqual({
      compact: true,
      detail: true,
      expanded: false,
    });
    expect(Object.isFrozen(SHEET_BODY_SCROLLS)).toBe(true);
  });
});

describe("Sheet body scrolls at large text (D-32)", () => {
  const source = readFileSync(new URL("./Sheet.tsx", import.meta.url), "utf8");
  const render = source.slice(
    source.indexOf("export function Sheet("),
    source.indexOf("const styles = StyleSheet.create("),
  );
  const styles = source.slice(
    source.indexOf("const styles = StyleSheet.create("),
  );

  /** The JSX opener `<Tag ... >` that starts at `from` (brace-depth aware). */
  function openerAt(text: string, from: number): string {
    let depth = 0;
    for (let i = from; i < text.length; i += 1) {
      const ch = text[i];
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
      else if (ch === ">" && depth === 0 && text[i - 1] !== "=")
        return text.slice(from, i + 1);
    }
    throw new Error("unterminated JSX opener");
  }

  function styleBlock(name: string): string {
    const start = styles.indexOf(`  ${name}: {`);
    expect(start, `styles.${name} exists`).toBeGreaterThan(-1);
    return styles.slice(start, styles.indexOf("},", start) + 2);
  }

  it("offers a scrollBody opt-out prop that defaults to true", () => {
    expect(source).toMatch(/scrollBody\?: boolean;/);
    expect(render).toMatch(/scrollBody = true,/);
    expect(render).toMatch(/SHEET_BODY_SCROLLS\[variant\] && scrollBody/);
  });

  it("renders the non-expanded default body as a bounded, keyboard-friendly ScrollView", () => {
    const start = render.indexOf("<ScrollView");
    expect(start).toBeGreaterThan(-1);
    const opener = openerAt(render, start);
    expect(opener).toContain("style={styles.scrollBody}");
    expect(opener).toContain("contentContainerStyle={styles.body}");
    expect(opener).toContain('keyboardShouldPersistTaps="handled"');
    expect(opener).toContain("showsVerticalScrollIndicator");
    const scroll = styleBlock("scrollBody");
    expect(scroll).toContain("flexGrow: 0");
    expect(scroll).toContain("flexShrink: 1");
    const body = styleBlock("body");
    expect(body).toContain("paddingHorizontal: SPACING.lg");
    expect(body).toContain("paddingBottom: SPACING.lg");
  });

  it("gives an opted-out non-expanded body a shrinkable View so the consumer's own scroll is bounded", () => {
    expect(render).toContain("styles.boundedBody");
    const bounded = styleBlock("boundedBody");
    expect(bounded).toContain("flexShrink: 1");
    expect(bounded).toContain("minHeight: 0");
  });

  it("keeps the expanded body a flex: 1 View with no sheet ScrollView", () => {
    expect(styleBlock("expandedBody")).toContain("flex: 1");
    expect(render).toMatch(/variant === "expanded"[\s\S]*styles\.expandedBody/);
    expect(render.split("<ScrollView").length - 1).toBe(1);
  });

  it("leaves heights, clipping, the handle, safe area, modality and dismissal unchanged", () => {
    expect(render).toContain(
      "{ height: SHEET_HEIGHT_PERCENT.expanded as DimensionValue }",
    );
    expect(render).toContain(
      "{ maxHeight: SHEET_HEIGHT_PERCENT[variant] as DimensionValue }",
    );
    expect(styleBlock("sheet")).toContain('overflow: "hidden"');
    expect(styleBlock("sheet")).toContain('flexDirection: "column"');
    expect(render).toContain('edges={["bottom"]}');
    expect(render).toContain("accessibilityViewIsModal");
    expect(render).toMatch(/\n\s+dismissable\n/);
    expect(render).toContain('scrimAccessibilityLabel="Dismiss"');
    // The handle stays outside (above) the body inside the sheet container.
    const container = render.slice(render.indexOf("<SafeAreaView"));
    expect(container.indexOf("styles.handleWrap")).toBeGreaterThan(-1);
    expect(container.indexOf("styles.handleWrap")).toBeLessThan(
      container.indexOf("{body}"),
    );
    expect(container).not.toContain("<ScrollView");
  });
});

describe("Sheet stays above the keyboard (38.4 D-72, Plan 17 G1-f)", () => {
  // The RN Modal window is edge-to-edge, so Android does not resize it for the
  // IME: at font_scale 2.0 the whole group-title sheet sat behind the keyboard.
  it("lifts by the keyboard height when the window was not resized", () => {
    expect(
      sheetKeyboardLayout({
        variant: "compact",
        frameHeight: 640,
        restingFrameHeight: 640,
        keyboardHeight: 300,
        topClearance: 40,
      }),
    ).toEqual({ lift: 300, size: 256 });
  });

  it("gives a percent-capped sheet at most the room left above the keyboard", () => {
    expect(
      sheetKeyboardLayout({
        variant: "detail",
        frameHeight: 640,
        restingFrameHeight: 640,
        keyboardHeight: 400,
        topClearance: 40,
      }),
    ).toEqual({ lift: 400, size: 200 });
    expect(
      sheetKeyboardLayout({
        variant: "expanded",
        frameHeight: 640,
        restingFrameHeight: 640,
        keyboardHeight: 300,
        topClearance: 40,
      }),
    ).toEqual({ lift: 300, size: 300 });
  });

  it("does not lift twice when the system already resized the window", () => {
    expect(
      sheetKeyboardLayout({
        variant: "compact",
        frameHeight: 340,
        restingFrameHeight: 640,
        keyboardHeight: 300,
        topClearance: 40,
      }),
    ).toEqual({ lift: 0, size: 256 });
  });

  it("changes nothing while the keyboard is down or before layout", () => {
    const down = { lift: 0, size: null };
    expect(
      sheetKeyboardLayout({
        variant: "compact",
        frameHeight: 640,
        restingFrameHeight: 640,
        keyboardHeight: 0,
        topClearance: 40,
      }),
    ).toEqual(down);
    expect(
      sheetKeyboardLayout({
        variant: "compact",
        frameHeight: 0,
        restingFrameHeight: 0,
        keyboardHeight: 300,
        topClearance: 40,
      }),
    ).toEqual(down);
  });

  it("wires the lift and the size into the shared Sheet", () => {
    const source = readFileSync(
      new URL("./Sheet.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain('Keyboard.addListener("keyboardDidShow"');
    expect(source).toContain('Keyboard.addListener("keyboardDidHide"');
    expect(source).toContain("sheetKeyboardLayout(");
    expect(source).toMatch(/pointerEvents="box-none"/);
    expect(source).toMatch(/paddingBottom: keyboardLayout\.lift/);
    expect(source).toMatch(/maxHeight: keyboardLayout\.size/);
    expect(source).toMatch(/height: keyboardLayout\.size/);
  });
});
