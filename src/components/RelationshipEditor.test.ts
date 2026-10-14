import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Pressable: "Pressable",
  StyleSheet: { create: <T>(styles: T) => styles },
  TextInput: "TextInput",
  View: "View",
}));
vi.mock("@/components/ContactPicker", () => ({
  ContactPicker: "ContactPicker",
}));
vi.mock("@/components/ui", () => ({
  AppText: "AppText",
  Button: "Button",
  EntryTextField: "EntryTextField",
  OrbitSwitch: "OrbitSwitch",
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));
// The G-16 live-name read pulls in expo-sqlite through the database module.
vi.mock("@/db/database", () => ({ getExecutor: vi.fn() }));
vi.mock("@/db/picker-read", () => ({ listPickerContacts: vi.fn() }));

import type { RelationshipRow } from "@/db/relationships-read";
import {
  displayLinkedName,
  initialDraft,
  initialEditorState,
  isRelationshipDraftDirty,
  liveNameMap,
  relationshipDraftState,
  relationshipEditorSlots,
} from "./RelationshipEditor";

const row = {
  id: 4,
  person_name: "Sam",
  relation_type: "Sister",
  linked_contact_id: null,
  note: null,
  pinned: 0,
  hidden: null,
} as unknown as RelationshipRow;

describe("isRelationshipDraftDirty (D-14, D-61; E-09)", () => {
  it("an untouched new or edit form is clean", () => {
    expect(isRelationshipDraftDirty(initialDraft(), initialDraft())).toBe(
      false,
    );
    expect(isRelationshipDraftDirty(initialDraft(row), initialDraft(row))).toBe(
      false,
    );
  });

  it("typing a name, type or note is dirty", () => {
    const seed = initialDraft();
    expect(isRelationshipDraftDirty(seed, { ...seed, personName: "A" })).toBe(
      true,
    );
    expect(isRelationshipDraftDirty(seed, { ...seed, relationType: "B" })).toBe(
      true,
    );
    expect(isRelationshipDraftDirty(seed, { ...seed, note: "C" })).toBe(true);
  });

  it("linking a contact or toggling pin / visibility is dirty", () => {
    const seed = initialDraft(row);
    expect(
      isRelationshipDraftDirty(seed, { ...seed, linkedContactId: 9 }),
    ).toBe(true);
    expect(isRelationshipDraftDirty(seed, { ...seed, pinned: true })).toBe(
      true,
    );
    expect(isRelationshipDraftDirty(seed, { ...seed, hidden: 1 })).toBe(true);
  });

  it("text typed and then erased reads as untouched", () => {
    const seed = initialDraft();
    expect(isRelationshipDraftDirty(seed, { ...seed, relationType: "" })).toBe(
      false,
    );
  });

  it("relationshipDraftState reports open and dirty", () => {
    expect(relationshipDraftState(null, null)).toEqual({
      open: false,
      dirty: false,
    });
    expect(relationshipDraftState(null, initialDraft())).toEqual({
      open: true,
      dirty: false,
    });
    expect(relationshipDraftState(row, initialDraft(row))).toEqual({
      open: true,
      dirty: false,
    });
    expect(
      relationshipDraftState(null, { ...initialDraft(), personName: "Jo" }),
    ).toEqual({ open: true, dirty: true });
  });
});

describe("displayLinkedName (G-16, E-14; convergence c11, Claude C-12)", () => {
  const live = liveNameMap([
    { id: 9, name: "Jordan Lee" },
    { id: 12, name: "Archived Pat" },
  ]);

  it("a draft-only linked contact (no stored name) shows its live name", () => {
    expect(
      displayLinkedName(
        { linked_contact_id: 9, linked_contact_name: null },
        live,
      ),
    ).toBe("Jordan Lee");
  });

  it("a stale stored name is replaced by the live one", () => {
    expect(
      displayLinkedName(
        { linked_contact_id: 9, linked_contact_name: "Jordan" },
        live,
      ),
    ).toBe("Jordan Lee");
  });

  it("an archived linked contact still resolves (the read includes archived)", () => {
    expect(
      displayLinkedName(
        { linked_contact_id: 12, linked_contact_name: "Pat" },
        live,
      ),
    ).toBe("Archived Pat");
  });

  it("a linked id absent from the live list keeps its stored name", () => {
    expect(
      displayLinkedName(
        { linked_contact_id: 404, linked_contact_name: "Gone Person" },
        live,
      ),
    ).toBe("Gone Person");
    // Before the read finishes the live list is empty: nothing is blanked.
    expect(
      displayLinkedName(
        { linked_contact_id: 9, linked_contact_name: "Jordan" },
        liveNameMap([]),
      ),
    ).toBe("Jordan");
  });

  it("an unlinked row shows no linked name", () => {
    expect(
      displayLinkedName(
        { linked_contact_id: null, linked_contact_name: null },
        live,
      ),
    ).toBeNull();
  });
});

describe("initialEditorState (D-107; convergence c6, Codex C-03)", () => {
  it("an initiallyEditingId present in items opens that row's edit form", () => {
    const state = initialEditorState([row], 4);
    expect(state.editing).toBe(row);
    expect(state.draft).toEqual(initialDraft(row));
  });

  it("an id absent from items, or none, opens on the rows with no form", () => {
    expect(initialEditorState([row], 99)).toEqual({
      editing: null,
      draft: null,
    });
    expect(initialEditorState([row], undefined)).toEqual({
      editing: null,
      draft: null,
    });
  });
});

describe("relationshipEditorSlots (D-130 card edit mode)", () => {
  const items = [4, 5, 6].map((id) => ({ ...row, id })) as RelationshipRow[];
  const kinds = (slots: ReturnType<typeof relationshipEditorSlots>) =>
    slots.map((slot) => (slot.kind === "card" ? slot.item.id : slot.kind));

  it("in card edit mode an open edit takes its row's index, then the Add", () => {
    expect(
      kinds(
        relationshipEditorSlots({
          items,
          editingId: 5,
          adding: false,
          cardEditMode: true,
        }),
      ),
    ).toEqual([4, "form", 6, "add"]);
  });

  it("an add form stays at the end", () => {
    expect(
      kinds(
        relationshipEditorSlots({
          items,
          editingId: null,
          adding: true,
          cardEditMode: true,
        }),
      ),
    ).toEqual([4, 5, 6, "form"]);
  });

  it("without card edit mode keeps today's order", () => {
    expect(
      kinds(
        relationshipEditorSlots({
          items,
          editingId: 5,
          adding: false,
          cardEditMode: false,
        }),
      ),
    ).toEqual([4, 5, 6, "form"]);
    expect(
      kinds(
        relationshipEditorSlots({
          items,
          editingId: null,
          adding: false,
          cardEditMode: false,
        }),
      ),
    ).toEqual([4, 5, 6, "add"]);
  });
});
