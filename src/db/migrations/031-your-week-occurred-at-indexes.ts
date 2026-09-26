/**
 * Migration 031 — Your Week `occurred_at` indexes (38.4 RG-028,
 * `performance/AUD-PERF-004`, D-18).
 *
 * Adds single-column `occurred_at` indexes on `interactions` and
 * `group_events` so the Your Week reads (`src/db/your-week-read.ts`) can SEARCH
 * the requested period with a half-open range instead of scanning lifetime
 * history on every Digest open.
 *
 * Purely additive and forward-only: no row is read, rewritten, or repaired, and
 * no stored `occurred_at` value changes (38.2 D-23 — no legacy repair). The DDL
 * is plain `CREATE INDEX` with no existence guard: the runner applies each
 * version exactly once inside its own transaction, and a failure must be loud
 * and roll back rather than silently skip. Indexes are not portable data, so
 * the backup format does not change.
 */
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

/** Schema version that adds the Your Week `occurred_at` indexes. */
export const YOUR_WEEK_INDEX_SCHEMA_VERSION = 31;

export const migration031: Migration = {
  version: YOUR_WEEK_INDEX_SCHEMA_VERSION,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      CREATE INDEX idx_interactions_occurred_at ON interactions(occurred_at);
      CREATE INDEX idx_group_events_occurred_at ON group_events(occurred_at);
    `);
  },
};
