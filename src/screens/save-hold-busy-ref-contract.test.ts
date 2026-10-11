/**
 * Every guarded screen with an async save holds its exits while that save is
 * in flight (38.9 fix-pass WR-02 follow-up; D-13, D-14).
 *
 * Without the hold, Back during the save offered "Discard changes?"; Discard
 * removed the route (or closed the sub-editor), and the save then committed
 * and navigated anyway, against the user's choice. `useDiscardKeepGuard`'s
 * `busyRef` turns any removal during the save into a silent "hold" (its
 * decision and hook are tested in discard-keep-guard.test.ts). This contract
 * pins each screen's wiring:
 *
 * - the guard is given the screen's synchronous in-flight ref as `busyRef`;
 * - every save the guard covers claims that ref (`beginInFlight`) before its
 *   first await, so a Back in the same tick as the Save tap is already held,
 *   and releases it only in its `finally`;
 * - the header Back draws disabled while saving (D-26).
 *
 * Render-free: source assertions. Create / Edit Contact are pinned by
 * contact-save-single-flight-contract.test.ts. SurvivorSelectScreen is not
 * here: it has no save (Continue only navigates to Merge conflicts).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n");
}

/** The brace-balanced block that starts at the first `{` after `from`. */
function blockFrom(source: string, from: number, label: string): string {
  const open = source.indexOf("{", from);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, index + 1);
    }
  }
  throw new Error(`unterminated ${label}`);
}

/** The body of the save that `marker` (its declaration text) opens. */
function saveBody(source: string, marker: string): string {
  const start = source.indexOf(marker);
  expect(start, `${marker} not found`).toBeGreaterThan(-1);
  // Skip the parameter list so a destructured parameter is not the body.
  const arrowOrBrace = source.indexOf(")", start);
  return blockFrom(source, arrowOrBrace, marker);
}

/** The options object passed to `useDiscardKeepGuard(...)`. */
function guardOptions(source: string): string {
  const call = source.indexOf("useDiscardKeepGuard({");
  expect(call, "useDiscardKeepGuard call not found").toBeGreaterThan(-1);
  return blockFrom(source, call, "useDiscardKeepGuard options");
}

type ScreenCase = {
  path: string;
  /** The ref passed as `busyRef`. */
  ref: string;
  /** Declaration text of every save the guard covers. */
  saves: string[];
  /** The `backDisabled` expression on the save-capable header(s). */
  backDisabled: string;
  /** How many ShellAppBar tags must carry it (default 1). */
  headers?: number;
};

const CASES: ScreenCase[] = [
  {
    path: "src/screens/AIPersonalizationScreen.tsx",
    ref: "savingRef",
    saves: [
      "async function saveStyle()",
      "async function addSection()",
      "async function saveEditedSection(",
    ],
    backDisabled: "savingStyle || savingSection",
  },
  {
    path: "src/screens/SystemBuilderScreen.tsx",
    ref: "savingRef",
    saves: ["const save = async ()"],
    backDisabled: "saving",
    // The Preview header and the Definition / Members header.
    headers: 2,
  },
  {
    path: "src/screens/LogInteractionScreen.tsx",
    ref: "savingRef",
    saves: ["async function handleSave()"],
    backDisabled: "saving",
  },
  {
    path: "src/screens/GroupLogScreen.tsx",
    ref: "savingRef",
    saves: ["async function save()"],
    backDisabled: "saving",
  },
  {
    path: "src/screens/CustomFieldsScreen.tsx",
    ref: "savingRef",
    saves: ["async function handleCreate(", "async function handleEdit("],
    backDisabled: "saving",
  },
  {
    path: "src/screens/EditGroupEventScreen.tsx",
    ref: "savingRef",
    saves: ["async function saveEvent()"],
    backDisabled: "saving",
  },
  {
    path: "src/screens/EditInteractionScreen.tsx",
    ref: "savingRef",
    saves: ["async function handleSave()"],
    backDisabled: "saving",
  },
  {
    path: "src/screens/MemoryScreen.tsx",
    ref: "savingRef",
    saves: ["const add = async (", "const edit = async ("],
    backDisabled: "saving",
  },
  {
    path: "src/screens/EditParticipantScreen.tsx",
    ref: "savingRef",
    saves: ["async function save()"],
    backDisabled: "saving",
  },
];

