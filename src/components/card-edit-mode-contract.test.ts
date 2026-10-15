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

  it("opts in with cardEditMode, a formRef and the solid Add at the top (D-131)", () => {
    const [tag] = openingTags(screen, "MemoryEditor");
    expect(tag).toBeDefined();
    expect(tag).toMatch(/\bcardEditMode\b/);
    expect(tag).toContain("formRef={formRef}");
    // Plan 21 (D-131): the screen renders the solid Add bar above the
    // entries, and the editor renders no Add of its own.
    expect(tag).toContain('addPlacement="top"');
    expect(tag).not.toContain("addButton=");
    const bar = openingTags(screen, "Button").find((button) =>
      button.includes("label={sectionAddLabel(type)}"),
    );
    expect(bar).toContain('role="primary"');
    expect(screen.indexOf("label={sectionAddLabel(type)}")).toBeLessThan(
      screen.search(/<MemoryEditor\s/),
    );
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

  it("an edited row a reload removed keeps its form, and its draft, after the list (review WR-01)", () => {
    expect(screen).toMatch(
      /form\?\.mode === "edit" &&\s*!rows\.some\(\(row\) => row\.id === form\.row\.id\)\s*\?\s*renderEditForm\(form\.row\)/,
    );
    // Moving below the list remounts the form; this open's draft carries.
    const [edit] = openingTags(screen, "OffLimitsForm").filter((tag) =>
      /\bcardEditMode\b/.test(tag),
    );
    expect(edit).toContain("initialDraft={draft}");
    expect(edit).toContain("onDraftChange=");
    expect(screen).toContain("draftRef.current?.formKey === formKey");
    expect(screen).toContain("draftRef.current = { formKey, ...carried };");
    // The form starts from the carried typing, dirty against the stored row.
    expect(form).toContain(
      "useState(() => offLimitsFormOpening(initial, initialDraft))",
    );
    expect(form).toContain("useState(opening.draft)");
    expect(form).toContain("isOffLimitsFormDirty(baseline, draft)");
    expect(form).toMatch(/onDraftChangeRef\.current\?\.\(\{ draft, url \}\)/);
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
      /return editing \? \(\s*renderEditForm\(model\)\s*\) : \(\s*<HistoryRow/,
    );
    const renderEditForm = screen.slice(
      screen.indexOf("const renderEditForm"),
      screen.indexOf("const renderRow"),
    );
    expect(renderEditForm).toMatch(/return \(\s*<HistoryEntryForm/);
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

  it("an edited row a reload removed keeps its form, and its draft, after the list (review WR-01)", () => {
    expect(screen).toContain(
      "{orphanedEdit !== null ? renderEditForm(orphanedEdit) : null}",
    );
    expect(screen).toMatch(
      /orphanedEditRow\(\s*form\?\.mode === "edit" \? form\.row : null,\s*phase\.phase === "loaded" \? phase\.data : null,\s*\)/,
    );
    // Moving below the list remounts the form; this open's draft carries.
    const [form] = openingTags(screen, "HistoryEntryForm").filter((tag) =>
      tag.includes('testID="memory-history-edit-form"'),
    );
    expect(form).toContain("initialDraft={draft}");
    expect(form).toContain("onDraftChange=");
    expect(screen).toContain("draftRef.current?.formKey === formKey");
    expect(entryForm).toMatch(
      /useState\(initialDraft\?\.value \?\? initialValue\)/,
    );
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

  it("the screen's solid Add sits at the top (D-131); the editor renders none there", () => {
    // Plan 22 (D-131): the screen renders the primary Add bar above the
    // rows, and the editor runs with its Add slot at the top.
    const [tag] = openingTags(screen, "RelationshipEditor");
    expect(tag).toContain('addPlacement="top"');
    const bar = openingTags(screen, "Button").find((button) =>
      button.includes('testID="key-people-editor-add"'),
    );
    expect(bar).toContain('role="primary"');
    expect(screen.indexOf('testID="key-people-editor-add"')).toBeLessThan(
      screen.search(/<RelationshipEditor\s/),
    );
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

describe("a pencil that repeats its card's own tap is read once (38.10 verification)", () => {
  const pencilTag = (source: string) =>
    openingTags(source, "Button").find(
      (tag) => tag.includes('role="iconOnly"') && tag.includes('icon="edit"'),
    );

  it("Button hides itself from both platforms' screen readers on request", () => {
    const button = read("src/components/ui/Button.tsx");
    expect(button).toContain(
      'hiddenFromAccessibility ? "no-hide-descendants" : undefined',
    );
    expect(button).toContain(
      "accessibilityElementsHidden={hiddenFromAccessibility || undefined}",
    );
  });

  it("Off Limits and Key People rows always edit on tap, so their pencils are hidden", () => {
    expect(pencilTag(read(OFF_LIMITS))).toMatch(
      /\bhiddenFromAccessibility(?=[\s/>])/,
    );
    expect(pencilTag(read("src/components/RelationshipEditor.tsx"))).toMatch(
      /\bhiddenFromAccessibility(?=[\s/>])/,
    );
  });

  it("history page: only an unlinked row's pencil is hidden (a linked tap opens the interaction, D-107)", () => {
    const row = functionSource(read(HISTORY), "HistoryRow");
    expect(pencilTag(row)).toContain("hiddenFromAccessibility={!linked}");
  });

  it("the memory card hides its pencil only when the card announces the same Edit", () => {
    const card = read("src/components/MemoryCard.tsx");
    expect(card).toMatch(
      /const pencilDuplicatesCard =\s*onPress !== undefined && cardLabel === pencilLabel;/,
    );
    expect(pencilTag(card)).toContain(
      "hiddenFromAccessibility={pencilDuplicatesCard}",
    );
  });
});

describe("Add/Edit Contact reveal an inline edit form that opens after its cards (38.10 verification)", () => {
  for (const [name, file, count] of [
    ["Edit Contact", "src/screens/EditContactScreen.tsx", 6],
    ["Add Contact", "src/screens/CreateContactScreen.tsx", 5],
  ] as const) {
    it(`${name}: every inline editor scrolls its own form into view on Edit, with card edit mode still off`, () => {
      const source = read(file);
      const tags = [
        "MemoryEditor",
        "RelationshipEditor",
        "OffLimitsInlineEditor",
      ].flatMap((tag) => openingTags(source, tag));
      expect(tags).toHaveLength(count);
      const refs = tags.map((tag) => {
        expect(tag).not.toMatch(/\bcardEditMode\b/);
        const ref = /formRef=\{(\w+)\}/.exec(tag)?.[1];
        expect(ref, tag).toBeDefined();
        expect(tag).toContain(`onEditOpen={() => reveal(${ref})}`);
        expect(source).toContain(`const ${ref} = useRef<View>(null);`);
        return ref;
      });
      // One form ref per section: two open forms never share a target.
      expect(new Set(refs).size).toBe(count);
    });
  }

  it("Update Contact: Memory, Key People and Off Limits scroll an opened entry's form into view, with card edit mode still off", () => {
    const file = "src/screens/UpdateContactScreen.tsx";
    const source = read(file);
    // The screen owns the reveal and wires its ScrollView for it.
    expect(source).toContain(
      "const { scrollRef, contentRef, reveal } = useFirstErrorReveal();",
    );
    const [scroll] = openingTags(source, "ScrollView");
    expect(scroll).toContain("ref={scrollRef}");
    expect(scroll).toContain("innerViewRef={contentRef}");

    // The in-place Memory and Key People editors reveal through onEditOpen.
    const editors = [
      ["MemoryFocusedEditor", "MemoryEditor"],
      ["KeyPeopleFocusedEditor", "RelationshipEditor"],
    ] as const;
    const refs = editors.map(([host, tag]) => {
      const body = functionSource(source, host);
      const tags = openingTags(body, tag);
      expect(tags).toHaveLength(1);
      const [editor] = tags;
      expect(editor).not.toMatch(/\bcardEditMode\b/);
      const ref = /formRef=\{(\w+)\}/.exec(editor)?.[1];
      expect(ref, editor).toBeDefined();
      expect(editor).toContain(`onEditOpen={() => reveal(${ref})}`);
      expect(body).toContain(`const ${ref} = useRef<View>(null);`);
      return ref;
    });

    // Off Limits keeps its always-open form after the rows; opening a row
    // (not the new-item form) reveals it.
    const offLimits = functionSource(source, "OffLimitsFocusedEditor");
    const [form] = openingTags(offLimits, "OffLimitsForm");
    expect(form).toContain("formRef={offLimitsFormRef}");
    expect(offLimits).toContain("const offLimitsFormRef = useRef<View>(null);");
    expect(offLimits).toMatch(
      /const openForm = [\s\S]*?if \(row !== null\) reveal\(offLimitsFormRef\);[\s\S]*?\};/,
    );
    expect(new Set([...refs, "offLimitsFormRef"]).size).toBe(3);

    // Each of the three receives the screen's reveal.
    for (const host of [
      "MemoryFocusedEditor",
      "KeyPeopleFocusedEditor",
      "OffLimitsFocusedEditor",
    ]) {
      const [usage] = openingTags(source, host);
      expect(usage, host).toContain("reveal={reveal}");
    }
  });
});

describe("an editId opens its form only once (D-107; review IN-02)", () => {
  for (const [name, file] of [
    ["section editors", SECTION],
    ["Key People", KEY_PEOPLE],
  ] as const) {
    it(`${name}: a later load clears the initial edit, so a Retry remount reopens nothing`, () => {
      expect(read(file)).toMatch(
        /if \(editConsumedRef\.current\) \{\s*setInitialEditId\(undefined\);\s*return;\s*\}/,
      );
    });
  }
});

describe("held rows are dimmed while a form is open (D-144)", () => {
  // The memory cards' held look: MemoryCard draws a held card at
  // DISABLED_OPACITY 0.5 (D-26). The other three pages reuse that value.
  const card = read("src/components/MemoryCard.tsx");
  const editor = read("src/components/MemoryEditor.tsx");

  it("the memory cards are the reference: held with the form open, dimmed at 0.5", () => {
    expect(card).toMatch(/const DISABLED_OPACITY = 0\.5;/);
    expect(card).toContain("style={disabled ? styles.disabled : null}");
    expect(editor).toContain("disabled={cardsHeld}");
  });

  for (const [name, file, held] of [
    ["Off Limits", OFF_LIMITS, "controlsHeld"],
    ["history page", HISTORY, "held"],
    ["Key People", "src/components/RelationshipEditor.tsx", "rowsHeld"],
  ] as const) {
    it(`${name}: a held row draws the same 0.5 dimmed look`, () => {
      const source = read(file);
      expect(source).toMatch(/const DISABLED_OPACITY = 0\.5;/);
      expect(source).toContain("held: { opacity: DISABLED_OPACITY }");
      expect(source).toContain(`${held} ? styles.held : null`);
    });
  }
});

describe("the empty state hides while the add form is open (D-145)", () => {
  for (const [name, file, guard] of [
    [
      "section editors",
      SECTION,
      "phase.data.rows.length === 0 && !draftState.open",
    ],
    ["Key People", KEY_PEOPLE, "rows.length === 0 && !draftState.open"],
    ["Off Limits", OFF_LIMITS, "rows.length === 0 && form === null"],
  ] as const) {
    it(`${name}: the empty state renders only with no form open`, () => {
      const source = read(file);
      const guardAt = source.indexOf(guard);
      expect(guardAt, guard).toBeGreaterThanOrEqual(0);
      const emptyAt = source.indexOf("<EmptyState", guardAt);
      expect(emptyAt).toBeGreaterThan(guardAt);
      expect(source.slice(guardAt, emptyAt)).not.toContain("</");
    });
  }

  it("history page: the empty state gives way to any open form", () => {
    const source = read(HISTORY);
    expect(source).toMatch(/form !== null \? null : \(\s*<EmptyState/);
  });
});
