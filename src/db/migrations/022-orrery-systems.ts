/**
 * Migration 022 — durable Orrery System definitions, rules, overrides, and
 * cross-kind preferences. The runner owns this step's transaction.
 */
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

export const CREATE_SYSTEMS = `
CREATE TABLE systems (
  id          INTEGER PRIMARY KEY,
  uid         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  modified_at TEXT NOT NULL
);`;

export const CREATE_SYSTEMS_NAME_NOCASE_INDEX = `
CREATE UNIQUE INDEX idx_systems_name_nocase ON systems(name COLLATE NOCASE);`;

export const CREATE_SYSTEM_RULES = `
CREATE TABLE system_rules (
  id         INTEGER PRIMARY KEY,
  uid        TEXT NOT NULL UNIQUE,
  system_id  INTEGER NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  family     TEXT NOT NULL,
  value      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(system_id, family, value)
);`;

export const CREATE_SYSTEM_RULES_SYSTEM_INDEX = `
CREATE INDEX idx_system_rules_system_id ON system_rules(system_id);`;

export const CREATE_SYSTEM_OVERRIDES = `
CREATE TABLE system_overrides (
  id          INTEGER PRIMARY KEY,
  uid         TEXT NOT NULL UNIQUE,
  system_ref  TEXT NOT NULL,
  contact_id  INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  mode        TEXT NOT NULL CHECK(mode IN ('include', 'exclude')),
  created_at  TEXT NOT NULL,
  UNIQUE(system_ref, contact_id)
);`;

export const CREATE_SYSTEM_OVERRIDES_REF_INDEX = `
CREATE INDEX idx_system_overrides_system_ref ON system_overrides(system_ref);`;

export const CREATE_SYSTEM_PREFS = `
CREATE TABLE system_prefs (
  id            INTEGER PRIMARY KEY,
  uid           TEXT NOT NULL UNIQUE,
  system_ref    TEXT NOT NULL UNIQUE,
  display_order INTEGER,
  hidden        INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0, 1)),
  created_at    TEXT NOT NULL,
  modified_at   TEXT NOT NULL
);`;

export const migration022: Migration = {
  version: 22,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(CREATE_SYSTEMS);
    await exec.execAsync(CREATE_SYSTEMS_NAME_NOCASE_INDEX);
    await exec.execAsync(CREATE_SYSTEM_RULES);
    await exec.execAsync(CREATE_SYSTEM_RULES_SYSTEM_INDEX);
    await exec.execAsync(CREATE_SYSTEM_OVERRIDES);
    await exec.execAsync(CREATE_SYSTEM_OVERRIDES_REF_INDEX);
    await exec.execAsync(CREATE_SYSTEM_PREFS);
  },
};
