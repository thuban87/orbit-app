import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

export const RESTORE_BACKGROUND_JOURNAL_SCHEMA_VERSION = 30;

/** Durable commit evidence for restore-staged profile background bytes. */
export const migration030: Migration = {
  version: RESTORE_BACKGROUND_JOURNAL_SCHEMA_VERSION,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      CREATE TABLE restore_background_journal (
        relative_path TEXT PRIMARY KEY,
        template_uid TEXT NOT NULL,
        template_modified_at TEXT NOT NULL,
        canonical_relative_path TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  },
};
