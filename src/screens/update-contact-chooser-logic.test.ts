import { describe, expect, it } from "vitest";
import type { CustomFieldDef } from "@/db/field-types";
import {
  buildChooserRows,
  type ChooserRow,
  cancelRow,
  completeSave,
  finishSession,
  GENERIC_CUSTOM_FIELDS_LABEL,
  isChooserVisible,
  isRowDraftDirty,
  openRow,
  resolveUpdateEditorClose,
  selectApplicableDefs,
  startSession,
  targetContact,
} from "./update-contact-chooser-logic";

const CONTACT = { id: 7 };

function def(overrides: Partial<CustomFieldDef> = {}): CustomFieldDef {
  return {
    id: 1,
    uid: "uid-1",
    col_name: "cf_favorite_restaurant",
    label: "Favorite restaurant",
    type: "text",
    options: null,
    show_on_new: 0,
    always_show: 0,
    display_order: 0,
    quarantined_at: null,
    share_with_ai: 0,
    scope: "global",
    history_retained: 0,
    field_group: null,
    created_at: "2026-09-01 00:00:00",
    modified_at: "2026-09-01 00:00:00",
    ...overrides,
  };
}

const labels = (rows: ChooserRow[]) => rows.map((row) => row.label);
const kinds = (rows: ChooserRow[]) => rows.map((row) => row.kind);

