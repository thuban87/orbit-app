/**
 * Custom-field definition metadata DAO (FLD-03) — the non-DDL writers and reads
 * of `custom_field_defs`.
 *
 * These ops mutate the DEF ROW only (label, display_order, options, curation
 * flags, quarantine state); they never touch the physical value column. The DDL
 * that adds/drops columns lives in `field-ddl.ts`.
 *
 * =============================================================================
 * EVERY MUTATING OP IS SERIALIZED THROUGH THE SHARED MUTEX (review cycle-2 MED):
 *   Each mutating export runs inside its OWN `inWriteTransaction` — the SAME
 *   boundary the recency writers and `upsertValue` use. This completes the "every
 *   writer through the shared mutex" contract: a bare UPDATE issued while the
 *   async launch-sweep's in-flight drop transaction is open on the shared
 *   connection would otherwise be CAPTURED into it (the P4 hazard the mutex
 *   exists to prevent). Serializing `restoreField` in particular is one half of
 *   the sweep-TOCTOU fix — `expireFieldIfStale` (field-ddl.ts) re-checks
 *   staleness under the SAME lock, so a restore that lands after the sweep's
 *   candidate scan is honoured and the field is not dropped.
 *
 *   These ops are only ever called STANDALONE (never composed inside another
 *   owned transaction), so a direct `inWriteTransaction` wrapper is safe — no
 *   nested mutex acquisition. A future caller that must compose one inside an
 *   already-owned transaction extracts a non-mutexed core and calls it there (the
 *   HIGH-2 core/wrapper pattern documented in transaction.ts).
 * =============================================================================
 *
 * Each mutating op is `?`-bound and asserts `changes === 1` inside its
 * transaction (a non-matching id throws → rollback), mirroring recency-dao's
 * loud-failure guard. Reads (`listDefs`, `isFieldEmpty`) take NO transaction.
 *
 * col_name is a STABLE slug (CONTEXT sub-decision): `renameField` edits `label`
 * ONLY — a literal RENAME COLUMN is unnecessary churn and would need a
 * field_history name-sync. `isFieldEmpty` is the ONE read that interpolates a
 * col_name; it guards with `isSafeColName` before double-quoting.
 *
 * TIMESTAMPS are local wall-clock supplied by the caller (never toISOString).
 * Node-pure: takes `exec: SqlExecutor`; imports the shared `inWriteTransaction`.
 */
import { isSafeColName } from "@/db/col-name";
import type { CustomFieldDef, SqliteBool } from "@/db/field-types";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

/** Throw (→ rollback) unless exactly one row matched. */
function assertOneChange(op: string, id: number, changes: number): void {
  if (changes !== 1) {
    throw new Error(`${op}: no def matched id=${id} (changed ${changes})`);
  }
}

/**
 * Rename a field: edit `label` ONLY. `col_name` stays a stable slug — the
 * physical column is never renamed (CONTEXT sub-decision).
 */
export function renameField(
  exec: SqlExecutor,
  id: number,
  label: string,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      "UPDATE custom_field_defs SET label = ?, modified_at = ? WHERE id = ?",
      [label, now, id],
    );
    assertOneChange("renameField", id, result.changes);
  });
}

/**
 * Reorder fields: set each id's `display_order` to its index in `orderedIds`,
 * all in ONE transaction. A non-matching id throws → the whole reorder rolls
 * back.
 */
export function reorderFields(
  exec: SqlExecutor,
  orderedIds: number[],
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    for (let index = 0; index < orderedIds.length; index++) {
      const id = orderedIds[index];
      const result = await exec.runAsync(
        "UPDATE custom_field_defs SET display_order = ?, modified_at = ? WHERE id = ?",
        [index, now, id],
      );
      assertOneChange("reorderFields", id, result.changes);
    }
  });
}

/**
 * Change a field's dropdown `options` JSON (or null). Type changes go through
 * Plan 05, not here.
 */
export function changeFieldOptions(
  exec: SqlExecutor,
  id: number,
  options: string | null,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      "UPDATE custom_field_defs SET options = ?, modified_at = ? WHERE id = ?",
      [options, now, id],
    );
    assertOneChange("changeFieldOptions", id, result.changes);
  });
}

/**
 * Persist the two curation flags — `show_on_new` (offer on the new-contact form)
 * and `always_show` (render on the profile even when empty). Addresses cycle-1
 * MED: Plan 08's form offered both but no DAO persisted them.
 */
export function updateFieldCuration(
  exec: SqlExecutor,
  id: number,
  showOnNew: SqliteBool,
  alwaysShow: SqliteBool,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      "UPDATE custom_field_defs SET show_on_new = ?, always_show = ?, modified_at = ? WHERE id = ?",
      [showOnNew, alwaysShow, now, id],
    );
    assertOneChange("updateFieldCuration", id, result.changes);
  });
}

/**
 * Quarantine a field (soft-delete): stamp `quarantined_at`. Data + column are
 * untouched.
 */
export function quarantineField(
  exec: SqlExecutor,
  id: number,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      "UPDATE custom_field_defs SET quarantined_at = ?, modified_at = ? WHERE id = ?",
      [now, now, id],
    );
    assertOneChange("quarantineField", id, result.changes);
  });
}

/**
 * Restore a quarantined field: null `quarantined_at`. Serialized through the
 * shared mutex so a restore that lands after the sweep's candidate scan is
 * ordered BEFORE `expireFieldIfStale`'s under-the-lock re-check — closing the
 * sweep-TOCTOU (its other half lives in field-ddl.ts).
 */
export function restoreField(
  exec: SqlExecutor,
  id: number,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      "UPDATE custom_field_defs SET quarantined_at = NULL, modified_at = ? WHERE id = ?",
      [now, id],
    );
    assertOneChange("restoreField", id, result.changes);
  });
}

/**
 * List field defs ordered by `display_order`. When `includeQuarantined` is true,
 * quarantined defs are returned too — Plan 08's create path needs this so a
 * re-created label cannot collide with a quarantined field's still-present
 * column. A pure read: no transaction.
 */
export function listDefs(
  exec: SqlExecutor,
  { includeQuarantined }: { includeQuarantined: boolean },
): Promise<CustomFieldDef[]> {
  if (includeQuarantined) {
    return exec.getAllAsync<CustomFieldDef>(
      "SELECT * FROM custom_field_defs ORDER BY display_order",
    );
  }
  return exec.getAllAsync<CustomFieldDef>(
    "SELECT * FROM custom_field_defs WHERE quarantined_at IS NULL ORDER BY display_order",
  );
}

/**
 * True when a field's value column holds no non-null value. `col_name` is the ONE
 * interpolated identifier here — guarded with `isSafeColName` before quoting. A
 * pure read: no transaction.
 */
export async function isFieldEmpty(
  exec: SqlExecutor,
  colName: string,
): Promise<boolean> {
  if (!isSafeColName(colName)) {
    throw new Error(`unsafe custom-field col_name: ${JSON.stringify(colName)}`);
  }
  const row = await exec.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM contact_custom_values WHERE "${colName}" IS NOT NULL`,
  );
  return (row?.n ?? 0) === 0;
}
