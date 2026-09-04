/**
 * Migration 016 — additive Contact Knowledge foundation.
 *
 * This forward-only migration introduces the phase's three new tables. It
 * intentionally does not reshape fuel or alter either custom-field table;
 * those scope-changing moves belong to Phase 24.2.
 */
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

export const CREATE_MEMORIES = `
CREATE TABLE memories (
  id              INTEGER PRIMARY KEY,
  uid             TEXT UNIQUE NOT NULL,
  contact_id      INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  custom_label    TEXT,
  value           TEXT,
  note            TEXT,
  url             TEXT,
  meaningful_date TEXT,
  pinned          INTEGER NOT NULL DEFAULT 0,
  outdated        INTEGER NOT NULL DEFAULT 0,
  hidden          INTEGER,
  provenance      TEXT NOT NULL DEFAULT 'user',
  created_at      TEXT NOT NULL,
  modified_at     TEXT NOT NULL,
  deleted_at      TEXT
);`;

export const CREATE_RELATIONSHIPS = `
CREATE TABLE relationships (
  id                INTEGER PRIMARY KEY,
  uid               TEXT UNIQUE NOT NULL,
  contact_id        INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  person_name       TEXT NOT NULL,
  relation_type     TEXT,
  linked_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  note              TEXT,
  pinned            INTEGER NOT NULL DEFAULT 0,
  hidden            INTEGER,
  created_at        TEXT NOT NULL,
  modified_at       TEXT NOT NULL,
  deleted_at        TEXT,
  CHECK (linked_contact_id IS NULL OR linked_contact_id != contact_id)
);`;

export const CREATE_CURRENT_STATE_ENTRIES = `
CREATE TABLE current_state_entries (
  id          INTEGER PRIMARY KEY,
  uid         TEXT UNIQUE NOT NULL,
  contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  field_key   TEXT NOT NULL,
  value       TEXT NOT NULL,
  is_current  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  modified_at TEXT NOT NULL
);`;

export const CREATE_CURRENT_STATE_CURRENT_INDEX = `
CREATE UNIQUE INDEX idx_current_state_current
  ON current_state_entries(contact_id, field_key)
  WHERE is_current = 1;`;

export const CREATE_MEMORIES_CONTACT_DELETED_INDEX = `
CREATE INDEX idx_memories_contact_deleted
  ON memories(contact_id, deleted_at, id);`;

export const CREATE_RELATIONSHIPS_CONTACT_DELETED_INDEX = `
CREATE INDEX idx_relationships_contact_deleted
  ON relationships(contact_id, deleted_at, id);`;

export const CREATE_CURRENT_STATE_HISTORY_INDEX = `
CREATE INDEX idx_current_state_history
  ON current_state_entries(contact_id, field_key);`;

export const migration016: Migration = {
  version: 16,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(CREATE_MEMORIES);
    await exec.execAsync(CREATE_RELATIONSHIPS);
    await exec.execAsync(CREATE_CURRENT_STATE_ENTRIES);
    await exec.execAsync(CREATE_CURRENT_STATE_CURRENT_INDEX);
    await exec.execAsync(CREATE_MEMORIES_CONTACT_DELETED_INDEX);
    await exec.execAsync(CREATE_RELATIONSHIPS_CONTACT_DELETED_INDEX);
    await exec.execAsync(CREATE_CURRENT_STATE_HISTORY_INDEX);
  },
};
