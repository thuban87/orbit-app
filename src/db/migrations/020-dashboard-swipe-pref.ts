import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

/**
 * Migration 020 — durable Dashboard right-swipe action preference (LISTV-08).
 *
 * This additive, forward-only step seeds the existing singleton settings row
 * through SQLite's NOT NULL default on every version-to-20 upgrade.
 */
export const migration020: Migration = {
  version: 20,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      ALTER TABLE app_settings
        ADD COLUMN dashboard_right_swipe_action TEXT NOT NULL DEFAULT 'quick-log'
          CHECK(dashboard_right_swipe_action IN ('quick-log','log-contact'));
    `);
  },
};
