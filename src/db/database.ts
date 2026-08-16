/**
 * Database bootstrap — open, PRAGMA setup, and migrate (DATA-01).
 *
 * `openAndMigrate()` is the single entry point that opens `orbit.db` and brings
 * its schema to `TARGET_VERSION`. The PRAGMA ORDER is load-bearing: WAL,
 * `foreign_keys = ON`, and `busy_timeout` are all set BEFORE the migration
 * runner opens any transaction. `foreign_keys` is a PER-CONNECTION pragma and a
 * silent no-op if issued inside a transaction (expo-sqlite pitfall P1), so it
 * MUST precede `runMigrations`; WAL is persistent; `busy_timeout` guards the
 * concurrent headless-tap access path.
 *
 * The expo `SQLiteDatabase` is wrapped in an EXPLICIT `SqlExecutor` adapter
 * (rather than relying on structural assignability) so the runner and DAOs stay
 * decoupled from expo and the run-result shape is normalised to
 * `{ lastInsertRowId, changes }`. Migration/DAO SQL is proven node-side in the
 * Plan-01/02 tests; this module's expo wiring is verified by tsc/biome plus the
 * on-device run in Plan 06.
 *
 * Timestamps are LOCAL wall-clock (never `toISOString()`, which is UTC and
 * would produce an evening off-by-one). `localDateTime()` builds a
 * `YYYY-MM-DD HH:MM:SS` string from local components, sharing the date half
 * with `formatLocalDate()`.
 */
import * as SQLite from "expo-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import { formatLocalDate } from "@/utils/dates";

// --- Tunable constants (top-of-file per project convention) ------------------

/** Milliseconds a busy connection waits before erroring (concurrent headless access). */
export const BUSY_TIMEOUT_MS = 5000;
/** The schema version this build expects; the runner migrates up to this. */
export const TARGET_VERSION = 2;

const DATABASE_NAME = "orbit.db";

/**
 * Local wall-clock timestamp as `YYYY-MM-DD HH:MM:SS`. Uses local components
 * only — never `toISOString()` — so `created_at`/`modified_at` reflect the
 * user's clock (dates.ts convention: avoid the UTC evening off-by-one).
 */
export function localDateTime(date: Date = new Date()): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${formatLocalDate(date)} ${hh}:${mm}:${ss}`;
}

/**
 * Wrap an expo `SQLiteDatabase` as the async `SqlExecutor` the runner and DAOs
 * are written against, normalising the run result to `{ lastInsertRowId,
 * changes }`. Explicit delegation, not structural assignability.
 */
function expoExecutor(db: SQLite.SQLiteDatabase): SqlExecutor {
  return {
    execAsync(sql: string): Promise<void> {
      return db.execAsync(sql);
    },
    async runAsync(
      sql: string,
      params?: unknown[],
    ): Promise<{ lastInsertRowId: number; changes: number }> {
      const result = await db.runAsync(
        sql,
        (params ?? []) as SQLite.SQLiteBindParams,
      );
      return {
        lastInsertRowId: result.lastInsertRowId,
        changes: result.changes,
      };
    },
    getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null> {
      return db.getFirstAsync<T>(
        sql,
        (params ?? []) as SQLite.SQLiteBindParams,
      );
    },
    getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]> {
      return db.getAllAsync<T>(sql, (params ?? []) as SQLite.SQLiteBindParams);
    },
  };
}

let cachedDb: SQLite.SQLiteDatabase | null = null;

/**
 * Open `orbit.db`, set the connection PRAGMAs (WAL, foreign_keys=ON,
 * busy_timeout) BEFORE any transaction, then run migrations up to
 * `TARGET_VERSION`. Idempotent: subsequent calls return the cached connection.
 */
export async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  if (cachedDb) return cachedDb;

  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  // PRAGMAs BEFORE any transaction. foreign_keys is per-connection and a
  // no-op inside a txn (P1); WAL is persistent; busy_timeout guards concurrency.
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await db.execAsync(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS};`);

  const now = localDateTime();
  // Order does not matter — the runner sorts by version and applies ascending.
  await runMigrations(
    expoExecutor(db),
    [migration001, migration002],
    TARGET_VERSION,
    { now, newUid },
  );

  cachedDb = db;
  return db;
}

/**
 * The opened, migrated database. Throws if called before `openAndMigrate()` has
 * resolved — bootstrap must complete first.
 */
export function getDb(): SQLite.SQLiteDatabase {
  if (!cachedDb) {
    throw new Error("getDb() called before openAndMigrate() completed");
  }
  return cachedDb;
}

/**
 * The `SqlExecutor` over the cached, migrated connection — the minimal accessor
 * services (e.g. the launch field sweep) use to obtain the executor without
 * importing expo-sqlite themselves. Throws (via `getDb`) if called before
 * `openAndMigrate()` has resolved.
 */
export function getExecutor(): SqlExecutor {
  return expoExecutor(getDb());
}
