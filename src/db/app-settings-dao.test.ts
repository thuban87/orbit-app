/**
 * app_settings migration (002) proof (NOTIF-05 / OQ-1).
 *
 * The single-row `app_settings` table is the backup-native (SQLite, OQ-1) home
 * for the app-level notification controls. This suite proves, node-side via the
 * node:sqlite adapter, that migration 002 is forward-only + additive: a fresh
 * v0 DB runs 001 then 002 in order and reaches v2 with the seeded id=1
 * defaults, an existing v1 DB upgrades without disturbing migration-001 data,
 * and a re-run at v2 is a no-op (idempotent by user_version).
 *
 * Migration 001 is imported and run unchanged — 002 edits no shipped table.
 * (The DAO read/write suites are appended in the same file by Plan 11-02 Task 2.)
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

const NOW = "2026-08-16 12:00:00";
const LATER = "2026-08-16 13:30:00";

let exec: SqlExecutor;

/** Bring a fresh in-memory DB to v2 (001 then 002), the on-device launch path. */
async function migrateToV2(): Promise<void> {
  await runMigrations(exec, [migration001, migration002], 2, {
    now: NOW,
    newUid,
  });
}

beforeEach(() => {
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
});

describe("migration 002 — app_settings (forward-only, additive)", () => {
  it("creates app_settings and seeds exactly one id=1 row on a fresh v0->v2 run", async () => {
    await migrateToV2();

    const version = await exec.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    expect(version?.user_version).toBe(2);

    const rows = await exec.getAllAsync<{ id: number }>(
      "SELECT id FROM app_settings",
    );
    expect(rows).toEqual([{ id: 1 }]);
  });

  it("seeds the decided defaults", async () => {
    await migrateToV2();
    const row = await exec.getFirstAsync<{
      notifications_enabled: number;
      decay_enabled: number;
      birthday_enabled: number;
      lockscreen_public: number;
      delivery_hour: number;
      quiet_start_hour: number;
      quiet_end_hour: number;
      created_at: string;
      modified_at: string;
    }>("SELECT * FROM app_settings WHERE id = 1");
    expect(row).toMatchObject({
      notifications_enabled: 0,
      decay_enabled: 1,
      birthday_enabled: 1,
      lockscreen_public: 0,
      delivery_hour: 9,
      quiet_start_hour: 21,
      quiet_end_hour: 8,
      created_at: NOW,
      modified_at: NOW,
    });
  });

  it("runs 001 THEN 002 in ascending order from v0", async () => {
    // A device may jump v0->v2 in one update; both steps must apply in order.
    await migrateToV2();
    const tables = await exec.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    );
    const names = new Set(tables.map((t) => t.name));
    expect(names.has("app_settings")).toBe(true);
    // A migration-001 table proves 001 also ran.
    expect(names.has("contacts")).toBe(true);
  });

  it("upgrades an existing v1 DB to v2 without touching migration-001 data", async () => {
    // First bring the DB to v1 only (the shipped state before this phase).
    await runMigrations(exec, [migration001], 1, { now: NOW, newUid });
    const before = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM categories",
    );
    // Then apply 002 up to v2.
    await runMigrations(exec, [migration001, migration002], 2, {
      now: LATER,
      newUid,
    });
    const after = await exec.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM categories",
    );
    expect(after?.n).toBe(before?.n);
    const settings = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM app_settings WHERE id = 1",
    );
    expect(settings?.id).toBe(1);
  });

  it("is idempotent — re-running at v2 applies nothing and keeps one row", async () => {
    await migrateToV2();
    await migrateToV2(); // second call: user_version already 2, no pending steps
    const rows = await exec.getAllAsync<{ id: number }>(
      "SELECT id FROM app_settings",
    );
    expect(rows).toEqual([{ id: 1 }]);
  });

  it("enforces the single-row CHECK (id must be 1)", async () => {
    await migrateToV2();
    await expect(
      exec.runAsync(
        `INSERT INTO app_settings (id, notifications_enabled, decay_enabled, birthday_enabled, lockscreen_public, delivery_hour, quiet_start_hour, quiet_end_hour, created_at, modified_at)
         VALUES (2, 0, 1, 1, 0, 9, 21, 8, ?, ?)`,
        [NOW, NOW],
      ),
    ).rejects.toThrow();
  });
});
