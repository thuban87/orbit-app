import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

/** Durable local reconciliation state for the contact-import merge workflow. */
export const migration013: Migration = {
  version: 13,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      CREATE TABLE reconciliation_sessions (
        id INTEGER PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'complete', 'discarded')),
        total_checked INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL
      );

      CREATE TABLE reconciliation_session_cards (
        id INTEGER PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        session_id INTEGER NOT NULL REFERENCES reconciliation_sessions(id) ON DELETE CASCADE,
        contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        card_status TEXT NOT NULL DEFAULT 'unresolved'
          CHECK (card_status IN ('unresolved', 'partial', 'resolved', 'missing_source')),
        diff_json TEXT NOT NULL,
        unresolved_count INTEGER NOT NULL DEFAULT 0,
        staged_photo_rel_path TEXT,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL,
        UNIQUE(session_id, contact_id)
      );

      CREATE TABLE reconcile_source_snapshot (
        id INTEGER PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        external_contact_link_id INTEGER NOT NULL REFERENCES external_contact_links(id) ON DELETE CASCADE,
        field_family TEXT NOT NULL CHECK (field_family IN ('name', 'phones', 'emails', 'birthday', 'photo')),
        reviewed_value TEXT,
        reviewed_at TEXT NOT NULL,
        UNIQUE(external_contact_link_id, field_family)
      );

      CREATE TABLE bulk_review_resolutions (
        id INTEGER PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        import_session_row_id INTEGER NOT NULL REFERENCES import_session_rows(id) ON DELETE CASCADE,
        flag_type TEXT NOT NULL CHECK (flag_type IN ('birthday')),
        resolution TEXT NOT NULL CHECK (resolution IN ('fixed', 'ignored')),
        resolved_at TEXT NOT NULL,
        UNIQUE(import_session_row_id, flag_type)
      );

      CREATE INDEX idx_reconciliation_sessions_status
        ON reconciliation_sessions (status);
    `);
  },
};
