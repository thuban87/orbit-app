import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

/**
 * Migration 026 — durable Group Event parent/linkage schema (GRP-01).
 *
 * Head+1 VERIFIED on disk at author time: migration 025 is the latest
 * registered step. This forward-only, additive migration is intentionally
 * limited to the approved Group Event shape: Channel, Tone, and Duration are
 * the only event-owned inheritable values. Direction and Connected remain
 * participant-owned child values.
 */
export const GROUP_EVENTS_SCHEMA_VERSION = 26;

export const migration026: Migration = {
  version: GROUP_EVENTS_SCHEMA_VERSION,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      CREATE TABLE group_events (
        id INTEGER PRIMARY KEY,
        uid TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        channel TEXT,
        quality TEXT,
        duration INTEGER,
        group_note TEXT,
        created_at TEXT NOT NULL,
        modified_at TEXT NOT NULL
      );

      ALTER TABLE interactions
        ADD COLUMN group_event_id INTEGER REFERENCES group_events(id) ON DELETE SET NULL;
      ALTER TABLE interactions ADD COLUMN ge_follow_channel INTEGER;
      ALTER TABLE interactions ADD COLUMN ge_follow_quality INTEGER;
      ALTER TABLE interactions ADD COLUMN ge_follow_duration INTEGER;

      CREATE UNIQUE INDEX idx_group_member_unique
        ON interactions(group_event_id, contact_id)
        WHERE group_event_id IS NOT NULL;
    `);
  },
};