describe.each(CASES)(
  "$path holds its exits while a save runs (WR-02)",
  ({ path, ref, saves, backDisabled, headers = 1 }) => {
    const source = read(path);

    it("declares the in-flight flag as a synchronous ref", () => {
      expect(source).toContain(`const ${ref} = useRef(false);`);
    });

    it("passes that ref to the guard as busyRef", () => {
      expect(guardOptions(source)).toMatch(new RegExp(`\\bbusyRef: ${ref}\\b`));
    });

    it.each(saves)(
      "%s claims the ref before its first await and releases it in finally",
      (marker) => {
        const body = saveBody(source, marker);
        const claim = body.indexOf(`beginInFlight(${ref})`);
        expect(claim, "beginInFlight claim").toBeGreaterThan(-1);
        expect(claim).toBeLessThan(body.indexOf("await "));
        const finallyAt = body.lastIndexOf("} finally {");
        expect(finallyAt, "finally").toBeGreaterThan(claim);
        expect(body.indexOf(`endInFlight(${ref})`, finallyAt)).toBeGreaterThan(
          finallyAt,
        );
        // Released once, only in the finally.
        expect(body.split(`endInFlight(${ref})`)).toHaveLength(2);
      },
    );

    it("draws the header Back disabled while saving (D-26)", () => {
      const tags = source.match(/<ShellAppBar[\s\S]*?\/>/g) ?? [];
      const held = tags.filter((tag) =>
        tag.includes(`backDisabled={${backDisabled}}`),
      );
      expect(held).toHaveLength(headers);
    });
  },
);

describe("UpdateContactScreen holds its exits while a row save runs (WR-02)", () => {
  const source = read("src/screens/UpdateContactScreen.tsx");

  it("the screen owns the row save slot and passes it to the guard", () => {
    expect(source).toContain("const rowSavingRef = useRef(false);");
    expect(guardOptions(source)).toMatch(/\bbusyRef: rowSavingRef\b/);
    expect(source).toMatch(/ref: rowSavingRef,\s*onSavingChange: setRowSaving/);
  });

  it("every row editor saves through the screen's slot, not a local ref", () => {
    // CurrentState, KeyPeople, OffLimits, ContactMethod, Frequency, CustomField.
    expect(source.match(/= useRowSave\(rowSave\);/g)).toHaveLength(6);
    expect(source).not.toMatch(/const savingRef = useRef\(/);
    const useRowSave = blockFrom(
      source,
      source.indexOf("function useRowSave("),
      "useRowSave",
    );
    expect(useRowSave).toContain("rowSave.onSavingChange(next)");
    expect(useRowSave).toContain("savingRef: rowSave.ref");
  });

  it("every editor rendered for a row receives the slot", () => {
    const render = blockFrom(
      source,
      source.indexOf("const renderActiveEditor = () =>"),
      "renderActiveEditor",
    );
    const editors = render.match(/<\w+FocusedEditor[\s\S]*?\/>/g) ?? [];
    expect(editors).toHaveLength(7);
    for (const editor of editors) expect(editor).toContain("rowSave={rowSave}");
    // The Generic chooser threads it to the field it opens.
    // The body: past the destructured, typed parameter list.
    const generic = blockFrom(
      source,
      source.indexOf(
        "}) {",
        source.indexOf("function GenericCustomFieldsFocusedEditor("),
      ) + 2,
      "GenericCustomFieldsFocusedEditor",
    );
    expect(generic).toContain("rowSave={rowSave}");
  });

  it("every row save claims the slot before its first await and releases it in finally", () => {
    const markers = [
      ...source.matchAll(/const (?:save|add|edit) = async \(/g),
    ].map((match) => match.index ?? -1);
    // Five `save`s (CurrentState, OffLimits, ContactMethod, Frequency,
    // CustomField) and KeyPeople's `add` + `edit`.
    expect(markers).toHaveLength(7);
    for (const at of markers) {
      const body = blockFrom(source, source.indexOf(")", at), "row save");
      const claim = body.indexOf("beginInFlight(savingRef)");
      expect(claim).toBeGreaterThan(-1);
      expect(claim).toBeLessThan(body.indexOf("await "));
      const finallyAt = body.lastIndexOf("} finally {");
      expect(body.indexOf("setSaving(false)", finallyAt)).toBeGreaterThan(
        finallyAt,
      );
      expect(body.indexOf("endInFlight(savingRef)", finallyAt)).toBeGreaterThan(
        finallyAt,
      );
    }
  });

  it("draws the chooser header Back disabled while a row saves (D-26)", () => {
    const tags = source.match(/<ShellAppBar[\s\S]*?\/>/g) ?? [];
    expect(
      tags.filter((tag) => tag.includes("backDisabled={rowSaving}")),
    ).toHaveLength(1);
  });
});
