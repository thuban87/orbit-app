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

describe("Profile Contact Frequency selector (AUD-UIA-005, D-66)", () => {
  const sheets = source("src/components/profile/ProfileRelationshipSheets.tsx");
  const start = sheets.indexOf("FREQUENCY_CHOICES.map(");
  const end = sheets.indexOf("</Pressable>", start);
  const option = sheets.slice(start, end);

  it("finds the frequency option row", () => {
    expect(start).toBeGreaterThan(-1);
    expect(option).toContain("<Pressable");
  });

  it("marks the current choice with state and the filled select glyph, as the dropdowns do", () => {
    expect(option).toMatch(
      /accessibilityState=\{\{\s*selected: frequency\.draft === choice\.days,/,
    );
    expect(option).toMatch(
      /\{frequency\.draft === choice\.days \? \(\s*<Icon name="select" state="active" tone="accentText" \/>\s*\) : null\}/,
    );
    expect(sheets).toContain('import { Icon } from "@/components/icons/Icon";');
  });

  it("lays the label and the glyph out on one row", () => {
    expect(option).toContain("styles.frequencyChoice");
    expect(sheets).toMatch(
      /frequencyChoice: \{\s*flexDirection: "row",\s*alignItems: "center",\s*justifyContent: "space-between",/,
    );
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

describe("Touchpoint refine form (AUD-UIA-005, AUD-UIA-006, AUD-UIA-018, D-07)", () => {
  const form = source("src/components/TouchpointRefineForm.tsx");
  const pressables = elementRegions(form, "Pressable");
  const dateTime = pressables.find((region) => region.includes("-datetime`"));

  it("exposes the date/time value and shows it through the shared minute formatter", () => {
    expect(dateTime).toBeDefined();
    expect(dateTime).toContain('accessibilityLabel="Correct date and time"');
    expect(dateTime).toContain(
      "accessibilityValue={{ text: occurredAtLabel }}",
    );
    expect(form).toContain(
      "const occurredAtLabel = formatDateTimeMinuteOrFallback(value.occurredAt);",
    );
    expect(form).toContain("{occurredAtLabel}");
    expect(form).not.toContain("{value.occurredAt}");
  });

  it("keeps full stored precision for the native picker seed", () => {
    expect(form).toContain("parseLocalDateTime(value.occurredAt)");
  });

  it("raises the duration chips to the 44dp floor without hitSlop", () => {
    expect(form).toMatch(/chip: \{[^}]*minHeight: MIN_TOUCH_TARGET/);
    expect(form).not.toContain("minHeight: 40");
    const chips = pressables.filter((region) => region.includes("styles.chip"));
    expect(chips.length).toBeGreaterThanOrEqual(2);
    for (const chip of chips) {
      expect(chip).not.toContain("hitSlop");
    }
    expect(form).toMatch(/chipRow: \{[^}]*gap: 8/);
  });
});
