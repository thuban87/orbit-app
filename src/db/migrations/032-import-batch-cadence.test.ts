import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { IMPORT_BATCH_CADENCE_SCHEMA_VERSION } from "@/db/migrations/032-import-batch-cadence";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-27 12:00:00";

function deps() {
  let uid = 0;
  return { now: NOW, newUid: () => `seed-uid-${++uid}` };
}

async function columns(exec: SqlExecutor): Promise<string[]> {
  return (
    await exec.getAllAsync<{ name: string }>(
      "PRAGMA table_info(import_sessions)",
    )
  ).map((row) => row.name);
}

/**
 * 38.4 D-57 (owner, OA-E2): an additive, forward-only column carries a bulk
 * import's batch cadence on the durable session so resume keeps it.
 */
describe("migration 032 — import batch cadence (D-57)", () => {
  it("is the registered schema head", () => {
    expect(IMPORT_BATCH_CADENCE_SCHEMA_VERSION).toBe(32);
    expect(TARGET_VERSION).toBe(IMPORT_BATCH_CADENCE_SCHEMA_VERSION);
    expect(MIGRATIONS.filter((m) => m.version === 32)).toHaveLength(1);
  });

  it("upgrades a v31 database with an existing session, which reads Unbound with no cadence", async () => {
    const exec = nodeSqliteExecutor(openTestDb());
    const d = deps();
    await runMigrations(exec, MIGRATIONS, 31, d);
    expect(await columns(exec)).not.toContain("batch_interval_days");
    await exec.runAsync(
      `INSERT INTO import_sessions
         (uid, mode, batch_tracking_enabled, total_rows, created_at, modified_at)
       VALUES ('s-1', 'bulk', 0, 3, ?, ?)`,
      [NOW, NOW],
    );

    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, d);

    expect(await exec.getFirstAsync("PRAGMA user_version")).toEqual({
      user_version: 32,
    });
    expect(await columns(exec)).toContain("batch_interval_days");
    expect(
      await exec.getFirstAsync(
        `SELECT uid, mode, status, batch_tracking_enabled, batch_interval_days,
                total_rows, modified_at
         FROM import_sessions`,
      ),
    ).toEqual({
      uid: "s-1",
      mode: "bulk",
      status: "pending",
      batch_tracking_enabled: 0,
      batch_interval_days: null,
      total_rows: 3,
      modified_at: NOW,
    });
  });

  it("accepts NULL or a positive integer cadence and rejects anything else", async () => {
    const exec = nodeSqliteExecutor(openTestDb());
    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, deps());
    const inserted = await exec.runAsync(
      `INSERT INTO import_sessions (uid, mode, created_at, modified_at)
       VALUES ('s-2', 'bulk', ?, ?)`,
      [NOW, NOW],
    );
    const id = inserted.lastInsertRowId;
    // async: the node executor throws synchronously; make that a rejection.
    const update = async (value: unknown) =>
      exec.runAsync(
        "UPDATE import_sessions SET batch_interval_days = ? WHERE id = ?",
        [value as number, id],
      );

    for (const bad of [0, -1, 1.5, "x"]) {
      await expect(update(bad), String(bad)).rejects.toThrow(/CHECK/);
    }
    await expect(
      (async () =>
        exec.runAsync(
          `INSERT INTO import_sessions
             (uid, mode, batch_interval_days, created_at, modified_at)
           VALUES ('s-3', 'bulk', 0, ?, ?)`,
          [NOW, NOW],
        ))(),
    ).rejects.toThrow(/CHECK/);

    await update(30);
    expect(
      await exec.getFirstAsync(
        "SELECT batch_interval_days FROM import_sessions WHERE id = ?",
        [id],
      ),
    ).toEqual({ batch_interval_days: 30 });
    await update(null);
    expect(
      await exec.getFirstAsync(
        "SELECT batch_interval_days FROM import_sessions WHERE id = ?",
        [id],
      ),
    ).toEqual({ batch_interval_days: null });
  });
});
