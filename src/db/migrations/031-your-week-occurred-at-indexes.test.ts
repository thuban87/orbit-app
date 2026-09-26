import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { YOUR_WEEK_INDEX_SCHEMA_VERSION } from "@/db/migrations/031-your-week-occurred-at-indexes";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-26 12:00:00";
const INDEXES = [
  "idx_group_events_occurred_at",
  "idx_interactions_occurred_at",
];

function deps() {
  let uid = 0;
  return { now: NOW, newUid: () => `seed-uid-${++uid}` };
}

async function indexNames(exec: SqlExecutor): Promise<Set<string>> {
  return new Set(
    (
      await exec.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'index'",
      )
    ).map((row) => row.name),
  );
}

describe("migration 031 — Your Week occurred_at indexes (RG-028)", () => {
  it("is the registered schema head", () => {
    expect(YOUR_WEEK_INDEX_SCHEMA_VERSION).toBe(31);
    expect(TARGET_VERSION).toBe(YOUR_WEEK_INDEX_SCHEMA_VERSION);
    expect(MIGRATIONS.filter((m) => m.version === 31)).toHaveLength(1);
  });

  it("advances a v1 fixture through the full chain to v31 with both indexes", async () => {
    const exec = nodeSqliteExecutor(openTestDb());
    const d = deps();
    await runMigrations(exec, MIGRATIONS, 1, d);
    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, d);

    expect(await exec.getFirstAsync("PRAGMA user_version")).toEqual({
      user_version: 31,
    });
    const names = await indexNames(exec);
    for (const index of INDEXES) expect(names.has(index), index).toBe(true);
  });

  it("upgrades a populated v30 database without touching its rows", async () => {
    const exec = nodeSqliteExecutor(openTestDb());
    const d = deps();
    await runMigrations(exec, MIGRATIONS, 30, d);
    const names30 = await indexNames(exec);
    for (const index of INDEXES) expect(names30.has(index), index).toBe(false);

    const contact = await exec.runAsync(
      `INSERT INTO contacts(uid,name,interval_days,created_at,modified_at)
       VALUES('c-1','Ada',7,?,?)`,
      [NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO interactions
         (uid,contact_id,occurred_at,recorded_at,channel,connected,source,modified_at)
       VALUES('i-1',?,'2026-09-20 08:00:00',?,'Call',1,'manual',?)`,
      [contact.lastInsertRowId, NOW, NOW],
    );
    await exec.runAsync(
      `INSERT INTO group_events(uid,title,occurred_at,created_at,modified_at)
       VALUES('g-1','Dinner','2026-09-21 19:00:00',?,?)`,
      [NOW, NOW],
    );

    await runMigrations(exec, MIGRATIONS, TARGET_VERSION, d);

    expect(await exec.getFirstAsync("PRAGMA user_version")).toEqual({
      user_version: 31,
    });
    const names = await indexNames(exec);
    for (const index of INDEXES) expect(names.has(index), index).toBe(true);
    expect(
      await exec.getAllAsync(
        "SELECT uid, occurred_at FROM interactions ORDER BY id",
      ),
    ).toEqual([{ uid: "i-1", occurred_at: "2026-09-20 08:00:00" }]);
    expect(
      await exec.getAllAsync(
        "SELECT uid, occurred_at FROM group_events ORDER BY id",
      ),
    ).toEqual([{ uid: "g-1", occurred_at: "2026-09-21 19:00:00" }]);
  });
});
