import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

export const CREATE_RESTORE_PHOTO_JOURNAL = `
CREATE TABLE restore_photo_journal (
  id INTEGER PRIMARY KEY,
  relative_path TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL CHECK(action IN ('finalize', 'delete')),
  target_kind TEXT NOT NULL CHECK(target_kind IN ('contact', 'profile', 'customField')),
  contact_uid TEXT,
  value_uid TEXT,
  field_def_uid TEXT,
  canonical_relative_path TEXT NOT NULL,
  created_at TEXT NOT NULL
);`;

/** Durable recovery evidence for post-commit restore photo writes. */
export const migration008: Migration = {
  version: 8,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(CREATE_RESTORE_PHOTO_JOURNAL);
  },
};
