import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

/**
 * Migration 027 — durable Default Interaction Channel preference (CAPT-11).
 *
 * Head+1 VERIFIED on disk at author time: migration 026 is the latest
 * registered step (TARGET_VERSION = GROUP_EVENTS_SCHEMA_VERSION = 26), so this
 * is 27. This forward-only, additive step is app_settings-ONLY — it does NOT
 * touch the shared `interactions` table (its channel vocabulary was already
 * migrated by migration 025; a second interactions UPDATE would be a
 * double-migration hazard, D-07).
 *
 * Two columns seed the ordinary-logging channel default, both NOT NULL so no
 * empty/null state ever exists on the singleton settings row:
 *   - default_interaction_channel: the chosen preference. Factory default
 *     'remember' (Remember Last Choice, dossier §P); the 'remember' sentinel
 *     reads remembered_interaction_channel at use time, while a fixed selection
 *     is stored as its own channel literal. The CHECK vocabulary MUST match the
 *     stored channel literals migration 025 wrote (Message/Call/In Person),
 *     plus the 'remember' sentinel (D-06 frozen vocabulary).
 *   - remembered_interaction_channel: the last successful ordinary-save channel.
 *     Always a concrete channel, never 'remember'. First-use fallback Message
 *     (dossier §P derived, D-13-093).
 *
 * Backup portability for these columns is DECLARE-ONLY this phase — no
 * BACKUP_FORMAT_VERSION bump (D-03; Phase 36 owns emission).
 */
export const DEFAULT_INTERACTION_CHANNEL_SCHEMA_VERSION = 27;

export const migration027: Migration = {
  version: DEFAULT_INTERACTION_CHANNEL_SCHEMA_VERSION,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      ALTER TABLE app_settings
        ADD COLUMN default_interaction_channel TEXT NOT NULL DEFAULT 'remember'
          CHECK(default_interaction_channel IN ('remember','Message','Call','In Person'));

      ALTER TABLE app_settings
        ADD COLUMN remembered_interaction_channel TEXT NOT NULL DEFAULT 'Message';
    `);
  },
};
