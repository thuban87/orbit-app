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
    path: "src/screens/MemoryAddScreen.tsx",
    ref: "savingRef",
    saves: ["const add = async ("],
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

    it("takes settleHold from the guard (third fix pass WR-01)", () => {
      const call = source.indexOf("useDiscardKeepGuard({");
      const head = source.slice(source.lastIndexOf("\n", call), call);
      expect(head).toMatch(/const \{ (?:requestClose, )?settleHold \} = $/);
    });

    it.each(saves)(
      "%s settles the hold after releasing the ref, so a parked RESET is re-dispatched (WR-01)",
      (marker) => {
        const body = saveBody(source, marker);
        const finallyAt = body.lastIndexOf("} finally {");
        const release = body.indexOf(`endInFlight(${ref})`, finallyAt);
        expect(body.indexOf("settleHold();", release)).toBeGreaterThan(release);
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

// The + → Memory form is add-only (38.10 D-63), so it has no edit, Delete
// or Allow AI handler to pin (checker W16).
describe("MemoryAddScreen lets a parked removal through only when a save fails (WR-01)", () => {
  const source = read("src/screens/MemoryAddScreen.tsx");

  it.each(["const add = async ("])(
    "%s skips the settle after a commit: its deferred goBack wins",
    (marker) => {
      const body = saveBody(source, marker);
      expect(body).toContain("let committed = false;");
      expect(body.indexOf("committed = true;")).toBeLessThan(
        body.indexOf("setSavedTick("),
      );
      expect(body).toContain("if (!committed) settleHold();");
    },
  );
});

/**
 * The in-form exits are held too (WR-02 follow-up, "Not fixed, needs a
 * decision" list; D-13, D-14, D-26): a sub-editor's own Cancel during a save
 * would otherwise close it (after a Discard prompt if dirty) while the save
 * committed anyway.
 */
describe("MemoryAddScreen holds MemoryEditor's in-form controls while saving", () => {
  const source = read("src/screens/MemoryAddScreen.tsx");

  it("passes the save mirror to MemoryEditor as busy", () => {
    const tags = source.match(/<MemoryEditor\s[\s\S]*?\/>/g) ?? [];
    expect(tags).toHaveLength(1);
    expect(tags[0]).toContain("busy={saving}");
  });

  it("the mirror is set beside the ref in both saves", () => {
    for (const marker of ["const add = async ("]) {
      const body = saveBody(source, marker);
      expect(body.indexOf("setSaving(true)")).toBeGreaterThan(
        body.indexOf("beginInFlight(savingRef)"),
      );
      expect(body.indexOf("setSaving(true)")).toBeLessThan(
        body.indexOf("await "),
      );
      expect(body.indexOf("setSaving(false)")).toBeGreaterThan(
        body.lastIndexOf("} finally {"),
      );
    }
  });
});

describe("AIPersonalizationScreen holds the section editors while a save runs", () => {
  const source = read("src/screens/AIPersonalizationScreen.tsx");
  /** The body of a local component, past its typed parameter list. */
  const componentBody = (name: string) =>
    blockFrom(
      source,
      source.indexOf("}) {", source.indexOf(`function ${name}(`)) + 2,
      name,
    );

  it("the busy flag covers every save the shared ref serializes", () => {
    expect(source).toContain(
      "const sectionFormBusy = savingStyle || savingSection;",
    );
  });

  it("both section editors are given it", () => {
    for (const tag of ["<SectionEditor", "<NewSectionEditor"]) {
      const at = source.indexOf(`${tag}\n`);
      expect(at, tag).toBeGreaterThan(-1);
      const element = source.slice(at, source.indexOf("/>", at));
      expect(element).toContain("busy={sectionFormBusy}");
    }
  });

  it("NewSectionEditor draws Cancel and Save section disabled while busy", () => {
    const body = componentBody("NewSectionEditor");
    const buttons = body.match(/<Button[\s\S]*?\/>/g) ?? [];
    for (const label of ["Cancel", "Save section"]) {
      const button = buttons.find((b) => b.includes(`label="${label}"`));
      expect(button, label).toBeDefined();
      expect(button).toContain("disabled={busy}");
    }
  });

  // 38.12 D-120: each section's actions live in its ⋯ menu; the row is drawn
  // busy (handle, ⋯ and switch held) and every handler the screen hands it
  // re-reads the ref (third fix pass WR-02, D-26).
  it("holds each section's ⋯ and the actions it opens (third fix pass WR-02)", () => {
    const at = source.indexOf("<PersonalizationSectionCard\n");
    expect(at, "PersonalizationSectionCard element").toBeGreaterThan(-1);
    const element = source.slice(at, source.indexOf(">\n", at));
    expect(element).toContain("busy={listBusy}");
    expect(source).toContain("const listBusy = sectionFormBusy || reordering;");
    // A press in the frame before the re-render reads the ref.
    for (const handler of ["onEdit", "onReplace", "onDelete", "onToggle"]) {
      const start = element.indexOf(`${handler}={`);
      expect(start, handler).toBeGreaterThan(-1);
      const body = blockFrom(element, start, handler);
      expect(body, handler).toMatch(/if \(savingRef\.current[^)]*\) return;/);
    }
    // The row's ⋯ and handle draw disabled while busy.
    const row = componentBody("PersonalizationSectionCard");
    for (const testID of [
      "personalization-drag-",
      "personalization-options-",
    ]) {
      const pressable = row.slice(row.indexOf(testID));
      expect(
        pressable.slice(0, pressable.indexOf("</Pressable>")),
        testID,
      ).toContain("disabled={busy}");
    }
  });

  it("SectionEditor passes busy through to the form it renders", () => {
    const body = componentBody("SectionEditor");
    expect(body).toMatch(/<NewSectionEditor[\s\S]*?busy=\{busy\}[\s\S]*?\/>/);
  });
});
