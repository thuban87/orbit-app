import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
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
  OrbitSwitch: "OrbitSwitch",
}));
vi.mock("@/theme", () => ({ useTheme: () => ({ colors: {} }) }));

import type { RelationshipRow } from "@/db/relationships-read";
import {
  initialDraft,
  isRelationshipDraftDirty,
  relationshipDraftState,
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
