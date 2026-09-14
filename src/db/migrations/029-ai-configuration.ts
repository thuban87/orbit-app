import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

/**
 * Migration 029 — durable AI configuration skeleton (AICFG-01/02/03/05).
 *
 * Head+1 VERIFIED on disk at author time: migration 028 is the latest registered
 * step. This forward-only, irreversible production migration is additive only:
 * it widens the singleton app_settings row and creates two new non-secret tables.
 * Credentials remain exclusively in SecureStore (ADR-049). The active pointer
 * stores a connection lane, never a row id, so it remains stable across restore.
 *
 * ADR-079 retired the per-provider acknowledgement gate. The owner selected the
 * no-dead-column branch, so this migration deliberately omits ai_ack_openrouter.
 */
export const AI_CONFIGURATION_SCHEMA_VERSION = 29;

export const migration029: Migration = {
  version: AI_CONFIGURATION_SCHEMA_VERSION,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      ALTER TABLE app_settings
        ADD COLUMN ai_enabled INTEGER NOT NULL DEFAULT 0
          CHECK(ai_enabled IN (0,1));
      ALTER TABLE app_settings
        ADD COLUMN ai_active_connection TEXT NOT NULL DEFAULT '';
      ALTER TABLE app_settings
        ADD COLUMN ai_first_use_disclosed INTEGER NOT NULL DEFAULT 0
          CHECK(ai_first_use_disclosed IN (0,1));

      ALTER TABLE app_settings
        ADD COLUMN ai_writing_tone TEXT NOT NULL DEFAULT 'balanced'
          CHECK(ai_writing_tone IN ('casual','balanced','polished','custom'));
      ALTER TABLE app_settings
        ADD COLUMN ai_writing_length TEXT NOT NULL DEFAULT 'normal'
          CHECK(ai_writing_length IN ('concise','normal','detailed','custom'));
      ALTER TABLE app_settings
        ADD COLUMN ai_writing_directness TEXT NOT NULL DEFAULT 'balanced'
          CHECK(ai_writing_directness IN ('gentle','balanced','direct','custom'));
      ALTER TABLE app_settings
        ADD COLUMN ai_writing_freeform TEXT NOT NULL DEFAULT '';

      ALTER TABLE app_settings
        ADD COLUMN ai_default_memory_allow INTEGER NOT NULL DEFAULT 0
          CHECK(ai_default_memory_allow IN (0,1));
      ALTER TABLE app_settings
        ADD COLUMN ai_default_interaction_note_allow INTEGER NOT NULL DEFAULT 0
          CHECK(ai_default_interaction_note_allow IN (0,1));
      ALTER TABLE app_settings
        ADD COLUMN ai_default_custom_field_share INTEGER NOT NULL DEFAULT 0
          CHECK(ai_default_custom_field_share IN (0,1));

      CREATE TABLE ai_connections (
        id INTEGER PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        lane TEXT NOT NULL
          CHECK(lane IN ('openrouter','openai','anthropic','google','custom')),
        remembered_model TEXT NOT NULL DEFAULT '',
        custom_endpoint TEXT NOT NULL DEFAULT '',
        custom_model TEXT NOT NULL DEFAULT '',
        configured_at TEXT,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL,
        UNIQUE(lane)
      );

      CREATE TABLE personalization_sections (
        id INTEGER PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL
      );
    `);
  },
};
