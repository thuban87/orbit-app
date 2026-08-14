/**
 * Crash-safe `PRAGMA user_version` migration runner (DATA-01).
 *
 * On unreachable devices a half-applied migration wedges the install
 * permanently — there is no remote repair. So each version step runs in its
 * OWN hand-rolled transaction that commits the step's DDL and its
 * `user_version` bump ATOMICALLY: `BEGIN; <apply>; PRAGMA user_version = N;
 * COMMIT`, and on any throw `ROLLBACK` then re-throw the ORIGINAL error so the
 * device sits cleanly at the last fully-applied version. Migrations are
 * forward-only and applied in strict ascending order; the runner never assumes
 * a starting state and never lowers `user_version`.
 *
 * Written against the `SqlExecutor` interface (never `expo-sqlite` directly) so
 * its control flow is unit-testable node-side with `node:sqlite`. Deliberately
 * does NOT use expo's `withTransactionAsync`/`withExclusiveTransactionAsync`:
 * their catch issues an unconditional `ROLLBACK` that throws and discards the
 * real SQL error (expo-sqlite pitfall P3).
 *
 * PRAGMA bootstrap (WAL / foreign_keys / busy_timeout, set BEFORE any
 * transaction) is the caller's job — this runner opens no connection and sets
 * no PRAGMA of its own beyond the per-step `user_version` bump.
 */
import type { Migration, MigrationDeps, SqlExecutor } from "@/db/types";

/**
 * Apply every pending migration up to `targetVersion`, in strict ascending
 * order, each in its own atomic transaction. `deps` is threaded into every
 * `migration.apply(exec, deps)` call so seed steps receive deterministic
 * `now`/`newUid`. Rejects with the original error of the first failing step,
 * leaving `user_version` at the last version that committed cleanly.
 */
export async function runMigrations(
  exec: SqlExecutor,
  migrations: Migration[],
  targetVersion: number,
  deps: MigrationDeps,
): Promise<void> {
  const row = await exec.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  const current = row?.user_version ?? 0;

  const pending = [...migrations]
    .sort((a, b) => a.version - b.version)
    .filter((m) => m.version > current && m.version <= targetVersion);

  for (const migration of pending) {
    const next = migration.version;
    // `next` is an app-defined code constant, never user input, but it is
    // interpolated (PRAGMA cannot bind a value) — assert it is a plain integer
    // so no dynamic SQL can ever reach the statement.
    if (!Number.isInteger(next)) {
      throw new Error(`migration version must be an integer, got ${next}`);
    }

    await exec.execAsync("BEGIN");
    try {
      await migration.apply(exec, deps);
      // Integer literal, never a bound value. Commits atomically with the DDL.
      await exec.execAsync(`PRAGMA user_version = ${next}`);
      await exec.execAsync("COMMIT");
    } catch (e) {
      // Preserve the ORIGINAL error: the rollback's own failure must not mask
      // the real cause. The device is left cleanly at the prior version.
      await exec.execAsync("ROLLBACK").catch(() => {});
      throw e;
    }
  }
}