describe("buildChooserRows", () => {
  it("never includes Category", () => {
    const rows = buildChooserRows(CONTACT, []);
    expect(labels(rows)).not.toContain("Category");
    expect(kinds(rows)).not.toContain("category" as never);
  });

  it("always includes the generic Custom Fields row, even with no custom fields", () => {
    const rows = buildChooserRows(CONTACT, []);
    const generic = rows.filter((row) => row.kind === "custom_fields");
    expect(generic).toHaveLength(1);
    expect(generic[0].label).toBe(GENERIC_CUSTOM_FIELDS_LABEL);
  });

  it("is never empty — built-in rows always render", () => {
    expect(buildChooserRows(CONTACT, []).length).toBeGreaterThan(0);
  });

  it("renders the seven built-in rows in a fixed order before custom fields", () => {
    const rows = buildChooserRows(CONTACT, []);
    expect(kinds(rows)).toEqual([
      "last_talked_about",
      "key_people",
      "current_location",
      "memory",
      "off_limits",
      "contact_method",
      "contact_frequency",
      "custom_fields",
    ]);
  });

  it("surfaces applicable named custom fields by label between built-ins and the generic row", () => {
    const rows = buildChooserRows(CONTACT, [
      def({ id: 3, label: "Anniversary" }),
    ]);
    const named = rows.filter((row) => row.kind === "custom_field");
    expect(named).toHaveLength(1);
    expect(named[0].label).toBe("Anniversary");
    expect(named[0].fieldDefId).toBe(3);
    // Named custom field sits AFTER the built-ins and BEFORE the generic row.
    const namedIndex = rows.findIndex((row) => row.kind === "custom_field");
    const genericIndex = rows.findIndex((row) => row.kind === "custom_fields");
    expect(namedIndex).toBeLessThan(genericIndex);
    expect(namedIndex).toBeGreaterThan(6);
  });

  it("is order-stable across repeated calls", () => {
    const applicable = [
      def({ id: 2, label: "Kids' school", display_order: 1 }),
      def({ id: 3, label: "Anniversary", display_order: 0 }),
    ];
    const first = buildChooserRows(CONTACT, applicable);
    const second = buildChooserRows(CONTACT, applicable);
    expect(first.map((row) => row.key)).toEqual(second.map((row) => row.key));
  });

  it("keys named custom-field rows uniquely by definition id (no duplicate schema)", () => {
    const rows = buildChooserRows(CONTACT, [
      def({ id: 2, label: "Kids' school" }),
      def({ id: 3, label: "Anniversary" }),
    ]);
    const keys = rows.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("selectApplicableDefs", () => {
  it("omits an inapplicable named field but the generic Custom Fields row still appears", () => {
    const empty = def({ id: 4, col_name: "cf_empty", always_show: 0 });
    const applicable = selectApplicableDefs([empty], {});
    expect(applicable).toHaveLength(0);
    const rows = buildChooserRows(CONTACT, applicable);
    expect(rows.some((row) => row.kind === "custom_fields")).toBe(true);
    expect(rows.some((row) => row.kind === "custom_field")).toBe(false);
  });

  it("includes an always-show field even without a value", () => {
    const alwaysShow = def({ id: 5, col_name: "cf_always", always_show: 1 });
    expect(selectApplicableDefs([alwaysShow], {})).toHaveLength(1);
  });

  it("includes a field that has a value for this contact", () => {
    const valued = def({ id: 6, col_name: "cf_valued", always_show: 0 });
    expect(
      selectApplicableDefs([valued], { cf_valued: "some value" }),
    ).toHaveLength(1);
  });

  it("excludes a quarantined field even when it has a value", () => {
    const quarantined = def({
      id: 7,
      col_name: "cf_q",
      always_show: 1,
      quarantined_at: "2026-09-01 00:00:00",
    });
    expect(selectApplicableDefs([quarantined], { cf_q: "x" })).toHaveLength(0);
  });

  it("orders applicable defs by display_order", () => {
    const applicable = selectApplicableDefs(
      [
        def({ id: 2, col_name: "cf_b", always_show: 1, display_order: 2 }),
        def({ id: 3, col_name: "cf_a", always_show: 1, display_order: 1 }),
      ],
      {},
    );
    expect(applicable.map((d) => d.id)).toEqual([3, 2]);
  });
});

describe("chooser session (repeated-update loop)", () => {
  it("preselects the contact and shows the chooser when targeted", () => {
    const session = startSession(42);
    expect(session.contactId).toBe(42);
    expect(isChooserVisible(session)).toBe(true);
  });

  it("hides the chooser until an untargeted session resolves a contact", () => {
    const untargeted = startSession(null);
    expect(isChooserVisible(untargeted)).toBe(false);
    const resolved = targetContact(untargeted, 9);
    expect(resolved.contactId).toBe(9);
    expect(isChooserVisible(resolved)).toBe(true);
  });

  it("returns to the chooser with the same contact after a successful save", () => {
    const opened = openRow(startSession(3), "current_location");
    expect(isChooserVisible(opened)).toBe(false);
    const saved = completeSave(opened);
    expect(saved.contactId).toBe(3);
    expect(saved.activeRowKey).toBeNull();
    expect(saved.lastSavedRowKey).toBe("current_location");
    expect(isChooserVisible(saved)).toBe(true);
  });

  it("cancelling an editor returns to the chooser without a recent-success cue", () => {
    const opened = openRow(startSession(3), "off_limits");
    const cancelled = cancelRow(opened);
    expect(cancelled.activeRowKey).toBeNull();
    expect(cancelled.lastSavedRowKey).toBeNull();
  });

  it("the Memory row opens in place and a save returns to the chooser (CAPT-12; D-115)", () => {
    const opened = openRow(startSession(3), "memory");
    expect(opened.activeRowKey).toBe("memory");
    expect(isChooserVisible(opened)).toBe(false);
    const saved = completeSave(opened);
    expect(isChooserVisible(saved)).toBe(true);
    expect(saved.activeRowKey).toBeNull();
    expect(saved.lastSavedRowKey).toBe("memory");
    expect(saved.contactId).toBe(3);
  });

  it("Done exits the session", () => {
    const done = finishSession(startSession(3));
    expect(done.done).toBe(true);
    expect(isChooserVisible(done)).toBe(false);
  });
});

describe("resolveUpdateEditorClose (D-14 innermost first; review H1)", () => {
  it("nothing open → null", () => {
    expect(
      resolveUpdateEditorClose({
        rowOpen: false,
        innerOpen: false,
        target: "innermost",
      }),
    ).toBeNull();
  });

  it("custom field path: a field from the chooser closes back to the chooser, then the row", () => {
    // Field selected in the Custom Fields chooser.
    expect(
      resolveUpdateEditorClose({
        rowOpen: true,
        innerOpen: true,
        target: "innermost",
      }),
    ).toBe("inner");
    // Back at the chooser: the second Back closes the row (cancelRow).
    expect(
      resolveUpdateEditorClose({
        rowOpen: true,
        innerOpen: false,
        target: "innermost",
      }),
    ).toBe("row");
  });

  it("key-person path: an open form closes before the Key people row", () => {
    expect(
      resolveUpdateEditorClose({
        rowOpen: true,
        innerOpen: true,
        target: "innermost",
      }),
    ).toBe("inner");
  });

  it("memory path: an open memory draft closes before the Memory row (D-115)", () => {
    expect(
      resolveUpdateEditorClose({
        rowOpen: true,
        innerOpen: true,
        target: "innermost",
      }),
    ).toBe("inner");
  });

  it("the row's own Cancel always closes the row", () => {
    expect(
      resolveUpdateEditorClose({
        rowOpen: true,
        innerOpen: true,
        target: "row",
      }),
    ).toBe("row");
    expect(
      resolveUpdateEditorClose({
        rowOpen: true,
        innerOpen: false,
        target: "row",
      }),
    ).toBe("row");
  });
});

describe("isRowDraftDirty (D-14, D-61; E-09)", () => {
  it("current-state text: dirty only after typing", () => {
    expect(isRowDraftDirty({ kind: "text", seed: "", current: "" })).toBe(
      false,
    );
    expect(isRowDraftDirty({ kind: "text", seed: "", current: "Paris" })).toBe(
      true,
    );
  });

  it("Off Limits per-edit seed (review C4-M3)", () => {
    // Untouched new item; new item with text.
    expect(isRowDraftDirty({ kind: "text", seed: "", current: "" })).toBe(
      false,
    );
    expect(isRowDraftDirty({ kind: "text", seed: "", current: "work" })).toBe(
      true,
    );
    // Existing item selected: its text is the seed.
    expect(
      isRowDraftDirty({ kind: "text", seed: "politics", current: "politics" }),
    ).toBe(false);
    expect(
      isRowDraftDirty({ kind: "text", seed: "politics", current: "" }),
    ).toBe(true);
    expect(
      isRowDraftDirty({ kind: "text", seed: "politics", current: "polit" }),
    ).toBe(true);
    // Restored to its original text.
    expect(
      isRowDraftDirty({ kind: "text", seed: "politics", current: "politics" }),
    ).toBe(false);
  });

  it("contact methods: compared against the seeded groups, ignoring generated uids", () => {
    const groups = (uid: string, value: string) => ({
      phone: [{ uid, type: "phone", value, label: "Main" }],
      email: [],
    });
    const seed = groups("a", "555");
    expect(isRowDraftDirty({ kind: "methods", seed, current: seed })).toBe(
      false,
    );
    expect(
      isRowDraftDirty({ kind: "methods", seed, current: groups("a", "5556") }),
    ).toBe(true);
    expect(
      isRowDraftDirty({ kind: "methods", seed, current: groups("b", "555") }),
    ).toBe(false);
    expect(
      isRowDraftDirty({
        kind: "methods",
        seed: { phone: [], email: [] },
        current: { phone: [], email: [] },
      }),
    ).toBe(false);
  });

  describe("frequency (reviews C4-M2, C5-L6)", () => {
    const presetDraft = { customMode: false, raw: "", unit: "days" as const };
    const settled = { intervalDays: 30, draft: presetDraft };

    it("is clean until the header read settles", () => {
      expect(
        isRowDraftDirty({
          kind: "frequency",
          seed: null,
          current: { intervalDays: 7, draft: presetDraft },
        }),
      ).toBe(false);
    });

    it("a null-interval contact opened and left untouched is clean", () => {
      // Seed = DEFAULT_INTERVAL_DAYS when the stored interval is null.
      expect(
        isRowDraftDirty({ kind: "frequency", seed: settled, current: settled }),
      ).toBe(false);
    });

    it("picking a different preset is dirty", () => {
      expect(
        isRowDraftDirty({
          kind: "frequency",
          seed: settled,
          current: { intervalDays: 7, draft: presetDraft },
        }),
      ).toBe(true);
    });

    it("opening Custom without typing is clean", () => {
      expect(
        isRowDraftDirty({
          kind: "frequency",
          seed: settled,
          current: {
            intervalDays: 30,
            draft: { customMode: true, raw: "", unit: "days" },
          },
        }),
      ).toBe(false);
    });

    it("invalid custom text such as 0 emits no interval but is dirty", () => {
      expect(
        isRowDraftDirty({
          kind: "frequency",
          seed: settled,
          current: {
            intervalDays: 30,
            draft: { customMode: true, raw: "0", unit: "days" },
          },
        }),
      ).toBe(true);
    });

    it("a changed unit while Custom is open is dirty", () => {
      expect(
        isRowDraftDirty({
          kind: "frequency",
          seed: settled,
          current: {
            intervalDays: 30,
            draft: { customMode: true, raw: "", unit: "weeks" },
          },
        }),
      ).toBe(true);
    });
  });

  it("custom field: clean until read, then dirty once the value differs", () => {
    expect(
      isRowDraftDirty({
        kind: "custom_field",
        ready: false,
        seed: null,
        current: "x",
      }),
    ).toBe(false);
    expect(
      isRowDraftDirty({
        kind: "custom_field",
        ready: true,
        seed: "a",
        current: "a",
      }),
    ).toBe(false);
    expect(
      isRowDraftDirty({
        kind: "custom_field",
        ready: true,
        seed: null,
        current: "",
      }),
    ).toBe(false);
    expect(
      isRowDraftDirty({
        kind: "custom_field",
        ready: true,
        seed: "a",
        current: "b",
      }),
    ).toBe(true);
  });
});
