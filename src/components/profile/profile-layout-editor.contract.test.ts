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

/**
 * 38.11 D-60 / D-83: the per-section open/closed control reads as a setting
 * (a labelled switch), and an own-layout save clears only the open/closed
 * choices of sections whose default changed.
 */
describe("ProfileLayoutEditor open-by-default setting (D-60, D-83)", () => {
  it("renders a labelled Open by default switch, not an action button", () => {
    const source = editorSource();
    expect(source).toContain("Open by default");
    expect(source).toContain(
      "accessibilityLabel={`Open ${definition.label} by default`}",
    );
    expect(source).not.toContain("Expanded by default");
    expect(source).not.toContain("Collapsed by default");
  });

  it("passes the changed-default sections to the own-layout save", () => {
    expect(editorSource()).toContain(
      "clearCollapseFor: changedDefaultExpandedIds(initial, draft)",
    );
  });
});

/**
 * 38.11 D-29 (T-04): the nested-list warning is fixed on the nested lists, not
 * the Sheet. Expanded sheets never wrap their body in a ScrollView, so a
 * `scrollBody` prop would do nothing; each `NestedReorderableList` passes
 * `scrollEnabled={false}` so VirtualizedList's nesting check does not fire.
 */
describe("ProfileLayoutEditor nested lists do not scroll (D-29)", () => {
  it("passes scrollEnabled={false} to the bucket's NestedReorderableList", () => {
    const source = editorSource();
    const bucket = source.slice(
      source.indexOf("function ReorderableBucket("),
      source.indexOf("export function ProfileLayoutPreview"),
    );
    // The bucket renders exactly one list, so its props are the bucket's.
    expect(bucket.match(/<NestedReorderableList\b/g)).toHaveLength(1);
    const list = bucket.slice(bucket.indexOf("<NestedReorderableList"));
    expect(list).toContain("scrollable={false}");
    expect(list).toContain("scrollEnabled={false}");
    expect(source).not.toContain("scrollBody");
  });

  it("keeps the footer outside the scroll container so Save stays reachable", () => {
    const source = editorSource();
    const scrollEnd = source.indexOf("</ScrollViewContainer>");
    expect(scrollEnd).toBeGreaterThan(-1);
    expect(source.indexOf('label={saving ? "Saving…" : "Save layout"}')).toBe(
      source.indexOf('label={saving ? "Saving…" : "Save layout"}', scrollEnd),
    );
  });
});

/**
 * 38.11 D-65 (layout half): Profile Layout carries Save as template (the
 * editor footer's one existing button, T-16) and Reset to default, which asks
 * first with the themed destructive confirm (38.9 D-30) and resets only the
 * layout axis.
 */
describe("ProfileLayoutEditor Save as template and Reset (D-65)", () => {
  it("offers one Save as template control, in the editor footer", () => {
    const source = editorSource();
    expect(
      source.match(/Save as template|Save current layout as template/g),
    ).toHaveLength(1);
    expect(source).toContain(
      "onSaveAsTemplate(createLayoutTemplateIntent(draft))",
    );
  });

  it("shows Reset to default only for a layout override and confirms destructively before resetting", () => {
    const source = editorSource();
    expect(source).toContain('label="Reset to default"');
    expect(source).toMatch(/\{hasLayoutOverride \?\s*\(\s*<Button/);
    const handler = source.slice(
      source.indexOf("const resetLayout = async"),
      source.indexOf("return (", source.indexOf("const resetLayout = async")),
    );
    const confirmAt = handler.indexOf("await confirm({");
    expect(confirmAt).toBeGreaterThan(-1);
    expect(handler).toContain("destructive: true");
    expect(handler).toContain("if (!ok) return;");
    expect(handler.indexOf("resetContactLayoutPresentation(")).toBeGreaterThan(
      confirmAt,
    );
    expect(handler).toContain("onCommitted?.()");
    expect(handler).not.toContain("resetProfilePresentation");
  });

  it("is passed the layout-only override from the Profile screen", () => {
    const profile = readFileSync(
      new URL("../../screens/ContactProfileScreen.tsx", import.meta.url),
      "utf8",
    );
    expect(profile).toContain("hasLayoutOverride={hasContactLayoutOverride}");
    const flag = profile.slice(
      profile.indexOf("const hasContactLayoutOverride"),
      profile.indexOf(");", profile.indexOf("const hasContactLayoutOverride")),
    );
    expect(flag).toContain("layoutTemplateUid !== null");
    expect(flag).toContain("freeformLayout !== null");
    expect(flag).toContain("collapse).length > 0");
    expect(flag).not.toContain("backgroundTemplateUid");
  });
});
