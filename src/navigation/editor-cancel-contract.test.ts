/**
 * Editor Cancel contract (38.9 D-61, D-14).
 *
 * An editor's own Cancel follows the Back rule: with typed changes it shows the
 * "Discard changes?" prompt, untouched it closes at once, and a successful save
 * still closes without a prompt. The behaviour lives in `useDiscardKeepGuard`'s
 * `requestClose` (unit-tested in discard-keep-guard.test.ts); this textual scan
 * pins each surface's wiring to it so a later edit cannot quietly route a
 * Cancel back to a bare close.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

/** The body of `function name() {` or `const name = (...) => {`. */
function functionBody(source: string, name: string): string {
  const start = source.search(
    new RegExp(`(?:function\\s+${name}\\b|const\\s+${name}\\s*=)`),
  );
  expect(start, `${name} not found`).toBeGreaterThanOrEqual(0);
  // The first brace after the name opens the body (no destructured params).
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, index + 1);
    }
  }
  throw new Error(`unterminated ${name}`);
}

describe("+ → Memory: Back and Cancel close the draft first (G-12; D-14, D-61)", () => {
  const screen = read("src/screens/MemoryScreen.tsx");
  const editor = read("src/components/MemoryEditor.tsx");

  it("MemoryScreen guards with a sub-editor that closes the draft, and no route dirt", () => {
    expect(screen).toMatch(
      /useDiscardKeepGuard\(\{[\s\S]*?hasUnsavedChanges:\s*false/,
    );
    expect(screen).toMatch(/subEditor:\s*\{[\s\S]*?closeDraft\(\)/);
  });

  it("MemoryScreen routes the editor's Cancel through requestClose", () => {
    expect(screen).toMatch(
      /onCancelRequest=\{\(close\)\s*=>\s*requestClose\(close,/,
    );
  });

  it("MemoryEditor's Cancel calls onCancelRequest when given and is never a bare close", () => {
    expect(editor).not.toMatch(/onPress=\{close\}/);
    expect(editor).toMatch(
      /onCancelRequest\s*\?\s*onCancelRequest\(close\)\s*:\s*close\(\)/,
    );
  });

  it("a successful save closes without a prompt", () => {
    const commit = functionBody(editor, "commit");
    expect(commit).toContain("if (saved) close()");
    expect(commit).not.toMatch(/confirmDiscard|requestClose|onCancelRequest/);
    const savedEffect = screen.slice(
      screen.indexOf("if (savedTick > 0)") - 200,
      screen.indexOf("if (savedTick > 0)") + 200,
    );
    expect(savedEffect).not.toMatch(/confirmDiscard|requestClose/);
    expect(savedEffect).toMatch(
      /bypassRef\.current = true;\s*navigation\.goBack\(\)/,
    );
  });
});

describe("Update Contact: every editor Cancel follows the Back rule (E-09; D-14, D-61)", () => {
  const screen = read("src/screens/UpdateContactScreen.tsx");
  const relationship = read("src/components/RelationshipEditor.tsx");

  it("guards with a sub-editor over the open row", () => {
    expect(screen).toMatch(
      /useDiscardKeepGuard\(\{[\s\S]*?hasUnsavedChanges:\s*false[\s\S]*?subEditor:\s*\{[\s\S]*?open:\s*session\.activeRowKey\s*!=\s*null/,
    );
    expect(screen).toMatch(/target:\s*"innermost"/);
  });

  it("no editor Cancel is a bare close", () => {
    // The screen no longer has a raw row-cancel handler.
    expect(screen).not.toMatch(/const onCancel = /);
    const render = functionBody(screen, "renderActiveEditor");
    const editorCancels = render.match(/onCancel=\{[^}]*\}/g) ?? [];
    expect(editorCancels.length).toBeGreaterThanOrEqual(7);
    for (const cancel of editorCancels) {
      expect(cancel).toBe("onCancel={requestRowCancel}");
    }
    expect(screen).not.toMatch(/\(\) => setSelected\(null\)/);
    expect(screen).not.toMatch(/onCancel=\{\(\) => setSession/);
    // cancelRow is reached only through closeLevel.
    const cancelRowCalls = screen.match(/cancelRow\(/g) ?? [];
    expect(cancelRowCalls).toHaveLength(1);
    expect(functionBody(screen, "closeLevel")).toContain("cancelRow(");
  });

  it("row and inner Cancels route through requestClose", () => {
    expect(functionBody(screen, "requestRowCancel")).toMatch(
      /requestClose\([\s\S]*?target:\s*"row"/,
    );
    expect(functionBody(screen, "requestInnerCancel")).toMatch(
      /requestClose\([\s\S]*?target:\s*"innermost"/,
    );
    expect(screen).toMatch(/onCancelRequest=\{onCancelRequest\}/);
  });

  it("successful saves close directly with no prompt", () => {
    expect(screen).toMatch(
      /const onSaved = \(\) => \{[\s\S]*?completeSave[\s\S]*?\};/,
    );
    const onSaved = screen.slice(
      screen.indexOf("const onSaved = () =>"),
      screen.indexOf("};", screen.indexOf("const onSaved = () =>")),
    );
    expect(onSaved).not.toMatch(/requestClose|confirmDiscard/);
  });

  it("RelationshipEditor's form Cancel calls onCancelRequest when given; commit closes directly", () => {
    expect(relationship).not.toMatch(/onPress=\{close\}/);
    expect(relationship).toMatch(
      /onCancelRequest\s*\?\s*onCancelRequest\(close\)\s*:\s*close\(\)/,
    );
    const commit = functionBody(relationship, "commit");
    expect(commit).toContain("if (saved) close()");
    expect(commit).not.toMatch(/confirmDiscard|requestClose|onCancelRequest/);
  });
});

describe("Custom fields editor Cancel (G-04; D-14, D-61)", () => {
  const screen = read("src/screens/CustomFieldsScreen.tsx");

  it("guards the in-screen editor as a sub-editor", () => {
    expect(screen).toMatch(
      /useDiscardKeepGuard\(\{[\s\S]*?hasUnsavedChanges:\s*false[\s\S]*?subEditor:\s*\{[\s\S]*?open:\s*editor\s*!==\s*null/,
    );
  });

  it("neither FieldDefForm Cancel is a bare close; both use requestClose", () => {
    expect(screen).not.toMatch(/onCancel=\{\(\) => setEditor\(null\)\}/);
    const cancels =
      screen.match(
        /onCancel=\{\(\) => requestClose\(closeEditor, editorDirty\)\}/g,
      ) ?? [];
    expect(cancels).toHaveLength(2);
  });

  it("a successful create or edit closes directly", () => {
    for (const name of ["handleCreate", "handleEdit"]) {
      const body = functionBody(screen, name);
      expect(body).toContain("setEditor(null)");
      expect(body).not.toMatch(/requestClose|confirmDiscard/);
    }
  });
});

describe("Edit Contact / Add Contact section fold (D-68; D-13 for Add Contact)", () => {
  for (const path of [
    "src/screens/EditContactScreen.tsx",
    "src/screens/CreateContactScreen.tsx",
  ]) {
    const screen = read(path);

    /** The `onExpandedChange={...}` expression of the section with this id. */
    const foldHandler = (id: string) => {
      const start = screen.indexOf(`sectionId="${id}"`);
      expect(start, `${path} ${id}`).toBeGreaterThan(-1);
      const attr = screen.indexOf("onExpandedChange={", start);
      const open = attr + "onExpandedChange=".length;
      let depth = 0;
      for (let index = open; index < screen.length; index += 1) {
        if (screen[index] === "{") depth += 1;
        if (screen[index] === "}") {
          depth -= 1;
          if (depth === 0) return screen.slice(open, index + 1);
        }
      }
      throw new Error(`unterminated onExpandedChange for ${id}`);
    };

    it(`${path}: Memories, Key People and Off Limits fold through requestClose + closeDraft`, () => {
      for (const id of ["memories", "keyPeople", "offLimits"]) {
        const handler = foldHandler(id);
        expect(handler).toContain("requestClose(");
        expect(handler).toContain("closeDraft()");
        expect(handler).toMatch(/next\s*\?\s*setSectionExpanded\(/);
      }
    });

    it(`${path}: other sections fold directly`, () => {
      for (const id of ["identity", "methods", "currentLocation"]) {
        expect(foldHandler(id)).toMatch(
          new RegExp(
            `^\\{\\(next\\)\\s*=>\\s*setSectionExpanded\\("${id}",\\s*next\\)\\s*\\}$`,
          ),
        );
      }
    });

    it(`${path}: passes draft state and closeDraft refs to every draft editor`, () => {
      expect(screen).toMatch(
        /<MemoryEditor[\s\S]*?ref=\{memoryEditorRef\}[\s\S]*?onDraftStateChange=/,
      );
      expect(screen).toMatch(
        /<RelationshipEditor[\s\S]*?ref=\{relationshipEditorRef\}[\s\S]*?onDraftStateChange=/,
      );
      // The Off Limits draft row (review CR-01).
      expect(screen).toMatch(
        /<FuelEditor[\s\S]*?ref=\{fuelEditorRef\}[\s\S]*?onDraftStateChange=/,
      );
      expect(screen).toMatch(/offLimits:\s*offLimitsDraft/);
      expect(screen).toMatch(/subEditor:\s*\{[\s\S]*?pickedDraft/);
    });
  }

  it("AccordionSection does not import the guard", () => {
    expect(read("src/components/ui/AccordionSection.tsx")).not.toContain(
      "discard-keep-guard",
    );
  });
});
