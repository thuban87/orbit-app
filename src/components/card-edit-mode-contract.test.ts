/**
 * Card edit mode contract (Phase 38.10 D-130, plan 20).
 *
 * D-130 names four page types: the memory-type section editors, the Off
 * Limits editor, the Key People editor and the Last Talked About / Current
 * Location history page. On each, every card has a pencil, the form opens in
 * place of its card, Move and a red Delete show only in edit mode, and the
 * Add is solid. The shared editors opt in through `cardEditMode`, so their
 * other hosts (Add/Edit Contact, Update Contact, + → Memory) are unchanged.
 *
 * Textual, as `fab-clearance-contract.test.ts` is: comments are stripped and
 * a JSX element's opening tag is read up to its closing `>` at brace depth 0.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/** Source with line and block comments removed (string literals kept). */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

function read(file: string): string {
  return stripComments(readFileSync(join(ROOT, file), "utf8"));
}

/** Every opening tag of `<tag …>` / `<tag … />`, props included. */
function openingTags(source: string, tag: string): string[] {
  const tags: string[] = [];
  const pattern = new RegExp(`<${tag}(?=[\\s/>])`, "g");
  for (const match of source.matchAll(pattern)) {
    const start = match.index ?? 0;
    let depth = 0;
    for (let index = start + 1; index < source.length; index += 1) {
      const char = source[index];
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0 && source[index - 1] !== "=") {
        tags.push(source.slice(start, index + 1));
        break;
      }
    }
  }
  return tags;
}

/** The body of `function name(` up to the next top-level `function`. */
function functionSource(source: string, name: string): string {
  const start = source.search(new RegExp(`function\\s+${name}\\b`));
  expect(start, `${name} not found`).toBeGreaterThanOrEqual(0);
  const next = source.slice(start + 1).search(/\n(?:export )?function\s/);
  return next < 0 ? source.slice(start) : source.slice(start, start + 1 + next);
}

const SECTION = "src/screens/SectionEditorScreen.tsx";
const KEY_PEOPLE = "src/screens/KeyPeopleEditorScreen.tsx";
const OFF_LIMITS = "src/screens/OffLimitsEditorScreen.tsx";
const HISTORY = "src/screens/MemoryHistoryScreen.tsx";

describe("card edit mode: the memory section editors (D-130)", () => {
  const screen = read(SECTION);
  const editor = read("src/components/MemoryEditor.tsx");

  it("opts in with cardEditMode, a formRef and the solid Add", () => {
    const [tag] = openingTags(screen, "MemoryEditor");
    expect(tag).toBeDefined();
    expect(tag).toMatch(/\bcardEditMode\b/);
    expect(tag).toContain("formRef={formRef}");
    expect(tag).toContain("addButton={{ label: sectionAddLabel(type) }}");
  });

  it("the editor's addButton Add is role primary and its form Delete is destructive", () => {
    const buttons = openingTags(editor, "Button");
    expect(
      buttons.some(
        (tag) =>
          tag.includes('role="primary"') &&
          tag.includes("label={addButton.label}"),
      ),
    ).toBe(true);
    expect(buttons.some((tag) => tag.includes('role="destructive"'))).toBe(
      true,
    );
  });
});

describe("card edit mode: the Off Limits editor (D-130)", () => {
  const screen = read(OFF_LIMITS);
  const form = read("src/components/OffLimitsForm.tsx");

  it("renders the edit form with cardEditMode and onMove", () => {
    const tags = openingTags(screen, "OffLimitsForm");
    expect(
      tags.some(
        (tag) => /\bcardEditMode\b/.test(tag) && tag.includes("onMove="),
      ),
    ).toBe(true);
  });

  it("a resting row has a pencil and no Edit or Move button", () => {
    expect(screen).not.toContain('label="Move"');
    expect(screen).not.toContain('label="Edit"');
    expect(
      openingTags(screen, "Button").some(
        (tag) => tag.includes('role="iconOnly"') && tag.includes('icon="edit"'),
      ),
    ).toBe(true);
  });

  it("the Add is role primary", () => {
    const add = openingTags(screen, "Button").find((tag) =>
      tag.includes('testID="off-limits-editor-add"'),
    );
    expect(add).toContain('role="primary"');
  });

  it("OffLimitsForm draws Move and a destructive Delete only in card edit mode", () => {
    const buttons = openingTags(form, "Button");
    expect(buttons.some((tag) => tag.includes('role="destructive"'))).toBe(
      true,
    );
    expect(form).toMatch(/onDelete && !cardEditMode \?/);
    expect(form).toMatch(/\{cardEditMode \? \(/);
  });
});

describe("card edit mode: the history page (D-130)", () => {
  const screen = read(HISTORY);
  const row = functionSource(screen, "HistoryRow");
  const entryForm = functionSource(screen, "HistoryEntryForm");

  it("a resting row has a pencil and no Move or Edit button", () => {
    expect(row).not.toContain('label="Move"');
    expect(row).not.toContain('label="Edit"');
    expect(
      openingTags(row, "Button").some(
        (tag) => tag.includes('role="iconOnly"') && tag.includes('icon="edit"'),
      ),
    ).toBe(true);
  });

  it("the edit form renders instead of its row, with Move and a destructive Delete", () => {
    const renderRow = screen.slice(
      screen.indexOf("const renderRow"),
      screen.indexOf("return (\n    <View style={styles.root}>"),
    );
    expect(renderRow).toMatch(
      /return editing \? \(\s*<HistoryEntryForm[\s\S]*\) : \(\s*<HistoryRow/,
    );
    expect(
      openingTags(entryForm, "Button").some((tag) =>
        tag.includes('role="destructive"'),
      ),
    ).toBe(true);
    expect(entryForm).not.toContain('role="tertiary"');
    expect(entryForm).toContain('label="Move"');
  });

  it("the Add is role primary", () => {
    const add = openingTags(screen, "Button").find((tag) =>
      tag.includes('testID="memory-history-add"'),
    );
    expect(add).toContain('role="primary"');
  });
});

describe("card edit mode: the Key People editor (D-130)", () => {
  const screen = read(KEY_PEOPLE);
  const editor = read("src/components/RelationshipEditor.tsx");

  it("opts in with cardEditMode and a formRef", () => {
    const [tag] = openingTags(screen, "RelationshipEditor");
    expect(tag).toBeDefined();
    expect(tag).toMatch(/\bcardEditMode\b/);
    expect(tag).toContain("formRef={formRef}");
  });

  it("RelationshipEditor's Add is role primary and its edit-mode Delete is destructive", () => {
    const buttons = openingTags(editor, "Button");
    expect(
      buttons.some(
        (tag) =>
          tag.includes('role="primary"') && tag.includes("onPress={openNew}"),
      ),
    ).toBe(true);
    expect(buttons.some((tag) => tag.includes('role="destructive"'))).toBe(
      true,
    );
  });
});
