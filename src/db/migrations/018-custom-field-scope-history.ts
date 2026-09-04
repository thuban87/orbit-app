/**
 * Migration 018 — scope-ready custom fields and retained value history.
 *
 * This is intentionally additive: the normalized current-value table and its
 * ADR-001 uniqueness constraints remain exactly as migration 006 created them.
 */
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

export const ADD_CUSTOM_FIELD_SCOPE = `
ALTER TABLE custom_field_defs
  ADD COLUMN scope TEXT NOT NULL DEFAULT 'global';`;

export const ADD_CUSTOM_FIELD_HISTORY_RETAINED = `
ALTER TABLE custom_field_defs
  ADD COLUMN history_retained INTEGER NOT NULL DEFAULT 0;`;

export const ADD_CUSTOM_FIELD_GROUP = `
ALTER TABLE custom_field_defs
  ADD COLUMN field_group TEXT;`;

export const CREATE_CUSTOM_FIELD_VALUE_HISTORY = `
CREATE TABLE custom_field_value_history (
  id           INTEGER PRIMARY KEY,
  uid          TEXT UNIQUE NOT NULL,
  contact_id   INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  field_def_id INTEGER NOT NULL REFERENCES custom_field_defs(id) ON DELETE CASCADE,
  value        TEXT,
  created_at   TEXT NOT NULL
);`;

export const CREATE_CUSTOM_FIELD_VALUE_HISTORY_INDEX = `
CREATE INDEX idx_cf_value_history
  ON custom_field_value_history(contact_id, field_def_id, created_at);`;

export const migration018: Migration = {
  version: 18,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(ADD_CUSTOM_FIELD_SCOPE);
    await exec.execAsync(ADD_CUSTOM_FIELD_HISTORY_RETAINED);
    await exec.execAsync(ADD_CUSTOM_FIELD_GROUP);
    await exec.execAsync(CREATE_CUSTOM_FIELD_VALUE_HISTORY);
    await exec.execAsync(CREATE_CUSTOM_FIELD_VALUE_HISTORY_INDEX);
  },
};
