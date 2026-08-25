/**
 * Migration 007 — durable deletion evidence and a non-timestamp change signal.
 *
 * This is deliberately forward-only. Tombstones are retained indefinitely and
 * the reserved UIDs make the singleton profile and seeded categories stable
 * across installations before their rows are ever exported.
 */
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

export const RESERVED_PROFILE_UID = "00000000-0000-4000-8000-000000000001";

/** Stable identities for migration001's four seeded categories, by display order. */
export const RESERVED_CATEGORY_UIDS: Readonly<Record<number, string>> = {
  0: "00000000-0000-4000-8000-000000000101",
  1: "00000000-0000-4000-8000-000000000102",
  2: "00000000-0000-4000-8000-000000000103",
  3: "00000000-0000-4000-8000-000000000104",
};

export const CREATE_TOMBSTONES = `
CREATE TABLE tombstones (
  id          INTEGER PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_uid  TEXT NOT NULL,
  deleted_at  TEXT NOT NULL,
  UNIQUE(entity_type, entity_uid)
);`;

export const ADD_DATA_REVISION = `
ALTER TABLE app_settings
  ADD COLUMN data_revision INTEGER NOT NULL DEFAULT 0;`;

export const migration007: Migration = {
  version: 7,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(CREATE_TOMBSTONES);
    await exec.execAsync(ADD_DATA_REVISION);
    await exec.runAsync("UPDATE profile SET uid = ? WHERE id = 1", [
      RESERVED_PROFILE_UID,
    ]);
    for (const [displayOrder, uid] of Object.entries(RESERVED_CATEGORY_UIDS)) {
      await exec.runAsync(
        "UPDATE categories SET uid = ? WHERE display_order = ?",
        [uid, Number(displayOrder)],
      );
    }
  },
};
