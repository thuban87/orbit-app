/**
 * SQLite data-layer contracts (DATA-01).
 *
 * These interfaces decouple the migration runner and DAOs from `expo-sqlite`
 * so their control flow is unit-testable node-side with `node:sqlite`. The
 * real on-device connection (expo `SQLiteDatabase`) and the node:sqlite test
 * adapter both satisfy `SqlExecutor`; nothing in this file imports expo.
 *
 * The array-params form (`params?: unknown[]`) is the single binding shape used
 * across the whole phase — every user value is bound, never interpolated.
 */

/**
 * The minimal async DB surface the runner + DAOs depend on. Deliberately a
 * subset of expo's `SQLiteDatabase` so a node:sqlite adapter can implement it.
 */
export interface SqlExecutor {
  /** Run one or more statements with no bound params (DDL, PRAGMA, BEGIN/COMMIT). */
  execAsync(sql: string): Promise<void>;
  /** Run a single write statement; resolves to the insert rowid + rows changed. */
  runAsync(
    sql: string,
    params?: unknown[],
  ): Promise<{ lastInsertRowId: number; changes: number }>;
  /** Fetch the first matching row, or `null` when there is none. */
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  /** Fetch all matching rows. */
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

/**
 * Injected side-effect sources so migration seeds are deterministic in tests.
 * `now` is a local-date string (see `formatLocalDate`); `newUid` mints the
 * per-row merge UID that later phases' newest-edit-wins merge relies on.
 */
export interface MigrationDeps {
  now: string;
  newUid: () => string;
}

/**
 * One forward-only schema step. `version` is the `user_version` this step
 * advances the DB to; `apply` runs its DDL + seeds against the executor. The
 * runner supplies `deps` — a step never fabricates its own timestamps/uids.
 */
export interface Migration {
  version: number;
  apply(exec: SqlExecutor, deps: MigrationDeps): Promise<void>;
}
