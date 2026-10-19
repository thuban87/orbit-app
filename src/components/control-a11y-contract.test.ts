import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isFutureLocalDate,
  lastSpokeMaxDate,
  lastSpokeSegmentTone,
} from "@/components/tri-state-last-spoke-logic";
import { formatLocalDate } from "@/utils/dates";

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
  // 38.9 D-47: both are the Orbit switch, which draws its own themed track and
  // thumb, so the old trackColor/thumbColor assertions retired with RN Switch.
  const switches = elementRegions(editor, "OrbitSwitch");

  it("has both switches", () => {
    expect(switches.length).toBe(2);
  });

  it("names every switch", () => {
    for (const region of switches) {
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

/**
 * The option-row Pressable after `anchor` (first `<Pressable` after it). The
 * default anchor is a FlatList `renderItem`; OptionSheet hoists its row into
 * one `renderOption` callback both of its lists use (38.13 D-71).
 */
function optionRegion(src: string, anchor = "renderItem="): string {
  const start = src.indexOf(anchor);
  expect(start).toBeGreaterThan(-1);
  const pressable = src.indexOf("<Pressable", start);
  const end = src.indexOf("</Pressable>", pressable);
  return src.slice(pressable, end);
}

describe("Custom-field dropdown (AUD-UIA-005, out-of-list preserved)", () => {
  // 38.9 D-28: the dropdown opens the shared OptionSheet from an
  // OptionSelectRow trigger, so the trigger and option-row assertions read
  // those sources; every RG-030 assertion is kept.
  const dropdown = source(
    "src/components/field-widgets/DropdownFieldWidget.tsx",
  );
  const trigger = source("src/components/ui/OptionSelectRow.tsx");
  const sheet = source("src/components/ui/OptionSheet.tsx");

  it("builds its list through the shared out-of-list-preserving helper", () => {
    expect(dropdown).toContain("selectorItems(selected, options)");
    expect(dropdown).toContain("<OptionSheet");
    expect(dropdown).toContain("options={sheetOptions}");
    expect(dropdown).toContain("selected={selected}");
  });

  it("exposes the field name and current value on the trigger", () => {
    const row = elementRegions(dropdown, "OptionSelectRow")[0] ?? "";
    expect(row).toContain("label={label}");
    expect(row).toContain("currentLabel={selected}");
    const pressable = elementRegions(trigger, "Pressable")[0] ?? "";
    expect(pressable).toContain("accessibilityLabel={label}");
    expect(pressable).toContain(
      "accessibilityValue={selectorAccessibilityValue(currentLabel)}",
    );
  });

  it("renders every option list through the one shared row", () => {
    // 38.13 D-71: the default (expanded) and the sized block each have a
    // FlatList; both render the same row, so the assertions below cover both.
    expect(sheet.match(/<FlatList\b/g)).toHaveLength(2);
    expect(sheet.match(/renderItem=\{renderOption\}/g)).toHaveLength(2);
  });

  it("marks the selected option with state, a non-colour glyph and the D-05 top tier", () => {
    const option = optionRegion(sheet, "const renderOption");
    expect(option).toContain("accessibilityState={{ selected: isSelected }}");
    expect(option).toMatch(/<Icon name="select" state="active"/);
    // D-05 top tier: accent fill with an onAccent label and glyph.
    expect(option).toMatch(
      /isSelected\s*\?\s*colors\.accent\s*:\s*colors\.surface/,
    );
    expect(option).toMatch(
      /isSelected \? colors\.onAccent : colors\.textPrimary/,
    );
    expect(option).toContain(
      '<Icon name="select" state="active" tone="onAccent" />',
    );
    expect(option).not.toContain("colors.accentText");
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

// 38.10 plan 13: the retired Off Limits kind picker's assertion moves to the
// memory type picker, which carries the same AUD-UIA-005 treatment.
describe("Memory type picker (AUD-UIA-005)", () => {
  const editor = source("src/components/MemoryEditor.tsx");

  it("exposes the current type as the trigger value", () => {
    expect(editor).toContain('accessibilityLabel="Memory type"');
    expect(editor).toContain("accessibilityValue={{ text: selected }}");
  });

  it("marks the selected type with state and a non-colour glyph", () => {
    const option = optionRegion(editor);
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
    // 38.9 D-48: the value is the formatted date the segment displays.
    expect(tri).toMatch(
      /const dateText =\s*value\.kind === "date"\s*\?\s*formatDisplayDateOrFallback\(value\.date, value\.date\)\s*:\s*null;/,
    );
    expect(tri).toMatch(
      /const dateValue = dateText !== null \? \{ text: dateText \} : undefined;/,
    );
  });

  it("keeps selected-state semantics and the 44dp floor without horizontally overlapping hitSlop", () => {
    for (const region of segments) {
      expect(region).toContain("accessibilityState={{ selected:");
      expect(region).not.toMatch(/hitSlop=\{\d+\}/);
    }
    expect(tri).toMatch(/segment: \{[^}]*minHeight: MIN_TOUCH_TARGET/);
  });

  // 38.11 D-04, D-44, D-25: "Not yet" is muted only while unselected; once
  // chosen it reads selected like Today and Pick date (Add and Edit share it).
  it("mutes Not yet only while it is not selected", () => {
    expect(lastSpokeSegmentTone("not-yet", false)).toEqual({
      background: "surface",
      border: "borderStrong",
      text: "textSecondary",
    });
  });

  it("gives a selected Not yet the same selected colours as Today and Pick date", () => {
    const selected = {
      background: "accent",
      border: "accent",
      text: "onAccent",
    };
    expect(lastSpokeSegmentTone("not-yet", true)).toEqual(selected);
    expect(lastSpokeSegmentTone("today", true)).toEqual(selected);
    expect(lastSpokeSegmentTone("date", true)).toEqual(selected);
  });

  it("keeps unselected Today and Pick date on the plain surface", () => {
    const plain = {
      background: "surface",
      border: "border",
      text: "textPrimary",
    };
    expect(lastSpokeSegmentTone("today", false)).toEqual(plain);
    expect(lastSpokeSegmentTone("date", false)).toEqual(plain);
  });

  it("draws every segment through the shared tone helper", () => {
    expect(tri).toMatch(/lastSpokeSegmentTone\(kind, selected\)/);
    expect(tri).not.toMatch(/colors\.borderStrong/);
  });

  // 38.11 D-31: the Pick date picker cannot reach a future day.
  it("caps the Pick date picker at today", () => {
    const picker = elementRegions(tri, "DateTimePicker")[0];
    expect(picker).toContain("maximumDate={lastSpokeMaxDate()}");
  });

  it("lastSpokeMaxDate is the end of today's local day, never tomorrow", () => {
    const now = new Date(2026, 9, 16, 21, 30, 0);
    const max = lastSpokeMaxDate(now);
    expect(formatLocalDate(max)).toBe("2026-10-16");
    expect(isFutureLocalDate(max, now)).toBe(false);
    // The whole of today stays pickable.
    expect(max.getTime()).toBeGreaterThanOrEqual(now.getTime());
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
