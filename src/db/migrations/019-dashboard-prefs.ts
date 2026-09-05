import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

/**
 * Migration 019 — durable dashboard query preferences (DASHQ-11/13).
 *
 * Head+1 VERIFIED on disk at plan time: migration 018 was the latest registered
 * step and TARGET_VERSION was 18. This additive, forward-only step runs inside
 * the migration runner transaction; defaults seed the singleton existing row.
 */
export const migration019: Migration = {
  version: 19,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      ALTER TABLE app_settings
        ADD COLUMN dashboard_view_mode TEXT NOT NULL DEFAULT 'list'
          CHECK(dashboard_view_mode IN ('list', 'card'));

      ALTER TABLE app_settings
        ADD COLUMN dashboard_populations TEXT NOT NULL DEFAULT '[]';

      ALTER TABLE app_settings
        ADD COLUMN dashboard_filters TEXT NOT NULL DEFAULT '{}';

      ALTER TABLE app_settings
        ADD COLUMN dashboard_sort TEXT NOT NULL DEFAULT 'default'
          CHECK(dashboard_sort IN ('default', 'name-asc', 'name-desc', 'least-recent', 'most-recent', 'status'));
    `);
  },
};
