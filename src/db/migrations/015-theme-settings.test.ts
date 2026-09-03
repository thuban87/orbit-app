/**
 * Migration 015 — durable theme settings columns (THEME-01/03/13) proof.
 *
 * The single-row `app_settings` table gains seven theme columns: `theme_package`
 * + per-package `galaxy_mode`/`standard_mode` (NOT NULL DEFAULT + CHECK) and the
 * nullable per-package `galaxy_accent`/`standard_accent`/`galaxy_background`/
 * `standard_background` (accent-id / slot-id, NULL = package default at render).
 * This suite proves, node-side via the node:sqlite adapter, that migration 015
 * is forward-only + additive:
 *   - a fresh v0 DB runs the whole chain and reaches v15 with all seven columns,
 *     the package + mode columns SEEDED (galaxy / system) and accent/background
 *     NULL (THEME-01 empty edge: first launch is Galaxy + Follow-System);
 *   - a seeded v14 DB gains EXACTLY the seven columns, reaching v15;
 *   - the CHECK constraints reject an out-of-enum package/mode;
 *   - re-running at v15 is an idempotent no-op (one row).
 *
 * Migrations 001-014 run UNCHANGED — 015 edits no shipped table.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

const NOW = "2026-09-03 12:00:00";
const LATER = "2026-09-03 13:30:00";

const THEME_COLUMNS = [
  "theme_package",
  "galaxy_mode",
  "standard_mode",
  "galaxy_accent",
  "standard_accent",
  "galaxy_background",
  "standard_background",
] as const;

let exec: SqlExecutor;

/** Apply the registered chain up to `target` (the real database-owned list). */
async function migrateTo(target: number, now = NOW): Promise<void> {
  await runMigrations(exec, MIGRATIONS, target, { now, newUid });
}

async function columnsOf(table: string): Promise<Set<string>> {
  const rows = await exec.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`,
  );
  return new Set(rows.map((r) => r.name));
}

beforeEach(() => {
  exec = nodeSqliteExecutor(openTestDb());
});

describe("migration 015 — theme settings columns (forward-only, additive)", () => {
  it("adds all seven theme columns and lands at v15 on a fresh v0->v15 run", async () => {
    await migrateTo(15);

    const version = await exec.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    expect(version?.user_version).toBe(15);

    const cols = await columnsOf("app_settings");
    for (const col of THEME_COLUMNS) {
      expect(cols.has(col)).toBe(true);
    }
  });

  it("seeds galaxy + system and leaves accent/background NULL (THEME-01 empty edge)", async () => {
    await migrateTo(15);
    const row = await exec.getFirstAsync<{
      theme_package: string;
      galaxy_mode: string;
      standard_mode: string;
      galaxy_accent: string | null;
      standard_accent: string | null;
      galaxy_background: string | null;
      standard_background: string | null;
    }>(
      `SELECT theme_package, galaxy_mode, standard_mode,
              galaxy_accent, standard_accent, galaxy_background, standard_background
         FROM app_settings WHERE id = 1`,
    );
    expect(row).toEqual({
      theme_package: "galaxy",
      galaxy_mode: "system",
      standard_mode: "system",
      galaxy_accent: null,
      standard_accent: null,
      galaxy_background: null,
      standard_background: null,
    });
  });

  it("upgrades an already-seeded v14 DB to v15 adding EXACTLY the seven columns", async () => {
    await migrateTo(14);
    const beforeVersion = await exec.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    expect(beforeVersion?.user_version).toBe(14);
    const before = await columnsOf("app_settings");
    for (const col of THEME_COLUMNS) {
      expect(before.has(col)).toBe(false);
    }

    await migrateTo(15, LATER);

    const afterVersion = await exec.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    expect(afterVersion?.user_version).toBe(15);
    const after = await columnsOf("app_settings");
    const added = [...after].filter((c) => !before.has(c)).sort();
    expect(added).toEqual([...THEME_COLUMNS].sort());
  });

  it("enforces the CHECK constraints on package and mode", async () => {
    await migrateTo(15);
    await expect(
      (async () =>
        exec.runAsync(
          "UPDATE app_settings SET theme_package = 'nebula' WHERE id = 1",
        ))(),
    ).rejects.toThrow();
    await expect(
      (async () =>
        exec.runAsync(
          "UPDATE app_settings SET galaxy_mode = 'sunset' WHERE id = 1",
        ))(),
    ).rejects.toThrow();
    // Valid values are accepted.
    await exec.runAsync(
      "UPDATE app_settings SET theme_package = 'standard', standard_mode = 'light' WHERE id = 1",
    );
    const row = await exec.getFirstAsync<{
      theme_package: string;
      standard_mode: string;
    }>("SELECT theme_package, standard_mode FROM app_settings WHERE id = 1");
    expect(row).toEqual({ theme_package: "standard", standard_mode: "light" });
  });

  it("is idempotent — re-running at v15 applies nothing and keeps one row", async () => {
    await migrateTo(15);
    await migrateTo(15, LATER);
    const rows = await exec.getAllAsync<{ id: number }>(
      "SELECT id FROM app_settings",
    );
    expect(rows).toEqual([{ id: 1 }]);
  });
});
