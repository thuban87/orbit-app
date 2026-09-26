import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Source contract for the shared editor-control accessibility treatment
 * (RG-030: ui-accessibility/AUD-UIA-003, AUD-UIA-005, AUD-UIA-006; RG-038
 * ui-accessibility/AUD-UIA-018 rider). Reads component sources from disk and
 * asserts the structural shape of each control; device legs (TalkBack, native
 * bounds) live in the phase UAT.
 */
function source(path: string): string {
  return readFileSync(path, "utf8");
}

/** Every JSX element region that opens with `<Tag` and ends at its first `/>` or `>`-close. */
function elementRegions(src: string, tag: string): string[] {
  const regions: string[] = [];
  const opener = new RegExp(`<${tag}[\\s>]`, "g");
  let match = opener.exec(src);
  while (match) {
    const start = match.index;
    const end = src.indexOf("/>", start);
    regions.push(src.slice(start, end === -1 ? undefined : end + 2));
    match = opener.exec(src);
  }
  return regions;
}

describe("RelationshipEditor switches (AUD-UIA-003, D-20)", () => {
  const editor = source("src/components/RelationshipEditor.tsx");
  const switches = elementRegions(editor, "Switch");

  it("has both switches", () => {
    expect(switches.length).toBe(2);
  });

  it("themes and names every switch", () => {
    for (const region of switches) {
      expect(region).toContain(
        "trackColor={{ false: colors.border, true: colors.accent }}",
      );
      expect(region).toContain("thumbColor={colors.surfaceElevated}");
      expect(region).toContain("accessibilityLabel=");
    }
  });

  it("keeps the visibility row's visible text constant and agreeing with ON = hidden", () => {
    expect(editor).not.toContain('"Show on Profile" : "Hide from Profile"');
    expect(editor).toMatch(/<AppText role="body">Hide from Profile<\/AppText>/);
    const visibility = switches.find((region) =>
      region.includes('accessibilityLabel="Hide from Profile"'),
    );
    expect(visibility).toBeDefined();
    expect(visibility).toContain("value={draft.hidden === 1}");
  });
});

/** The option-row Pressable inside a FlatList `renderItem` (first `<Pressable` after it). */
function optionRegion(src: string): string {
  const start = src.indexOf("renderItem=");
  expect(start).toBeGreaterThan(-1);
  const pressable = src.indexOf("<Pressable", start);
  const end = src.indexOf("</Pressable>", pressable);
  return src.slice(pressable, end);
}

describe("Custom-field dropdown (AUD-UIA-005, out-of-list preserved)", () => {
  const dropdown = source(
    "src/components/field-widgets/DropdownFieldWidget.tsx",
  );

  it("builds its list through the shared out-of-list-preserving helper", () => {
    expect(dropdown).toContain("selectorItems(selected, options)");
  });

  it("exposes the field name and current value on the trigger", () => {
    const trigger = elementRegions(dropdown, "Pressable")[0] ?? "";
    expect(trigger).toContain("accessibilityLabel={label}");
    expect(trigger).toContain(
      "accessibilityValue={selectorAccessibilityValue(selected)}",
    );
  });

  it("marks the selected option with state, a non-colour glyph and the link-text role", () => {
    const option = optionRegion(dropdown);
    expect(option).toContain("accessibilityState={{ selected: isSelected }}");
    expect(option).toMatch(/<Icon name="select" state="active"/);
    expect(option).toContain("colors.accentText");
    expect(option).not.toContain("colors.accent :");
  });
});

describe("Fuel kind picker (AUD-UIA-005)", () => {
  const fuel = source("src/components/FuelEditor.tsx");

  it("exposes the current kind as the trigger value", () => {
    expect(fuel).toContain("accessibilityValue={{ text: kindLabel(value) }}");
  });

  it("marks the selected kind with state and a non-colour glyph", () => {
    const option = optionRegion(fuel);
    expect(option).toContain("accessibilityState={{ selected: isSelected }}");
    expect(option).toMatch(/<Icon name="select" state="active"/);
  });
});

describe("Last-spoke tri-state date segment (AUD-UIA-005)", () => {
  const tri = source("src/components/TriStateLastSpoke.tsx");
  const segments = elementRegions(tri, "Pressable");
  const dateSegment = segments.find((region) => region.includes("-pick-date`"));

  it("announces the chosen date as the segment's value", () => {
    expect(dateSegment).toBeDefined();
    expect(dateSegment).toContain('accessibilityLabel="Pick date"');
    expect(dateSegment).toContain("accessibilityValue={dateValue}");
    expect(tri).toMatch(
      /const dateValue =\s*value\.kind === "date" \? \{ text: value\.date \} : undefined;/,
    );
  });

  it("keeps selected-state semantics and the 44dp floor without horizontally overlapping hitSlop", () => {
    for (const region of segments) {
      expect(region).toContain("accessibilityState={{ selected:");
      expect(region).not.toMatch(/hitSlop=\{\d+\}/);
    }
    expect(tri).toMatch(/segment: \{[^}]*minHeight: MIN_TOUCH_TARGET/);
  });

  it("keeps the intentionally muted Not-yet treatment", () => {
    expect(tri).toMatch(
      /kind === "not-yet"\) \{\s*return \{\s*background: colors\.surface,\s*border: colors\.borderStrong,\s*text: colors\.textSecondary,/,
    );
  });
});
