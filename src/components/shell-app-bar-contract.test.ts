/**
 * ShellAppBar source contract (38.9 Plan 08; D-44, D-16, D-45, cycle-5 C5-M6).
 *
 * Source-scan idiom: the header imports react-native, which the vitest node
 * environment cannot load. The look and TalkBack reading are checked on device
 * in Plan 17 only.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync("src/components/ShellAppBar.tsx", "utf8");
/** Comments removed, so a doc mention is never counted as code. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

/** The JSX text from the first `<tag` opener after `from` to its matching close. */
function elementAt(code: string, start: number): string {
  const open = code.indexOf("<", start);
  const tag = code.slice(open + 1).match(/^[A-Za-z.]+/)?.[0] ?? "";
  let depth = 0;
  const re = new RegExp(`<${tag}\\b|</${tag}>|/>`, "g");
  re.lastIndex = open;
  // Walk openers and closers of the same tag; self-closing openers count as a
  // matched pair.
  for (let m = re.exec(code); m; m = re.exec(code)) {
    if (m[0] === `</${tag}>`) {
      depth -= 1;
      if (depth === 0) return code.slice(open, m.index + m[0].length);
    } else if (m[0] === "/>") {
      // A self-closing tag closes the innermost opener only when that opener
      // has no `>` before this `/>`.
      const lastOpen = code.lastIndexOf(`<${tag}`, m.index);
      const between = code.slice(lastOpen, m.index);
      if (!between.includes(">")) {
        depth -= 1;
        if (depth === 0) return code.slice(open, m.index + 2);
      }
    } else {
      depth += 1;
    }
  }
  throw new Error(`unclosed <${tag}> at ${open}`);
}

/** The Back/Cancel Pressable (the one carrying the exit accessibility label). */
const BACK_PRESSABLE = (() => {
  const label = CODE.indexOf('accessibilityLabel={cancel ? "Cancel" : "Back"}');
  if (label < 0) return "";
  return elementAt(CODE, CODE.lastIndexOf("<Pressable", label));
})();

describe("ShellAppBar child Back (D-44)", () => {
  it("is an icon-only chevron: the registry back glyph, labelled Back, no visible word", () => {
    expect(BACK_PRESSABLE).not.toBe("");
    expect(CODE).toMatch(/<Icon name="back"/);
    expect(CODE).toContain('"Back"');
    expect(CODE).not.toMatch(/>\s*Back\s*</);
    expect(BACK_PRESSABLE).toContain('accessibilityRole="button"');
    expect(BACK_PRESSABLE).toContain("{backGlyph}");
  });

  it("keeps the 44dp target and the hit slop", () => {
    expect(BACK_PRESSABLE).toContain("hitSlop={8}");
    expect(BACK_PRESSABLE).toContain("style={styles.back}");
    expect(CODE).toMatch(/const BACK_TARGET = 44;/);
    expect(CODE).toMatch(
      /back: \{\s*minWidth: BACK_TARGET,\s*minHeight: BACK_TARGET,/,
    );
  });

  it("renders the close glyph labelled Cancel when backKind is cancel (D-16, D-59)", () => {
    expect(CODE).toMatch(/backKind\?: "back" \| "cancel";/);
    expect(CODE).toMatch(/backKind = "back"/);
    expect(CODE).toMatch(/const cancel = backKind === "cancel";/);
    expect(CODE).toMatch(
      /const backGlyph = cancel \? \(\s*<Icon name="close"[^>]*\/>\s*\) : \(\s*<Icon name="back"[^>]*\/>\s*\);/,
    );
  });

  it("wraps the glyph in GlassForegroundScope under the scoped branch, like the title", () => {
    expect(BACK_PRESSABLE).toMatch(
      /\{scrim\.scoped \? \(\s*<GlassForegroundScope>\{backGlyph\}<\/GlassForegroundScope>\s*\) : \(\s*backGlyph\s*\)\}/,
    );
  });
});

describe("ShellAppBar onBack override (D-16, T-38.9-22)", () => {
  it("runs after the open-transient check and replaces only goBack", () => {
    const handler = CODE.slice(
      CODE.indexOf("const onBack = () => {"),
      CODE.indexOf("const cancel = backKind"),
    );
    const dismiss = handler.indexOf("dismissTop()");
    const override = handler.indexOf("onBackOverride();");
    const goBack = handler.indexOf("navigation.goBack();");
    expect(dismiss).toBeGreaterThan(0);
    expect(override).toBeGreaterThan(dismiss);
    expect(goBack).toBeGreaterThan(override);
    expect(handler).toMatch(
      /if \(onBackOverride\) \{\s*onBackOverride\(\);\s*return;\s*\}/,
    );
    expect(BACK_PRESSABLE).toContain("onPress={onBack}");
  });
});

describe("ShellAppBar person line (D-45, C5-M6)", () => {
  const headerStart = CODE.indexOf("<View style={[styles.header");
  const header = headerStart >= 0 ? elementAt(CODE, headerStart) : "";
  // The title row is the View that carries the width measurement.
  const rowStart = header.lastIndexOf("<View", header.indexOf("onLayout="));
  const row = rowStart >= 0 ? elementAt(header, rowStart) : "";

  it("the header is an outer column holding the title row", () => {
    expect(header).not.toBe("");
    expect(row).toContain("onLayout=");
    expect(row).toContain("style={styles.root}");
    expect(row).toContain('accessibilityRole="header"');
  });

  it("the person prop renders PersonLine under the title row, inside the header column", () => {
    expect(CODE).toMatch(/person\?: ShellAppBarPerson \| null;/);
    expect(CODE).toContain('import { PersonLine } from "./PersonLine";');
    const person = header.indexOf("{person ? (");
    expect(person).toBeGreaterThan(header.indexOf(row) + row.length - 1);
    expect(header.slice(person)).toContain("<PersonLine");
    expect(row).not.toContain("PersonLine");
  });

  it("the chrome scrim is a child of the header column (not the row), so it backs the person line too", () => {
    const scrim = header.indexOf("{scrim.opacity !== null ? (");
    expect(scrim).toBeGreaterThan(0);
    expect(scrim).toBeLessThan(header.indexOf(row));
    expect(row).not.toContain("scrim.opacity");
    expect(header.slice(scrim, header.indexOf(row))).toContain(
      "StyleSheet.absoluteFill",
    );
  });

  it("the bottom hairline moves with the scrim to the header column", () => {
    expect(CODE).toMatch(
      /header: \{\s*borderBottomWidth: StyleSheet\.hairlineWidth,\s*\}/,
    );
    const rootStyle = CODE.slice(CODE.indexOf("  root: {"));
    expect(rootStyle.slice(0, rootStyle.indexOf("},"))).not.toContain(
      "borderBottomWidth",
    );
  });

  it("PersonLine is wrapped in GlassForegroundScope under the scoped branch", () => {
    const person = header.slice(header.indexOf("{person ? ("));
    expect(person).toMatch(
      /\{scrim\.scoped \? \(\s*<GlassForegroundScope>\s*<PersonLine[\s\S]*?\/>\s*<\/GlassForegroundScope>\s*\) : \(\s*<PersonLine/,
    );
  });

  it("keeps exactly one useArtTreatment(artComponent) call", () => {
    expect(CODE.match(/useArtTreatment\(/g)).toHaveLength(1);
  });
});
