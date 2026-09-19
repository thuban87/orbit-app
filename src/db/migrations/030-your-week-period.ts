import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

/** Additive durable preference for the Phase-38 Your Week period. */
export const YOUR_WEEK_PERIOD_SCHEMA_VERSION = 30;

export const migration030: Migration = {
  version: YOUR_WEEK_PERIOD_SCHEMA_VERSION,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      ALTER TABLE app_settings
        ADD COLUMN your_week_period TEXT NOT NULL DEFAULT 'rolling7'
          CHECK(your_week_period IN ('rolling7','calendar_week'));
    `);
  },
};
