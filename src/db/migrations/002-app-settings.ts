/**
 * Migration 2 — the app_settings table (NOTIF-05 / OQ-1).
 *
 * The FIRST additive, forward-only migration since the irreversible initial
 * schema (001). It creates the single-row `app_settings` table and seeds the
 * decided notification defaults. Per the CLAUDE.md data-layer rules this
 * migration is IRREVERSIBLE-SAFE by construction:
 *   - it is purely ADDITIVE — it creates a NEW table and edits NO shipped one;
 *   - migration 001 is byte-unchanged (never edit a shipped migration);
 *   - every column is NOT NULL with a sensible DEFAULT, and the seed row is
 *     inserted in the SAME per-step transaction (the runner wraps each step),
 *     so a device jumping v0->v2 or v1->v2 lands on the seeded defaults with no
 *     partial state possible.
 *
 * Storage is SQLite precisely so Phase 16 backup exports these settings by
 * table (owner decision OQ-1) — the AsyncStorage theme/dashboard-prefs pattern
 * is deliberately NOT used for notification settings.
 *
 * The DEFAULTS (11-CONTEXT owner reversals):
 *   - notifications_enabled = 0  — master OFF until the user opts in at the
 *     value moment (NOTIF-05);
 *   - decay_enabled = 1, birthday_enabled = 1 — the per-type toggles are ON,
 *     gated by the master switch;
 *   - lockscreen_public = 0 — lock-screen previews PRIVATE by default (OQ-2 /
 *     UI-SPEC default off);
 *   - delivery_hour = 9 — 9am delivery;
 *   - quiet_start_hour = 21, quiet_end_hour = 8 — 21:00->08:00 quiet window.
 *
 * Single-row invariant: `id INTEGER PRIMARY KEY CHECK (id = 1)` mirrors the
 * profile table idiom (001-initial). This module imports no expo-sqlite — it
 * operates on the injected `SqlExecutor`. Every seed value is bound with `?`;
 * only the runner's integer `user_version` bump is interpolated (runner.ts).
 */
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

// --- Table DDL ---------------------------------------------------------------

export const CREATE_APP_SETTINGS = `
CREATE TABLE app_settings (
  id                    INTEGER PRIMARY KEY CHECK (id = 1),
  notifications_enabled INTEGER NOT NULL DEFAULT 0,
  decay_enabled         INTEGER NOT NULL DEFAULT 1,
  birthday_enabled      INTEGER NOT NULL DEFAULT 1,
  lockscreen_public     INTEGER NOT NULL DEFAULT 0,
  delivery_hour         INTEGER NOT NULL DEFAULT 9,
  quiet_start_hour      INTEGER NOT NULL DEFAULT 21,
  quiet_end_hour        INTEGER NOT NULL DEFAULT 8,
  created_at            TEXT NOT NULL,
  modified_at           TEXT NOT NULL
);`;

/**
 * Migration 2 — creates `app_settings` and seeds the single id=1 row with the
 * decided notification defaults. Runs inside the runner's per-step transaction;
 * the DDL and seed commit atomically with the `user_version` bump.
 */
export const migration002: Migration = {
  version: 2,
  async apply(exec: SqlExecutor, deps: MigrationDeps): Promise<void> {
    await exec.execAsync(CREATE_APP_SETTINGS);

    // Seed the single settings row (id=1) with the decided defaults. Every
    // value bound with `?`; created_at/modified_at come from the injected `now`.
    await exec.runAsync(
      `INSERT INTO app_settings (
         id,
         notifications_enabled,
         decay_enabled,
         birthday_enabled,
         lockscreen_public,
         delivery_hour,
         quiet_start_hour,
         quiet_end_hour,
         created_at,
         modified_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [1, 0, 1, 1, 0, 9, 21, 8, deps.now, deps.now],
    );
  },
};
