/**
 * Migration 005 — weekly-digest toggle column (Phase 15, DGST-01) proof.
 *
 * The single-row `app_settings` table gains the one `digest_enabled` toggle
 * column (default ON). This suite proves, node-side via the node:sqlite adapter,
 * that migration 005 is forward-only + additive:
 *   - a fresh v0 DB runs 001+002+003+004+005 in order and reaches v5 with the new
 *     column present and defaulted to 1 (digest ON);
 *   - a seeded v4 DB (001..004 already applied) runs 005 and gains exactly the
 *     one column, reaching v5 with no error and defaulting to 1 (the durable-OFF
 *     start-state-independence the launch sweep relies on, RESEARCH Pitfall 1);
 *   - re-running at v5 is idempotent and keeps exactly one id=1 row.
 *
 * Migrations 001/002/003/004 are imported and run UNCHANGED — 005 edits no
 * shipped table (never edit a shipped migration; irreversible on device).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

const NOW = "2026-08-23 12:00:00";
const LATER = "2026-08-23 13:30:00";

const ALL_MIGRATIONS = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
];

/** The one column migration 005 adds. */
const DIGEST_COLUMN = "digest_enabled";

let exec: SqlExecutor;

async function migrateToV5(now = NOW): Promise<void> {
  await runMigrations(exec, ALL_MIGRATIONS, 5, { now, newUid });
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

describe("migration 005 — digest toggle column (forward-only, additive)", () => {
  it("adds digest_enabled and lands at v5 on a fresh v0->v5 run", async () => {
    await migrateToV5();

    const version = await exec.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    expect(version?.user_version).toBe(5);

    const cols = await columnsOf("app_settings");
    expect(cols.has(DIGEST_COLUMN)).toBe(true);
  });

  it("seeds digest_enabled = 1 (digest ON) on a fresh run", async () => {
    await migrateToV5();
    const row = await exec.getFirstAsync<{ digest_enabled: number }>(
      "SELECT digest_enabled FROM app_settings WHERE id = 1",
    );
    expect(row?.digest_enabled).toBe(1);
  });

  it("upgrades an already-seeded v4 DB to v5 adding exactly the one column", async () => {
    await runMigrations(
      exec,
      [migration001, migration002, migration003, migration004],
      4,
      { now: NOW, newUid },
    );
    const beforeVersion = await exec.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    expect(beforeVersion?.user_version).toBe(4);
    const before = await columnsOf("app_settings");

    await migrateToV5(LATER);

    const afterVersion = await exec.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );
    expect(afterVersion?.user_version).toBe(5);
    const after = await columnsOf("app_settings");
    const added = [...after].filter((c) => !before.has(c)).sort();
    expect(added).toEqual([DIGEST_COLUMN]);
  });

  it("defaults digest_enabled to 1 on a v4->v5 upgrade too (start-state-independent)", async () => {
    await runMigrations(
      exec,
      [migration001, migration002, migration003, migration004],
      4,
      { now: NOW, newUid },
    );
    await migrateToV5(LATER);
    const row = await exec.getFirstAsync<{ digest_enabled: number }>(
      "SELECT digest_enabled FROM app_settings WHERE id = 1",
    );
    expect(row?.digest_enabled).toBe(1);
  });

  it("is idempotent — re-running at v5 applies nothing and keeps one row", async () => {
    await migrateToV5();
    await migrateToV5(LATER);
    const rows = await exec.getAllAsync<{ id: number }>(
      "SELECT id FROM app_settings",
    );
    expect(rows).toEqual([{ id: 1 }]);
  });
});
