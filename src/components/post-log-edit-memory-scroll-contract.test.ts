/**
 * Post-log Edit Memory scrolls (38.4 D-72 item 2; Plan 17 DEFECT-1).
 *
 * Quick Log → Add Note → Create Memory Instead → Edit Memory renders the full
 * `MemoryEditor` inside an `expanded` Sheet, whose consumers own their
 * workspace scroll (Sheet.tsx, D-32). On the Pixel 3a at the baseline font
 * (1.15) the editor was taller than the 92% sheet and sat in a plain View, so
 * "Allow AI to use this", "Move to Recently Deleted", Cancel and Save were
 * clipped and unreachable. The Edit Memory body must be a vertical ScrollView
 * that fills the expanded body and carries the heading, the editor and Done.
 *
 * Render-free: source assertions over PostLogNoteEditor.tsx.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(__dirname, "PostLogNoteEditor.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

/** The source from the `<ScrollView` that wraps `<MemoryEditor` to its close. */
function scrollAroundEditor(): { inner: string } {
  const editorAt = source.indexOf("<MemoryEditor");
  expect(editorAt).toBeGreaterThan(-1);
  const open = source.lastIndexOf("<ScrollView", editorAt);
  expect(open, "a ScrollView opens before <MemoryEditor").toBeGreaterThan(-1);
  const close = source.indexOf("</ScrollView>", editorAt);
  expect(close).toBeGreaterThan(editorAt);
  return { inner: source.slice(open, close) };
}

describe("post-log Edit Memory body scrolls (D-72)", () => {
  it("wraps the heading, MemoryEditor and Done in one ScrollView", () => {
    const { inner } = scrollAroundEditor();
    expect(inner).toContain("Edit Memory");
    expect(inner).toContain("<MemoryEditor");
    expect(inner).toContain('label="Done"');
    // No other ScrollView closes between the opener and the editor.
    const editorAt = inner.indexOf("<MemoryEditor");
    expect(inner.slice(0, editorAt)).not.toContain("</ScrollView>");
  });

  it("keeps taps on the editor controls while the keyboard is up and fills the expanded body", () => {
    const { inner } = scrollAroundEditor();
    const opener = inner.slice(0, inner.indexOf(">") + 1);
    expect(opener).toContain('keyboardShouldPersistTaps="handled"');
    expect(opener).toMatch(/style=\{styles\.editScroll\}/);
    const styles = source.slice(source.indexOf("StyleSheet.create("));
    expect(styles).toMatch(/editScroll:\s*\{\s*flex:\s*1/);
  });
});

describe("post-log Edit Memory opens the memory's form by default (D-73)", () => {
  it("passes the one shown memory's id as initiallyEditingId", () => {
    const { inner } = scrollAroundEditor();
    const editor = inner.slice(
      inner.indexOf("<MemoryEditor"),
      inner.indexOf("/>", inner.indexOf("<MemoryEditor")),
    );
    expect(editor).toContain("items={[memoryBeingEdited]}");
    expect(editor).toContain("initiallyEditingId={memoryBeingEdited.id}");
  });
});
