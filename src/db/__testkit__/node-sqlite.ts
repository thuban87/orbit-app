/**
 * node:sqlite test harness for the SQLite data layer (DATA-01).
 *
 * Test infrastructure only — never imported by app code. Because the expo
 * async API does not run under Node, the runner and every SQL string in this
 * phase are exercised against Node's built-in `node:sqlite` (`DatabaseSync`,
 * SQLite 3.51.2) via a `SqlExecutor` adapter. `node:sqlite` is a Node built-in
 * — zero new runtime deps. It needs `--experimental-sqlite`; vitest surfaces
 * that as a warning only, so no config change is required (verified live:
 * Node 22.22.2 / SQLite 3.51.2).
 */
import { DatabaseSync } from "node:sqlite";
import type { SqlExecutor } from "@/db/types";

/**
 * Open a fresh in-memory database with `foreign_keys` enforced — the same
 * per-connection PRAGMA the on-device bootstrap sets before any transaction.
 */
export function openTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

/**
 * Wrap a `node:sqlite` `DatabaseSync` as the async `SqlExecutor` the runner and
 * DAOs are written against. Node's synchronous results are lifted into promises
 * and its `lastInsertRowid` (possibly a bigint) is normalised to a number.
 */
export function nodeSqliteExecutor(db: DatabaseSync): SqlExecutor {
  return {
    execAsync(sql: string): Promise<void> {
      db.exec(sql);
      return Promise.resolve();
    },
    runAsync(
      sql: string,
      params?: unknown[],
    ): Promise<{ lastInsertRowId: number; changes: number }> {
      const result = db.prepare(sql).run(...((params ?? []) as never[]));
      return Promise.resolve({
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      });
    },
    getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null> {
      const row = db.prepare(sql).get(...((params ?? []) as never[]));
      return Promise.resolve((row ?? null) as T | null);
    },
    getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]> {
      const rows = db.prepare(sql).all(...((params ?? []) as never[]));
      return Promise.resolve(rows as T[]);
    },
  };
}
