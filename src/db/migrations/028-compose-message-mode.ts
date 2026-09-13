import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

/**
 * Migration 028 — durable Compose default message mode preference (COMP-02).
 *
 * Head+1 VERIFIED on disk at author time: migration 027 is the latest registered
 * step (TARGET_VERSION = DEFAULT_INTERACTION_CHANNEL_SCHEMA_VERSION = 27), so this
 * is 28. This forward-only, additive step is app_settings-ONLY — it does NOT touch
 * the shared interaction-history table (whose channel vocabulary was already
 * migrated at 025; a second write against that table would be a double-migration
 * hazard, D-03). It exactly mirrors migration 027's remember-sentinel template.
 *
 * Two columns seed the Compose default message mode, both NOT NULL so no
 * empty/null state ever exists on the singleton settings row:
 *   - default_message_mode: the chosen preference. Factory default 'remember'
 *     (Remember Last Choice); the 'remember' sentinel reads
 *     remembered_message_mode at compose time, while a fixed selection is stored
 *     as its own mode literal. CHECK-constrained to the frozen vocabulary
 *     ('remember','text','email').
 *   - remembered_message_mode: the last chosen concrete compose mode. Always a
 *     concrete mode ('text' or 'email'), never 'remember'. NO CHECK constraint —
 *     the DAO's assertMessageMode guards writes. First-use fallback 'text'.
 *
 * Backup portability for these columns is DECLARE-ONLY this phase — no
 * BACKUP_FORMAT_VERSION bump (D-03; Phase 36 owns emission + the bump).
 */
export const COMPOSE_MESSAGE_MODE_SCHEMA_VERSION = 28;

export const migration028: Migration = {
  version: COMPOSE_MESSAGE_MODE_SCHEMA_VERSION,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      ALTER TABLE app_settings
        ADD COLUMN default_message_mode TEXT NOT NULL DEFAULT 'remember'
          CHECK(default_message_mode IN ('remember','text','email'));

      ALTER TABLE app_settings
        ADD COLUMN remembered_message_mode TEXT NOT NULL DEFAULT 'text';
    `);
  },
};
