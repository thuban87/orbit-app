import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

/** Durable local pending-handoff state for Interaction Assist. */
export const migration014: Migration = {
  version: 14,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      CREATE TABLE interaction_assists (
        id INTEGER PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        channel TEXT NOT NULL CHECK(channel IN ('call', 'text', 'email')),
        endpoint_value TEXT,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK(status IN ('pending', 'logged', 'dismissed', 'expired', 'failed')),
        handoff_at TEXT NOT NULL,
        resolved_at TEXT,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL
      );

      CREATE INDEX idx_interaction_assists_pending
        ON interaction_assists (status, created_at DESC);

      ALTER TABLE app_settings
        ADD COLUMN interaction_assist_enabled INTEGER NOT NULL DEFAULT 1;
    `);
  },
};
