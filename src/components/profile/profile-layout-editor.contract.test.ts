import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const editorSource = () =>
  readFileSync(new URL("./ProfileLayoutEditor.tsx", import.meta.url), "utf8");

describe("ProfileLayoutEditor direct reorder contract", () => {
  it("uses the installed nested reorder control to commit release positions through the closed reducer", () => {
    const source = editorSource();

    expect(source).toContain("NestedReorderableList");
    expect(source).toContain("ScrollViewContainer");
    expect(source).toContain("useReorderableDrag");
    expect(source).toContain("onReorder={({ from, to }) =>");
    expect(source).toContain(
      'type: "reorder", parent, id: items[from].id, toIndex: to',
    );
    expect(source).toContain("onLongPress={drag}");
    expect(source).not.toContain("PanResponder");
  });

  it("retains the labelled non-precision fallback controls", () => {
    const source = editorSource();

    expect(source).toContain('label="Move up"');
    expect(source).toContain('label="Move down"');
    expect(source).toContain(
      "accessibilityLabel={`Move ${definition.label} up`}",
    );
    expect(source).toContain(
      "accessibilityLabel={`Move ${definition.label} down`}",
    );
  });
});

/**
 * 38.4 D-47 (owner, OA-B2): the live preview is hidden, not deleted. A
 * top-of-file flag gates its only mount; the component stays exported so its
 * AUD-UIA-021 geometry tests keep running.
 */
describe("ProfileLayoutEditor live preview flag (D-47)", () => {
  it("declares the preview flag false at module top", () => {
    const source = editorSource();
    const flag = source.indexOf("const PROFILE_LAYOUT_PREVIEW_VISIBLE = false");
    expect(flag).toBeGreaterThan(-1);
    const firstFunction = source.search(/\n(export )?function /);
    expect(flag).toBeLessThan(firstFunction);
  });

  it("mounts ProfileLayoutPreview only behind the flag", () => {
    const source = editorSource();
    const mounts = [...source.matchAll(/<ProfileLayoutPreview\b/g)];
    expect(mounts).toHaveLength(1);
    const before = source.slice(0, mounts[0].index);
    expect(before).toMatch(/\{PROFILE_LAYOUT_PREVIEW_VISIBLE \?\s*\(?\s*$/);
  });

  it("keeps ProfileLayoutPreview exported", () => {
    expect(editorSource()).toContain("export function ProfileLayoutPreview");
  });
});
