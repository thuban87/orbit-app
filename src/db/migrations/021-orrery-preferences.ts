import type { Migration } from "@/db/types";

/** Phase 29 D-03/D-06: independent additive step; runner owns the transaction.
 * SQL enforces defaults and basic shape. DAO/core enforce the complete closed
 * builtin/category-UID grammar. No existence FK: stale Systems resolve on read.
 * Camera and focus deliberately have no durable representation (D-07).
 */
export const migration021: Migration = {
  version: 21,
  async apply(exec) {
    await exec.execAsync(`
      ALTER TABLE app_settings ADD COLUMN orrery_density TEXT NOT NULL DEFAULT 'balanced'
        CHECK(orrery_density IN ('spacious', 'balanced', 'compact'));
      ALTER TABLE app_settings ADD COLUMN orrery_satellites_enabled INTEGER NOT NULL DEFAULT 0
        CHECK(orrery_satellites_enabled IN (0, 1));
      ALTER TABLE app_settings ADD COLUMN orrery_last_system TEXT NOT NULL DEFAULT 'builtin:all-contacts'
        CHECK(length(orrery_last_system) BETWEEN 9 AND 265);
    `);
  },
};
