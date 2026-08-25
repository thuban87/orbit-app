/** Monotonic backup-change revision primitives for callers already in a transaction. */
import type { SqlExecutor } from "@/db/types";

/** Increment the singleton revision exactly once. Caller owns the transaction. */
export async function bumpDataRevisionCore(exec: SqlExecutor): Promise<void> {
  const result = await exec.runAsync(
    "UPDATE app_settings SET data_revision = data_revision + 1 WHERE id = 1",
  );
  if (result.changes !== 1) {
    throw new Error("bumpDataRevisionCore: app_settings id=1 row is missing");
  }
}

/** Read the current monotonic revision without opening a transaction. */
export async function readDataRevision(exec: SqlExecutor): Promise<number> {
  const row = await exec.getFirstAsync<{ data_revision: number }>(
    "SELECT data_revision FROM app_settings WHERE id = 1",
  );
  if (!row) {
    throw new Error("readDataRevision: app_settings id=1 row is missing");
  }
  return row.data_revision;
}
