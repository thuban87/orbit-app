/**
 * FieldDefForm pure view-state logic (C2-M4) — the create-default /
 * edit-hydration decision and the draft→payload projection, extracted from the
 * `.tsx` so they are unit-testable in Node without a renderer (none is installed).
 *
 * WHY THIS IS SEPARATE FROM `FieldDefForm.tsx`:
 *   Vitest is render-free — there is no `react-test-renderer` /
 *   `@testing-library/react-native` in the graph — so any correctness-critical
 *   form decision lives here as a pure function (the repo `*-logic.ts` convention).
 *   The `.tsx` only binds React state + the themed `Switch` to `draft.share_with_ai`.
 *
 * THE H7 FIX THIS ENABLES:
 *   `share_with_ai` is a per-field AI-sharing opt-in that starts OFF on create and
 *   MUST survive an edit. `hydrateFieldDefDraft` seeds it (0 on create, the stored
 *   value on edit) and `draftToFieldFields` carries the toggled value into the
 *   submit payload so the edit path can no longer silently drop it. This module is
 *   node-pure: it imports only node-pure DEFS types, nothing from expo/react-native.
 */
import type { CustomFieldDef, NewFieldDef, SqliteBool } from "@/db/field-types";
import type { FieldType } from "@/schemas/types";

/**
 * The edited-definition delta the caller diffs against the original def. It now
 * carries `share_with_ai` so an edit can deliberately flip the AI-sharing opt-in
 * and have it persist (H7).
 */
export interface FieldDefDraft {
  label: string;
  type: FieldType;
  options: string | null;
  show_on_new: SqliteBool;
  always_show: SqliteBool;
  share_with_ai: SqliteBool;
}

/**
 * The DRAFT-DERIVED subset of a create payload — exactly the fields the editor
 * owns. It deliberately EXCLUDES the create-only metadata (`uid`, `col_name`,
 * `display_order`, `now`) that the component supplies when it composes the full
 * `NewFieldDef` (C3-L1). The edit-submit path passes this same subset to the
 * curation / share writers.
 */
export type FieldDraftFields = Pick<
  NewFieldDef,
  "label" | "type" | "options" | "show_on_new" | "always_show" | "share_with_ai"
>;

/** The stored-def subset `hydrateFieldDefDraft` reads when seeding an edit. */
type HydrationSource = Pick<
  CustomFieldDef,
  "label" | "type" | "options" | "show_on_new" | "always_show" | "share_with_ai"
>;

/**
 * Seed a `FieldDefDraft`. On CREATE (`initial` null/undefined) every flag —
 * including `share_with_ai` — defaults OFF and the text fields start empty. On
 * EDIT the draft mirrors the stored def so a `Switch` reflects the persisted
 * value and a toggle is a real change, not a reset. Pure: no I/O, never throws.
 */
export function hydrateFieldDefDraft(
  initial?: HydrationSource | null,
): FieldDefDraft {
  if (!initial) {
    return {
      label: "",
      type: "text",
      options: null,
      show_on_new: 0,
      always_show: 0,
      share_with_ai: 0,
    };
  }
  return {
    label: initial.label,
    type: initial.type,
    options: initial.options,
    show_on_new: initial.show_on_new,
    always_show: initial.always_show,
    share_with_ai: initial.share_with_ai,
  };
}

/**
 * Project a draft to the draft-derived payload subset (a FRESH object) — carrying
 * the toggled `share_with_ai` so neither the create nor the edit submit can drop
 * it. It returns ONLY the six editor-owned fields; the component adds create-only
 * metadata around this when building a `NewFieldDef`. Pure builder.
 */
export function draftToFieldFields(draft: FieldDefDraft): FieldDraftFields {
  return {
    label: draft.label,
    type: draft.type,
    options: draft.options,
    show_on_new: draft.show_on_new,
    always_show: draft.always_show,
    share_with_ai: draft.share_with_ai,
  };
}
