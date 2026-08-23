/**
 * Migration 5 — the weekly-digest ON/OFF toggle column (Phase 15, DGST-01).
 *
 * Widens the single-row `app_settings` table with the durable, backup-exportable
 * home for the weekly-digest master toggle. This is the OWNER RULING recorded in
 * 15-CONTEXT.md §Persistence: the digest's "no new schema" promise means no new
 * TABLES and no new PER-CONTACT state — the digest stays a pure read surface that
 * stores nothing per contact. A single global settings column is the toggle's
 * proper home and is consistent with how every prior toggle shipped
 * (decay_enabled / birthday_enabled in migration 002, the ai_* columns in
 * migration 004). Removing or weakening this migration would REVERSE a recorded
 * owner decision — escalate, never "bug-fix" it away.
 *
 * Per the CLAUDE.md data-layer rules this migration is IRREVERSIBLE-SAFE by
 * construction:
 *   - it is purely ADDITIVE — one `ALTER TABLE app_settings ADD COLUMN`
 *     statement, editing NO shipped table's DDL;
 *   - migrations 001/002/003/004 are byte-unchanged (never edit a shipped
 *     migration);
 *   - the new column is NOT NULL with a CONSTANT DEFAULT, so `ADD COLUMN` is
 *     legal in SQLite and the step is starting-state-independent (a device may
 *     jump v0->v5 or v4->v5 and land identically). The runner wraps the step
 *     atomically with its `user_version` bump — this module opens no transaction.
 *
 * The column:
 *   - `digest_enabled INTEGER NOT NULL DEFAULT 1` — the weekly digest is ON by
 *     default (DGST-01: "defaults on, independently toggleable"). A durable OFF
 *     that the launch sweep cannot re-enable requires this persisted flag
 *     (RESEARCH Pitfall 1). Stored 0/1, gated by the notifications master switch.
 *
 * Imports no expo-sqlite — it operates on the injected `SqlExecutor`. No runtime
 * value is bound or interpolated; the DDL string is a closed constant.
 */
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

// --- Column DDL --------------------------------------------------------------

/** Weekly-digest master toggle. `1` (default) = digest ON; `0` = durable OFF. */
export const ADD_DIGEST_ENABLED = `
ALTER TABLE app_settings
  ADD COLUMN digest_enabled INTEGER NOT NULL DEFAULT 1;`;

/**
 * Migration 5 — widens `app_settings` with the `digest_enabled` toggle column.
 * Runs inside the runner's per-step transaction; the `ADD COLUMN` commits
 * atomically with the `user_version` bump. `deps` is unused — this step adds a
 * single column with a constant default and seeds nothing.
 */
export const migration005: Migration = {
  version: 5,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(ADD_DIGEST_ENABLED);
  },
};
