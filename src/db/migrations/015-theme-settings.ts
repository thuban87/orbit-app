import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

/**
 * Migration 015 — durable theme settings columns (THEME-01/03/13, D-08/D-10).
 *
 * The theme selection retires from the AsyncStorage `orbit-theme` key to durable
 * `app_settings` columns that survive backup (per-package memory: each package
 * remembers its own appearance mode, accent, and background). Head+1 VERIFIED on
 * disk at plan time: `TARGET_VERSION` was 14 and the latest migration was 014, so
 * this is 015 (never assume a migration number — it drifts every schema phase).
 *
 * IRREVERSIBLE-SAFE by construction, like every migration since 002:
 *   - purely ADDITIVE — seven `ALTER TABLE app_settings ADD COLUMN`s, edits no
 *     shipped table and no shipped migration (001-014 are byte-unchanged);
 *   - forward-only — a device jumping v0->v15 in one launch lands fully seeded;
 *   - the package + mode columns are `NOT NULL DEFAULT` with a `CHECK`, so a
 *     fresh install is Galaxy + Follow-System with no code branch (THEME-01
 *     empty edge); the accent/background columns are nullable TEXT holding an
 *     option-ID (NULL = package default resolved at RENDER — the self_sun_colour
 *     idiom), so NO colour hex ever enters the schema (a `#RRGGBB` default would
 *     trip `check:colors`, which scans migrations; ADR-001 storage-vs-render).
 *
 * Runs inside the runner's per-step transaction; the DDL commits atomically with
 * the `user_version` bump. Imports no expo-sqlite — operates on the injected
 * `SqlExecutor`. Purely structural, so `deps` is unused.
 */
export const migration015: Migration = {
  version: 15,
  async apply(exec: SqlExecutor, _deps: MigrationDeps): Promise<void> {
    await exec.execAsync(`
      ALTER TABLE app_settings
        ADD COLUMN theme_package TEXT NOT NULL DEFAULT 'galaxy'
          CHECK(theme_package IN ('galaxy', 'standard'));

      ALTER TABLE app_settings
        ADD COLUMN galaxy_mode TEXT NOT NULL DEFAULT 'system'
          CHECK(galaxy_mode IN ('light', 'dark', 'system'));

      ALTER TABLE app_settings
        ADD COLUMN standard_mode TEXT NOT NULL DEFAULT 'system'
          CHECK(standard_mode IN ('light', 'dark', 'system'));

      ALTER TABLE app_settings ADD COLUMN galaxy_accent TEXT;
      ALTER TABLE app_settings ADD COLUMN standard_accent TEXT;
      ALTER TABLE app_settings ADD COLUMN galaxy_background TEXT;
      ALTER TABLE app_settings ADD COLUMN standard_background TEXT;
    `);
  },
};
