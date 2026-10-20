/**
 * Profile layout P-D source contract (38.14 D-51..D-56, D-83; ADR-115 :18).
 *
 * HistorySection has no render harness, so its card structure is pinned here
 * by source scan, alongside the Profile's heading-size rule (D-56: sizes come
 * from PROFILE_HEADING_SCALE, never a literal) and the Contact Methods card
 * (D-54).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

/** The source of one `if (<condition>) { … }` branch, braces included. */
function branch(source: string, condition: string): string {
  const start = source.indexOf(`if (${condition}) {`);
  expect(start, condition).toBeGreaterThan(-1);
  const indent = start - source.lastIndexOf("\n", start) - 1;
  const end = source.indexOf(`\n${" ".repeat(indent)}}\n`, start);
  expect(end, condition).toBeGreaterThan(start);
  return source.slice(start, end);
}

const count = (source: string, token: string) => source.split(token).length - 1;

describe("Profile heading sizes come from the scale (38.14 D-56)", () => {
  it.each([
    "./ProfileModuleHost.tsx",
    "./ProfileHeading.tsx",
    "./ThingsToRemember.tsx",
  ])("%s has no numeric fontSize literal", (path) => {
    expect(read(path)).not.toMatch(/fontSize:\s*\d/);
  });

  it("ProfileHeading styles from PROFILE_HEADING_SCALE and theme tokens only", () => {
    const source = read("./ProfileHeading.tsx");
    expect(source).toContain("PROFILE_HEADING_SCALE[level]");
    expect(source).toContain("fontSize: t.size");
    expect(source).toContain("color: colors[t.colorToken]");
    expect(source).not.toContain("allowFontScaling");
    // D-83: the H1 heading itself never draws a scrim.
    expect(source).not.toContain("ChromeScrim");
  });

  it("Things to Remember group labels render as H3 (D-52)", () => {
    const source = read("./ThingsToRemember.tsx");
    expect(source).toContain(
      '<ProfileHeading level="h3">MOST RECENT</ProfileHeading>',
    );
    expect(source).toContain(
      '<ProfileHeading level="h3">PREVIOUS</ProfileHeading>',
    );
    expect(source).toContain(
      '<ProfileHeading level="h3">{group.heading}</ProfileHeading>',
    );
    expect(source).not.toMatch(/role="label">(MOST RECENT|PREVIOUS)</);
  });
});

describe("Contact Methods sits on one card (38.14 D-54)", () => {
  it("renderContactMethods returns its content inside one GlassSurface", () => {
    const source = read("./ProfileModuleHost.tsx");
    const start = source.indexOf("const renderContactMethods = () => {");
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(
      start,
      source.indexOf("const renderHistory = () => {", start),
    );
    expect(count(body, "<GlassSurface")).toBe(1);
    expect(count(body, "return (")).toBe(1);
    const card = body.slice(
      body.indexOf("<GlassSurface"),
      body.indexOf("</GlassSurface>"),
    );
    expect(card).toContain("Contact Methods · None");
    expect(card).toContain("methods.map(");
  });

  it("the Profile History snapshot error sits on a History card", () => {
    const source = read("./ProfileModuleHost.tsx");
    const error = branch(source, 'snapshot.history.status === "error"');
    const card = error.slice(
      error.indexOf("<GlassSurface"),
      error.indexOf("</GlassSurface>"),
    );
    expect(card).toContain('testID="profile-history-error"');
    expect(card).toContain("onLayout={scroller.historyContentLayout}");
  });
});

describe("HistorySection cards (38.14 D-53; ADR-115 :18, ADR-174)", () => {
  const source = read("../history/HistorySection.tsx");

  /** The populated render: its final return, up to the modal sheets. */
  function populated(): string {
    const start = source.indexOf(
      "return (\n    <View testID={testID} style={styles.stack}>",
    );
    expect(start).toBeGreaterThan(-1);
    return source.slice(start, source.indexOf("{detailInteraction ? (", start));
  }

  it("the populated render has exactly two GlassSurface cards", () => {
    expect(count(populated(), "<GlassSurface")).toBe(2);
  });

  it("card 1 holds the refresh notice, heatmap and Intensity; card 2 Jump to date and the stream", () => {
    const render = populated();
    const firstOpen = render.indexOf("<GlassSurface");
    const firstClose = render.indexOf("</GlassSurface>");
    const secondOpen = render.indexOf("<GlassSurface", firstClose);
    const card1 = render.slice(firstOpen, firstClose);
    const card2 = render.slice(secondOpen);
    // The refresh notice sits INSIDE card 1, not before it (R3-01).
    expect(render.slice(0, firstOpen)).not.toContain("{refreshNotice}");
    expect(card1.indexOf("{refreshNotice}")).toBeGreaterThan(-1);
    expect(card1.indexOf("{refreshNotice}")).toBeLessThan(
      card1.indexOf("<ActivityHeatmap"),
    );
    expect(card1).toContain("<IntensityChart");
    expect(card2).toContain('label="Jump to date"');
    expect(card2).toContain("<HistoryStream");
    expect(card1).not.toContain("<HistoryStream");
  });

  it("each History card is padded SPACING.base on the GlassSurface 1 dp border (window − 66, ADR-174)", () => {
    expect(source).toMatch(/\n {2}card: \{ padding: SPACING\.base \},/);
    const glass = read("../ui/GlassSurface.tsx");
    expect(glass).toMatch(/container: \{[^}]*\bborderWidth: 1,/);
    for (const open of source.match(/<GlassSurface[^>]*>/g) ?? []) {
      expect(open).toContain("style={styles.card}");
    }
  });

  it("the empty state sits on one History card with its props unchanged", () => {
    const empty = branch(source, "isEmptyHistory(history)");
    expect(count(empty, "<GlassSurface")).toBe(1);
    const card = empty.slice(
      empty.indexOf("<GlassSurface"),
      empty.indexOf("</GlassSurface>"),
    );
    expect(card).toContain("<EmptyState");
    expect(card).toContain("{refreshNotice}");
  });

  it("the read error and loading states each return inside a History card", () => {
    const error = branch(source, 'readState.phase === "error"');
    expect(error).toMatch(/return \(\s*<GlassSurface/);
    // biome-ignore lint/suspicious/noTemplateCurlyInString: asserts literal source text.
    expect(error).toContain("testID={`${testID}-error`}");
    expect(error).toContain("onLayout={onContentLayout}");
    const loading = branch(source, "!history");
    expect(loading).toMatch(/return \(\s*<GlassSurface/);
    // biome-ignore lint/suspicious/noTemplateCurlyInString: asserts literal source text.
    expect(loading).toContain("testID={`${testID}-loading`}");
  });
});
