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
    expect(source).toContain('type: "reorder", parent, id: items[from].id, toIndex: to');
    expect(source).toContain("onLongPress={drag}");
    expect(source).not.toContain("PanResponder");
  });

  it("retains the labelled non-precision fallback controls", () => {
    const source = editorSource();

    expect(source).toContain('label="Move up"');
    expect(source).toContain('label="Move down"');
    expect(source).toContain("accessibilityLabel={`Move ${definition.label} up`}");
    expect(source).toContain("accessibilityLabel={`Move ${definition.label} down`}");
  });
});
