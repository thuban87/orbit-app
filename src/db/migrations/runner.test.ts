/**
 * Unit tests for src/db/migrations/runner.ts (DATA-01).
 *
 * Drives the REAL runner against an in-memory node:sqlite DB via the
 * SqlExecutor adapter. The crash-safety case (a mid-migration throw leaves
 * user_version unadvanced with no partial schema) is the load-bearing
 * assertion — an unreachable device must never wedge on a half-applied step.
 */
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { runMigrations } from "@/db/migrations/runner";
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";
import { afterEach, describe, expect, it } from "vitest";

const deps: MigrationDeps = { now: "2026-08-14", newUid: () => "uid-fixed" };

function makeExec() {
  const db = openTestDb();
  return { db, exec: nodeSqliteExecutor(db) };
}

async function userVersion(exec: SqlExecutor): Promise<number> {
  const row = await exec.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  return row?.user_version ?? 0;
}

function tableExists(exec: SqlExecutor, name: string): Promise<boolean> {
  return exec
    .getFirstAsync<{ n: number }>(
      "SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = ?",
      [name],
    )
    .then((r) => (r?.n ?? 0) > 0);
}

const createT1: Migration = {
  version: 1,
  apply: async (exec) => {
    await exec.execAsync("CREATE TABLE t1 (id INTEGER PRIMARY KEY)");
  },
};

let openDbs: Array<{ close(): void }> = [];
afterEach(() => {
  for (const db of openDbs) db.close();
  openDbs = [];
});

function freshExec() {
  const { db, exec } = makeExec();
  openDbs.push(db);
  return exec;
}

describe("runMigrations", () => {
  it("applies version 1 from a fresh DB and advances user_version", async () => {
    const exec = freshExec();

    await runMigrations(exec, [createT1], 1, deps);

    expect(await userVersion(exec)).toBe(1);
    expect(await tableExists(exec, "t1")).toBe(true);
  });

  it("is a forward-only no-op when already at the target version", async () => {
    const exec = freshExec();
    await runMigrations(exec, [createT1], 1, deps);

    // Re-running the identical set must not re-run step 1 (would throw
    // "table t1 already exists") and must leave user_version unchanged.
    await expect(runMigrations(exec, [createT1], 1, deps)).resolves.toBeUndefined();
    expect(await userVersion(exec)).toBe(1);
  });

  it("rolls back a throwing step, re-throwing the ORIGINAL error with user_version unadvanced", async () => {
    const exec = freshExec();
    const boom = new Error("migration 2 boom");
    const throwingStep: Migration = {
      version: 2,
      apply: async (e) => {
        // A partial object is created BEFORE the throw; the transaction must
        // roll it back so nothing survives.
        await e.execAsync("CREATE TABLE t2 (id INTEGER PRIMARY KEY)");
        throw boom;
      },
    };

    await runMigrations(exec, [createT1], 1, deps); // land cleanly at v1

    await expect(
      runMigrations(exec, [createT1, throwingStep], 2, deps),
    ).rejects.toBe(boom); // the ORIGINAL error, not a rollback error

    expect(await userVersion(exec)).toBe(1); // never advanced to 2
    expect(await tableExists(exec, "t2")).toBe(false); // partial DDL rolled back
    expect(await tableExists(exec, "t1")).toBe(true); // v1 intact
  });

  it("applies pending steps in strict ascending version order regardless of array order", async () => {
    const exec = freshExec();
    const order: number[] = [];
    const step = (v: number): Migration => ({
      version: v,
      apply: async (e) => {
        order.push(v);
        await e.execAsync(`CREATE TABLE ord_${v} (id INTEGER PRIMARY KEY)`);
      },
    });

    // Deliberately out of order in the array.
    await runMigrations(exec, [step(3), step(1), step(2)], 3, deps);

    expect(order).toEqual([1, 2, 3]);
    expect(await userVersion(exec)).toBe(3);
  });

  it("stops at the target version, leaving later steps unapplied", async () => {
    const exec = freshExec();
    const step = (v: number): Migration => ({
      version: v,
      apply: async (e) => {
        await e.execAsync(`CREATE TABLE stop_${v} (id INTEGER PRIMARY KEY)`);
      },
    });

    await runMigrations(exec, [step(1), step(2), step(3)], 2, deps);

    expect(await userVersion(exec)).toBe(2);
    expect(await tableExists(exec, "stop_2")).toBe(true);
    expect(await tableExists(exec, "stop_3")).toBe(false);
  });

  it("threads deps into every migration.apply call", async () => {
    const exec = freshExec();
    const seen: MigrationDeps[] = [];
    const seedStep: Migration = {
      version: 1,
      apply: async (e, d) => {
        seen.push(d);
        await e.execAsync("CREATE TABLE seeded (uid TEXT NOT NULL, at TEXT NOT NULL)");
        await e.runAsync("INSERT INTO seeded (uid, at) VALUES (?, ?)", [
          d.newUid(),
          d.now,
        ]);
      },
    };

    await runMigrations(exec, [seedStep], 1, deps);

    expect(seen).toEqual([deps]);
    const row = await exec.getFirstAsync<{ uid: string; at: string }>(
      "SELECT uid, at FROM seeded",
    );
    expect(row).toEqual({ uid: "uid-fixed", at: "2026-08-14" });
  });
});
