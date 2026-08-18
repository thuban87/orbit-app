/**
 * Migration 3 — the orrery sun columns (ORR-05 / ORR-06).
 *
 * The FIRST schema change since migration 002. It widens the single-row
 * `app_settings` table with the two app-level sun controls the orrery needs a
 * persistent home for. Per the CLAUDE.md data-layer rules this migration is
 * IRREVERSIBLE-SAFE by construction:
 *   - it is purely ADDITIVE — two `ALTER TABLE app_settings ADD COLUMN`
 *     statements, editing NO shipped table's DDL;
 *   - migrations 001/002 are byte-unchanged (never edit a shipped migration);
 *   - both new columns are NULLABLE with NO non-null default, which is what
 *     keeps `ADD COLUMN` legal in SQLite even with a `REFERENCES` clause AND
 *     makes the step starting-state-independent (a device may jump v0->v3 or
 *     v2->v3 and land identically). The runner wraps each step atomically with
 *     its `user_version` bump — this module opens NO transaction of its own.
 *
 * The two columns:
 *   - `sun_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL`
 *     — who is the sun; NULL = self. The FK action makes a hard-purged
 *     sun-contact AUTO-REVERT to self (A1) — proven by the migration test's L7
 *     assign->DELETE->read-back-NULL case under `foreign_keys=ON`.
 *   - `self_sun_colour TEXT` — the user's own star colour; NULL = unresolved,
 *     resolved to `starPalette[0]` at READ time (never here). NO hex literal
 *     default is stored (Pitfall 3) so the palette stays single-sourced.
 *
 * This module imports no expo-sqlite — it operates on the injected
 * `SqlExecutor`. No runtime value is bound or interpolated; the two DDL
 * strings are closed constants.
 */
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

// --- Column DDL --------------------------------------------------------------

/**
 * Who is the sun. NULL = self. `ON DELETE SET NULL` reverts a hard-purged
 * sun-contact to self (A1) instead of leaving a dangling id.
 */
export const ADD_SUN_CONTACT_ID = `
ALTER TABLE app_settings
  ADD COLUMN sun_contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL;`;

/**
 * The user's own star colour. NULL = unresolved (resolved to `starPalette[0]`
 * at read). Stored as TEXT; NO hex literal default (Pitfall 3).
 */
export const ADD_SELF_SUN_COLOUR = `
ALTER TABLE app_settings
  ADD COLUMN self_sun_colour TEXT;`;

/**
 * Migration 3 — widens `app_settings` with the two nullable sun columns. Runs
 * inside the runner's per-step transaction; both `ADD COLUMN`s commit
 * atomically with the `user_version` bump. `deps` is unused — this step adds
 * columns only, seeds nothing.
 */
export const migration003: Migration = {
  version: 3,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(ADD_SUN_CONTACT_ID);
    await exec.execAsync(ADD_SELF_SUN_COLOUR);
  },
};
