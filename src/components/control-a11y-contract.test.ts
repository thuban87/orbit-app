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
