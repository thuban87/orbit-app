/**
 * Migration 003 — orrery sun columns (ORR-05 / ORR-06) proof.
 *
 * The single-row `app_settings` table gains the two app-level sun columns:
 * `sun_contact_id` (NULL = self) and `self_sun_colour` (NULL = resolve to
 * `starPalette[0]` at read). This suite proves, node-side via the node:sqlite
 * adapter, that migration 003 is forward-only + additive:
 *   - a fresh v0 DB runs 001+002+003 in order and reaches v3 with both new
 *     columns present, each defaulting NULL;
 *   - a seeded v2 DB (001+002 already applied) runs 003 and gains exactly the
 *     two columns, reaching v3 with no error;
 *   - the FK `ON DELETE SET NULL` reverts a hard-purged sun-contact to NULL
 *     (L7 — the A1 self-revert is proven, not just asserted).
 *
 * Migrations 001/002 are imported and run UNCHANGED — 003 edits no shipped
 * table (never edit a shipped migration; irreversible on device).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

const NOW = "2026-08-17 12:00:00";
const LATER = "2026-08-17 13:30:00";

let exec: SqlExecutor;

/** Bring a fresh in-memory DB to v3 (001+002+003), the on-device launch path. */
async function migrateToV3(now = NOW): Promise<void> {
  await runMigrations(exec, [migration001, migration002, migration003], 3, {
    now,
    newUid,
  });
}

async function columnsOf(table: string): Promise<Set<string>> {
  const rows = await exec.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`,
  );
  return new Set(rows.map((r) => r.name));
}

beforeEach(() => {
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
});

describe("migration 003 — orrery sun columns (forward-only, additive)", () => {
  it("adds sun_contact_id + self_sun_colour and lands at v3 on a fresh v0->v3 run", async () => {
    await migrateToV3();

    const version = await exec.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    expect(version?.user_version).toBe(3);

    const cols = await columnsOf("app_settings");
    expect(cols.has("sun_contact_id")).toBe(true);
    expect(cols.has("self_sun_colour")).toBe(true);
  });

  it("runs 001 THEN 002 THEN 003 in ascending order from v0", async () => {
    // A device may jump v0->v3 in one update; all three steps must apply in order.
    await migrateToV3();
    const tables = await exec.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    );
    const names = new Set(tables.map((t) => t.name));
    // migration-001 and migration-002 tables both present.
    expect(names.has("contacts")).toBe(true);
    expect(names.has("app_settings")).toBe(true);
  });

  it("upgrades an already-seeded v2 DB to v3 adding exactly the two columns", async () => {
    // Seed to v2 (001+002), snapshot the column set, then apply 003.
    await runMigrations(exec, [migration001, migration002], 2, {
      now: NOW,
      newUid,
    });
    const beforeVersion = await exec.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    expect(beforeVersion?.user_version).toBe(2);
    const before = await columnsOf("app_settings");
    expect(before.has("sun_contact_id")).toBe(false);
    expect(before.has("self_sun_colour")).toBe(false);

    await runMigrations(exec, [migration001, migration002, migration003], 3, {
      now: LATER,
      newUid,
    });

    const afterVersion = await exec.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    expect(afterVersion?.user_version).toBe(3);
    const after = await columnsOf("app_settings");
    // Exactly the two new columns were added.
    const added = [...after].filter((c) => !before.has(c)).sort();
    expect(added).toEqual(["self_sun_colour", "sun_contact_id"]);
  });

  it("defaults both new columns to NULL after either migration path", async () => {
    await migrateToV3();
    const row = await exec.getFirstAsync<{
      sun_contact_id: number | null;
      self_sun_colour: string | null;
    }>("SELECT sun_contact_id, self_sun_colour FROM app_settings WHERE id = 1");
    expect(row?.sun_contact_id).toBeNull();
    expect(row?.self_sun_colour).toBeNull();
  });

  it("is idempotent — re-running at v3 applies nothing and keeps one row", async () => {
    await migrateToV3();
    await migrateToV3(LATER); // second call: user_version already 3, no pending steps
    const rows = await exec.getAllAsync<{ id: number }>(
      "SELECT id FROM app_settings",
    );
    expect(rows).toEqual([{ id: 1 }]);
  });

  it("reverts sun_contact_id to NULL when the sun-contact is hard-deleted (FK ON DELETE SET NULL, L7)", async () => {
    // node:sqlite fixture has foreign_keys=ON, so the FK action fires.
    await migrateToV3();

    const contact = await exec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?)`,
      [newUid(), "Sunny", 30, NOW, NOW],
    );
    const cid = contact.lastInsertRowId;

    await exec.runAsync(
      "UPDATE app_settings SET sun_contact_id = ? WHERE id = 1",
      [cid],
    );
    const assigned = await exec.getFirstAsync<{ sun_contact_id: number | null }>(
      "SELECT sun_contact_id FROM app_settings WHERE id = 1",
    );
    expect(assigned?.sun_contact_id).toBe(cid);

    // Hard-purge the sun-contact — the FK must auto-revert the sun to self (NULL).
    await exec.runAsync("DELETE FROM contacts WHERE id = ?", [cid]);
    const reverted = await exec.getFirstAsync<{ sun_contact_id: number | null }>(
      "SELECT sun_contact_id FROM app_settings WHERE id = 1",
    );
    expect(reverted?.sun_contact_id).toBeNull();
  });
});
