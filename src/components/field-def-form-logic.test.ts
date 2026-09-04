/**
 * FieldDefForm pure view-state logic — node-tested off-device (C2-M4).
 *
 * No renderer is installed (`react-test-renderer` / `@testing-library/react-native`
 * are absent), so the create-default / edit-hydration decision and the
 * draft→payload projection are proven here as pure functions. The rendered
 * `Switch` itself is a Plan 06 Pixel UAT.
 *
 * The H7 regression this guards: an edited `share_with_ai` flag must survive the
 * draft round-trip — hydrate from the stored value on edit, default OFF on
 * create, and carry the toggled value through `draftToFieldFields`.
 */
import { describe, expect, it } from "vitest";
import {
  draftToFieldFields,
  type FieldDefDraft,
  hydrateFieldDefDraft,
} from "@/components/field-def-form-logic";
import type { CustomFieldDef } from "@/db/field-types";

function storedDef(overrides: Partial<CustomFieldDef> = {}): CustomFieldDef {
  return {
    id: 1,
    uid: "uid-1",
    col_name: "nickname",
    label: "Nickname",
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
    created_at: "2026-08-14 12:00:00",
    modified_at: "2026-08-14 12:00:00",
    ...overrides,
  };
}

describe("hydrateFieldDefDraft — create default vs edit hydration (H7)", () => {
  it("defaults share_with_ai OFF (0) on create (no initial)", () => {
    const draft = hydrateFieldDefDraft(null);
    expect(draft.share_with_ai).toBe(0);
    expect(draft.label).toBe("");
    expect(draft.type).toBe("text");
    expect(draft.options).toBeNull();
    expect(draft.show_on_new).toBe(0);
    expect(draft.always_show).toBe(0);
  });

  it("seeds share_with_ai from the stored value on edit (=1)", () => {
    const draft = hydrateFieldDefDraft(storedDef({ share_with_ai: 1 }));
    expect(draft.share_with_ai).toBe(1);
  });

  it("seeds share_with_ai from a stored 0 on edit (stays 0)", () => {
    const draft = hydrateFieldDefDraft(storedDef({ share_with_ai: 0 }));
    expect(draft.share_with_ai).toBe(0);
  });

  it("hydrates the other draft fields from the stored def on edit", () => {
    const draft = hydrateFieldDefDraft(
      storedDef({
        label: "Tier",
        type: "dropdown",
        options: '["a","b"]',
        show_on_new: 1,
        always_show: 1,
        share_with_ai: 1,
      }),
    );
    expect(draft).toEqual<FieldDefDraft>({
      label: "Tier",
      type: "dropdown",
      options: '["a","b"]',
      show_on_new: 1,
      always_show: 1,
      share_with_ai: 1,
    });
  });
});

describe("draftToFieldFields — draft-derived payload subset (C3-L1)", () => {
  it("includes the toggled share_with_ai and only the draft-derived fields", () => {
    const draft: FieldDefDraft = {
      label: "Tier",
      type: "dropdown",
      options: '["a","b"]',
      show_on_new: 1,
      always_show: 0,
      share_with_ai: 1,
    };
    const fields = draftToFieldFields(draft);
    expect(fields).toEqual({
      label: "Tier",
      type: "dropdown",
      options: '["a","b"]',
      show_on_new: 1,
      always_show: 0,
      share_with_ai: 1,
    });
    // It is a fresh object (a builder, not the same reference).
    expect(fields).not.toBe(draft);
    // It carries NONE of the create-only metadata (uid/col_name/display_order/now).
    expect(fields).not.toHaveProperty("uid");
    expect(fields).not.toHaveProperty("col_name");
    expect(fields).not.toHaveProperty("display_order");
    expect(fields).not.toHaveProperty("now");
  });

  it("carries a disabled share_with_ai (0) through unchanged", () => {
    const draft: FieldDefDraft = {
      label: "Nickname",
      type: "text",
      options: null,
      show_on_new: 0,
      always_show: 0,
      share_with_ai: 0,
    };
    expect(draftToFieldFields(draft).share_with_ai).toBe(0);
  });
});
