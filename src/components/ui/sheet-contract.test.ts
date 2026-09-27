import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SHEET_BODY_FLEX,
  SHEET_BODY_SCROLLS,
  SHEET_HEIGHT_PERCENT,
  SHEET_VARIANTS,
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
    // The handle stays outside (above) the scroll body.
    expect(render.indexOf("styles.handleWrap")).toBeLessThan(
      render.indexOf("<ScrollView"),
    );
  });
});
