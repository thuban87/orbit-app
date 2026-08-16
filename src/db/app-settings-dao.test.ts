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
import {
  type AppSettings,
  getAppSettings,
  updateAppSettings,
} from "@/db/app-settings-dao";
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
    // Wrap in an async fn: the node:sqlite adapter throws synchronously, whereas
    // the on-device expo executor rejects — the wrapper normalises both to a
    // rejected promise so the assertion holds against either executor.
    await expect(
      (async () =>
        exec.runAsync(
          `INSERT INTO app_settings (id, notifications_enabled, decay_enabled, birthday_enabled, lockscreen_public, delivery_hour, quiet_start_hour, quiet_end_hour, created_at, modified_at)
         VALUES (2, 0, 1, 1, 0, 9, 21, 8, ?, ?)`,
          [NOW, NOW],
        ))(),
    ).rejects.toThrow();
  });
});

describe("app-settings-dao — read", () => {
  it("getAppSettings returns the seeded defaults as a typed row", async () => {
    await migrateToV2();
    const settings = await getAppSettings(exec);
    const expected: AppSettings = {
      notificationsEnabled: 0,
      decayEnabled: 1,
      birthdayEnabled: 1,
      lockscreenPublic: 0,
      deliveryHour: 9,
      quietStartHour: 21,
      quietEndHour: 8,
    };
    expect(settings).toEqual(expected);
  });

  it("throws if the id=1 row is missing (never happens post-seed, loud by design)", async () => {
    await migrateToV2();
    await exec.runAsync("DELETE FROM app_settings WHERE id = 1");
    await expect((async () => getAppSettings(exec))()).rejects.toThrow();
  });
});

describe("app-settings-dao — validated write", () => {
  beforeEach(async () => {
    await migrateToV2();
  });

  it("updates only the supplied fields and bumps modified_at", async () => {
    await updateAppSettings(
      exec,
      { notificationsEnabled: 1, deliveryHour: 7 },
      LATER,
    );
    const settings = await getAppSettings(exec);
    expect(settings.notificationsEnabled).toBe(1);
    expect(settings.deliveryHour).toBe(7);
    // Untouched fields keep their seeded defaults.
    expect(settings.quietStartHour).toBe(21);
    expect(settings.quietEndHour).toBe(8);
    expect(settings.decayEnabled).toBe(1);

    const row = await exec.getFirstAsync<{ modified_at: string }>(
      "SELECT modified_at FROM app_settings WHERE id = 1",
    );
    expect(row?.modified_at).toBe(LATER);
  });

  it("roundtrips every field", async () => {
    await updateAppSettings(
      exec,
      {
        notificationsEnabled: 1,
        decayEnabled: 0,
        birthdayEnabled: 0,
        lockscreenPublic: 1,
        deliveryHour: 6,
        quietStartHour: 22,
        quietEndHour: 7,
      },
      LATER,
    );
    expect(await getAppSettings(exec)).toEqual({
      notificationsEnabled: 1,
      decayEnabled: 0,
      birthdayEnabled: 0,
      lockscreenPublic: 1,
      deliveryHour: 6,
      quietStartHour: 22,
      quietEndHour: 7,
    });
  });

  it.each([
    ["deliveryHour", -1],
    ["deliveryHour", 24],
    ["deliveryHour", 9.5],
    ["deliveryHour", Number.NaN],
    ["quietStartHour", -1],
    ["quietStartHour", 24],
    ["quietEndHour", 25],
    ["quietEndHour", 3.14],
  ])(
    "rejects out-of-range/non-integer %s=%s before any UPDATE",
    async (field, value) => {
      await expect(
        (async () =>
          updateAppSettings(
            exec,
            { [field]: value } as Parameters<typeof updateAppSettings>[1],
            LATER,
          ))(),
      ).rejects.toThrow();
      // The row must be unchanged: modified_at still the seed value.
      const row = await exec.getFirstAsync<{ modified_at: string }>(
        "SELECT modified_at FROM app_settings WHERE id = 1",
      );
      expect(row?.modified_at).toBe(NOW);
    },
  );

  it("accepts the boundary hours 0 and 23", async () => {
    await updateAppSettings(exec, { deliveryHour: 0, quietEndHour: 23 }, LATER);
    const settings = await getAppSettings(exec);
    expect(settings.deliveryHour).toBe(0);
    expect(settings.quietEndHour).toBe(23);
  });

  it("persists the canonical 0/1 toggle inputs", async () => {
    await updateAppSettings(
      exec,
      { decayEnabled: 0, birthdayEnabled: 1 },
      LATER,
    );
    const settings = await getAppSettings(exec);
    expect(settings.decayEnabled).toBe(0);
    expect(settings.birthdayEnabled).toBe(1);
  });

  it("rejects a toggle value that is neither 0 nor 1", async () => {
    await expect(
      (async () =>
        updateAppSettings(exec, { decayEnabled: 2 as 0 | 1 }, LATER))(),
    ).rejects.toThrow();
    const row = await exec.getFirstAsync<{ decay_enabled: number }>(
      "SELECT decay_enabled FROM app_settings WHERE id = 1",
    );
    expect(row?.decay_enabled).toBe(1);
  });

  it("is a no-op that still bumps modified_at when the patch is empty", async () => {
    await updateAppSettings(exec, {}, LATER);
    const settings = await getAppSettings(exec);
    expect(settings.deliveryHour).toBe(9);
    const row = await exec.getFirstAsync<{ modified_at: string }>(
      "SELECT modified_at FROM app_settings WHERE id = 1",
    );
    expect(row?.modified_at).toBe(LATER);
  });

  it("never references a per-contact column (writes only app_settings)", async () => {
    // Guard the DATA-04 recency invariant by construction: a contacts write here
    // would be a cross-table leak. Insert a contact, snapshot last_contact,
    // update settings, assert the contact row is byte-identical.
    await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, last_contact, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newUid(), "Sam", 30, NOW, NOW, NOW],
    );
    const before = await exec.getFirstAsync<{
      last_contact: string;
      modified_at: string;
    }>("SELECT last_contact, modified_at FROM contacts WHERE name = 'Sam'");
    await updateAppSettings(exec, { deliveryHour: 11 }, LATER);
    const after = await exec.getFirstAsync<{
      last_contact: string;
      modified_at: string;
    }>("SELECT last_contact, modified_at FROM contacts WHERE name = 'Sam'");
    expect(after).toEqual(before);
  });
});
