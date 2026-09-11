import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

/**
 * Migration 025 — interaction history data foundation (D-06 / D-07 / D-11 / HIST-14).
 *
 * Head+1 VERIFIED on disk at author time: `profilePresentationMigration`
 * (version 24 = PROFILE_PRESENTATION_SCHEMA_VERSION) was the latest registered
 * step and TARGET_VERSION was 24, so this additive, forward-only step is 25.
 *
 * This step is FORWARD-ONLY and IRREVERSIBLE on devices we cannot reach — owner
 * authorized (32-01 checkpoint, option `approved`). It:
 *   - ADDs `interactions.duration` (nullable INTEGER seconds; absent -> NULL,
 *     never 0) and `interactions.allow_ai` (`INTEGER NOT NULL DEFAULT 0
 *     CHECK(allow_ai IN (0,1))` — the durable AI-egress gate defaults OFF, D-04);
 *   - re-maps the stored `quality` VALUES to the Tone vocabulary and the stored
 *     `channel` VALUES to the three user-facing labels (D-06). The SQL COLUMN
 *     names stay `quality`/`channel` (values migrate, names do NOT — locked
 *     invariant so export-manifest / restore-apply keep round-tripping);
 *   - ADDs `app_settings.history_lens` (default 'cycles') and
 *     `history_cycle_count` (default 10) durable preferences (D-11).
 *
 * ALTER + UPDATE only — NO table rebuild, NO DROP, NO `note` rewrite, and NO
 * `group_event_id`/group-event schema (that is Phase 33's migration 026+; adding
 * it here would REVERSE D-07/D-12 — see the prohibition in 32-01-PLAN.md).
 *
 * The quality/channel CASE arms below are FROZEN literals inside this file. They
 * are DELIBERATELY not generated from `src/db/interaction-vocabulary.ts` at
 * runtime: the runner invokes this migration at upgrade time, so a shipped
 * migration must never depend on a mutable helper whose later edit would silently
 * alter shipped behavior (review cycle-2). `025-interaction-history-schema.test.ts`
 * pins these frozen outputs equal to `remapLegacyQuality`/`remapLegacyChannel`, so
 * the migration and the shared map cannot drift — yet the migration does not
 * import them.
 *
 * NULL `quality` is not coerced: `CASE quality WHEN 'good' ... ELSE quality END`
 * leaves a NULL untouched (NULL matches no WHEN and falls to `ELSE quality`).
 * `other`/`unspecified` likewise pass through unchanged.
 */
export const INTERACTION_HISTORY_SCHEMA_VERSION = 25;

export const migration025: Migration = {
  version: INTERACTION_HISTORY_SCHEMA_VERSION,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      ALTER TABLE interactions ADD COLUMN duration INTEGER;

      ALTER TABLE interactions
        ADD COLUMN allow_ai INTEGER NOT NULL DEFAULT 0 CHECK(allow_ai IN (0, 1));

      UPDATE interactions
         SET quality = CASE quality
           WHEN 'good' THEN 'Positive'
           WHEN 'fine' THEN 'Neutral'
           WHEN 'hard' THEN 'Negative'
           ELSE quality
         END;

      UPDATE interactions
         SET channel = CASE channel
           WHEN 'text' THEN 'Message'
           WHEN 'email' THEN 'Message'
           WHEN 'call' THEN 'Call'
           WHEN 'in-person' THEN 'In Person'
           ELSE channel
         END;

      ALTER TABLE app_settings
        ADD COLUMN history_lens TEXT NOT NULL DEFAULT 'cycles';

      ALTER TABLE app_settings
        ADD COLUMN history_cycle_count INTEGER NOT NULL DEFAULT 10;
    `);
  },
};
