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
  openRow,
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

  it("Done exits the session", () => {
    const done = finishSession(startSession(3));
    expect(done.done).toBe(true);
    expect(isChooserVisible(done)).toBe(false);
  });
});
