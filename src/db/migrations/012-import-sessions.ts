import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

/**
 * Durable, local-only snapshots of Android system-contact imports.
 *
 * These tables deliberately contain a payload snapshot and app-owned staged
 * photo paths rather than any picker content URI. They are not backup data:
 * Replace-all restore deletes them and the export manifest never includes them.
 */
export const migration012: Migration = {
  version: 12,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      CREATE TABLE import_sessions (
        id INTEGER PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        mode TEXT NOT NULL CHECK (mode IN ('single', 'bulk')),
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'complete', 'discarded')),
        batch_category_id INTEGER REFERENCES categories(id),
        batch_tracking_enabled INTEGER NOT NULL DEFAULT 0
          CHECK (batch_tracking_enabled IN (0, 1)),
        phone_region TEXT,
        total_rows INTEGER NOT NULL DEFAULT 0
          CHECK (typeof(total_rows) = 'integer' AND total_rows >= 0),
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL
      );

      CREATE TABLE import_session_rows (
        id INTEGER PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        session_id INTEGER NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
        external_contact_id TEXT NOT NULL,
        source_payload TEXT NOT NULL,
        photo_rel_path TEXT,
        row_status TEXT NOT NULL DEFAULT 'pending'
          CHECK (row_status IN ('pending', 'imported', 'linked', 'skipped', 'failed', 'needs_review')),
        match_outcome TEXT
          CHECK (match_outcome IS NULL OR match_outcome IN ('already_linked', 'probable', 'possible', 'new', 'needs_review')),
        matched_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        candidates_json TEXT,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
        failure_reason TEXT,
        photo_failed INTEGER NOT NULL DEFAULT 0 CHECK (photo_failed IN (0, 1)),
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL,
        UNIQUE(session_id, external_contact_id)
      );

      CREATE INDEX idx_import_session_rows_session
        ON import_session_rows (session_id, row_status);
      CREATE INDEX idx_import_sessions_status ON import_sessions (status);
    `);
  },
};
