/**
 * Shared custom-field DB-row types (FLD-01) — the shape of a `custom_field_defs`
 * row and its create payload, imported by every Phase-3 module (Plans 02–08).
 *
 * TWO-TABLE MODEL (HANDOFF §14.1, CLAUDE.md invariant): a custom field is a
 * ROW here in `custom_field_defs` (label, type, flags) AND a COLUMN in
 * `contact_custom_values`. This file types only the DEFS row. `col_name` is the
 * stable internal slug that names the value column; it is produced ONCE by
 * `makeColName` (col-name.ts) and never re-derived from `label` on rename.
 *
 * Storage type vs field type are DIFFERENT concepts: every value column is TEXT
 * forever, while `type` here drives the UI widget only. Booleans/flags are the
 * SQLite integer convention (0 | 1). This module is node-pure — it imports the
 * `FieldType` union from the schema layer and nothing from expo/react-native.
 */
import type { FieldType } from "@/schemas/types";

/** The 0/1 integer boolean convention SQLite uses for flag columns. */
export type SqliteBool = 0 | 1;

/**
 * One row of `custom_field_defs` — the definition of a single custom field.
 * Mirrors `CREATE_CUSTOM_FIELD_DEFS` (migrations/001-initial.ts) column-for-column.
 */
export interface CustomFieldDef {
  /** INTEGER PRIMARY KEY rowid. */
  id: number;
  /** Merge-key UUID (newest-edit-wins sync). */
  uid: string;
  /** Whitelist-constructed value-column identifier — the ONLY interpolated name. */
  col_name: string;
  /** User-entered display label (freely editable; never re-slugified). */
  label: string;
  /** Field type — drives the UI widget only, NOT storage (storage is TEXT). */
  type: FieldType;
  /** JSON options array for `dropdown`, else null. */
  options: string | null;
  /** Show this field on the new-contact form. */
  show_on_new: SqliteBool;
  /** Always render this field on the profile, even when empty. */
  always_show: SqliteBool;
  /** Manual ordering within the field list. */
  display_order: number;
  /** Local wall-clock stamp when quarantined (soft-delete), else null. */
  quarantined_at: string | null;
  /** Include this field's value in AI suggestion payloads. */
  share_with_ai: SqliteBool;
  /** Local wall-clock creation stamp. */
  created_at: string;
  /** Local wall-clock last-modified stamp. */
  modified_at: string;
}

/**
 * Create payload for a new custom field (Plan 03 `createField`). The DB assigns
 * `id`; `quarantined_at` starts null; `created_at`/`modified_at` are both set
 * from `now`. `col_name` MUST come from `makeColName` — never from raw label.
 */
export interface NewFieldDef {
  uid: string;
  col_name: string;
  label: string;
  type: FieldType;
  options: string | null;
  show_on_new: SqliteBool;
  always_show: SqliteBool;
  display_order: number;
  share_with_ai: SqliteBool;
  /** Local wall-clock now — used for both created_at and modified_at. */
  now: string;
}
