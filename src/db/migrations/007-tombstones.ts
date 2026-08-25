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

/** User-configurable automatic-backup interval. Bounded by the DAO on write. */
export const ADD_BACKUP_INTERVAL_DAYS = `
ALTER TABLE app_settings
  ADD COLUMN backup_interval_days INTEGER NOT NULL DEFAULT 1;`;

/** User-configurable automatic-backup retention. Bounded by the DAO on write. */
export const ADD_BACKUP_RETENTION_DAYS = `
ALTER TABLE app_settings
  ADD COLUMN backup_retention_days INTEGER NOT NULL DEFAULT 7;`;

/** Device-local SAF destination metadata; never included in a portable backup. */
export const ADD_BACKUP_FOLDER_URI = `
ALTER TABLE app_settings
  ADD COLUMN backup_folder_uri TEXT;`;

export const ADD_BACKUP_FOLDER_NAME = `
ALTER TABLE app_settings
  ADD COLUMN backup_folder_name TEXT;`;

/** Last access failure detail, retained to diagnose a lost SAF destination. */
export const ADD_BACKUP_FOLDER_DIAGNOSTIC = `
ALTER TABLE app_settings
  ADD COLUMN backup_folder_diagnostic TEXT;`;

/** A verified automatic snapshot only; manual share exports never update this. */
export const ADD_LAST_AUTOMATIC_BACKUP_AT = `
ALTER TABLE app_settings
  ADD COLUMN last_automatic_backup_at TEXT;`;

/**
 * Snapshot of data_revision at the last verified automatic backup. This is an
 * integer rather than a timestamp so same-second edits cannot be missed.
 */
export const ADD_LAST_BACKUP_DATA_REVISION = `
ALTER TABLE app_settings
  ADD COLUMN last_backup_data_revision INTEGER NOT NULL DEFAULT 0;`;

/** True only while this device also has its passphrase cached in SecureStore. */
export const ADD_ENCRYPTION_ENABLED = `
ALTER TABLE app_settings
  ADD COLUMN encryption_enabled INTEGER NOT NULL DEFAULT 0;`;

/** Local dashboard-nudge dismissal, not portable relationship data. */
export const ADD_BACKUP_NUDGE_DISMISSED = `
ALTER TABLE app_settings
  ADD COLUMN backup_nudge_dismissed INTEGER NOT NULL DEFAULT 0;`;

export const migration007: Migration = {
  version: 7,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(CREATE_TOMBSTONES);
    await exec.execAsync(ADD_DATA_REVISION);
    await exec.execAsync(ADD_BACKUP_INTERVAL_DAYS);
    await exec.execAsync(ADD_BACKUP_RETENTION_DAYS);
    await exec.execAsync(ADD_BACKUP_FOLDER_URI);
    await exec.execAsync(ADD_BACKUP_FOLDER_NAME);
    await exec.execAsync(ADD_BACKUP_FOLDER_DIAGNOSTIC);
    await exec.execAsync(ADD_LAST_AUTOMATIC_BACKUP_AT);
    await exec.execAsync(ADD_LAST_BACKUP_DATA_REVISION);
    await exec.execAsync(ADD_ENCRYPTION_ENABLED);
    await exec.execAsync(ADD_BACKUP_NUDGE_DISMISSED);
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
