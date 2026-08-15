/**
 * Transactional custom-field DDL (FLD-02 / FLD-05 / FLD-06) — the correctness
 * core of the custom-fields subsystem.
 *
 * A custom field is a ROW in `custom_field_defs` AND a COLUMN in
 * `contact_custom_values` (two-table model, HANDOFF §14.1). Creating one is
 * `INSERT def + ALTER TABLE ADD COLUMN` in ONE transaction; deleting a populated
 * one is irreversible, so it snapshots every value to `field_history` and then
 * `DELETE def + DROP COLUMN` in ONE transaction — the operations whose atomicity
 * the whole subsystem's data-safety depends on.
 *
 * =============================================================================
 * CONCURRENCY STRUCTURE — READ BEFORE EDITING (review HIGH-1 / HIGH-2b):
 *   The drop logic is SPLIT so it can be composed atomically WITHOUT nesting the
 *   non-reentrant mutex (mutex.ts:32-36 — a nested `inWriteTransaction` is a
 *   PERMANENT hang).
 *
 *     • `dropFieldColumns` is a PRIVATE, NON-mutexed core. It assumes the caller
 *       ALREADY holds the transaction: no BEGIN, no withMutex, no
 *       inWriteTransaction. It does snapshot + DELETE def + DROP COLUMN and
 *       NOTHING else.
 *     • `dropField` is the PUBLIC drop primitive: it wraps the core in exactly
 *       ONE `inWriteTransaction`. It must NEVER be called from inside another
 *       transaction (that would nest the mutex → deadlock).
 *     • `deleteOrQuarantineField` opens ONE `inWriteTransaction`, does the
 *       emptiness check AND (for an empty field) calls the core directly — so
 *       check and drop are one atomic transaction with no window between them.
 *     • `expireFieldIfStale` (the sweep's entry, Plan 07) opens ONE
 *       `inWriteTransaction`, RE-VERIFIES staleness under the lock, then calls
 *       the core directly. Plan 07's sweep calls THIS, never `dropField`.
 * =============================================================================
 *
 * SECURITY (T-03-01): `col_name` is the ONLY interpolated identifier (identifiers
 * cannot be `?`-bound). It is made safe by construction in `makeColName` (Plan
 * 01) and re-checked with `isSafeColName` before EVERY interpolation site here,
 * then double-quoted. Every runtime value is `?`-bound.
 *
 * DATA-SAFETY (CLAUDE.md invariants): value columns are TEXT forever, never
 * indexed/UNIQUE (DROP COLUMN would fail); every destructive op snapshots to
 * `field_history` in the SAME transaction; DELETE def + DROP COLUMN are BOTH
 * explicit (ON DELETE CASCADE deletes rows, never columns).
 *
 * Node-pure control flow: takes `exec: SqlExecutor` as its first argument and
 * imports the shared `inWriteTransaction` — never expo `withTransactionAsync`.
 */
import { isSafeColName } from "@/db/col-name";
import type { CustomFieldDef, NewFieldDef } from "@/db/field-types";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

/** The identifying slice of a def a drop/expire op needs. */
type DropTarget = Pick<CustomFieldDef, "id" | "col_name">;

/**
 * Guard-then-quote a col_name for interpolation. Defence in depth: even a name
 * that bypassed `makeColName` cannot reach SQL — a bad name throws BEFORE any
 * write in the transaction, so the transaction rolls back untouched.
 */
function quoteCol(colName: string): string {
  if (!isSafeColName(colName)) {
    throw new Error(`unsafe custom-field col_name: ${JSON.stringify(colName)}`);
  }
  return `"${colName}"`;
}

/**
 * Create a custom field: `INSERT def + ALTER TABLE ADD COLUMN` in ONE
 * transaction. A mid-op failure (e.g. a duplicate physical column) rolls back
 * BOTH — no orphan def, no orphan column (T-03-03). The value column is declared
 * TEXT forever and is never indexed/UNIQUE (CLAUDE.md invariant).
 */
export function createField(
  exec: SqlExecutor,
  def: NewFieldDef,
): Promise<void> {
  // Guard the identifier BEFORE opening the transaction body's first write.
  const col = quoteCol(def.col_name);
  return inWriteTransaction(exec, async () => {
    await exec.runAsync(
      `INSERT INTO custom_field_defs
         (uid, col_name, label, type, options, show_on_new, always_show,
          display_order, share_with_ai, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        def.uid,
        def.col_name,
        def.label,
        def.type,
        def.options,
        def.show_on_new,
        def.always_show,
        def.display_order,
        def.share_with_ai,
        def.now,
        def.now,
      ],
    );
    // col_name is the ONLY interpolated token (guarded + double-quoted above).
    await exec.execAsync(
      `ALTER TABLE contact_custom_values ADD COLUMN ${col} TEXT`,
    );
  });
}

/**
 * PRIVATE, NON-mutexed drop core (HIGH-1 composition primitive). Assumes the
 * caller ALREADY holds the transaction — no BEGIN, no withMutex, no
 * inWriteTransaction. Snapshots every non-null value to `field_history` BEFORE
 * dropping (Pitfall 1 — the only recovery mechanism that exists), then DELETE
 * def + DROP COLUMN, both explicit (CASCADE never drops a column). NOT exported —
 * composed by the three mutex-owning entries below.
 */
async function dropFieldColumns(
  exec: SqlExecutor,
  def: DropTarget,
  operation: string,
  now: string,
): Promise<void> {
  const col = quoteCol(def.col_name);
  // (a) Snapshot every non-null value to field_history BEFORE the drop. The
  //     col_name is the field_col_name literal (?-bound) AND the value column
  //     read (interpolated identifier, guarded above).
  await exec.runAsync(
    `INSERT INTO field_history
       (contact_id, field_col_name, old_value, operation, created_at)
     SELECT contact_id, ?, ${col}, ?, ?
       FROM contact_custom_values
      WHERE ${col} IS NOT NULL`,
    [def.col_name, operation, now],
  );
  // (b) Delete the def row (explicit — CASCADE would delete value ROWS, not the
  //     column).
  await exec.runAsync("DELETE FROM custom_field_defs WHERE id = ?", [def.id]);
  // (c) Drop the physical value column (explicit — succeeds only because no
  //     index/UNIQUE was ever added to it; FLD-06).
  await exec.execAsync(`ALTER TABLE contact_custom_values DROP COLUMN ${col}`);
}

/**
 * PUBLIC drop primitive: the snapshot-drop wrapped in exactly ONE
 * `inWriteTransaction`. This owns the mutex + transaction and must NEVER be
 * wrapped in another withMutex/inWriteTransaction (non-reentrant → hang; HIGH-1).
 * Plan 07's sweep calls `expireFieldIfStale`, NOT this.
 */
export function dropField(
  exec: SqlExecutor,
  def: DropTarget,
  operation: string,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, () =>
    dropFieldColumns(exec, def, operation, now),
  );
}

/**
 * The dynamic delete action (FLD-05), ATOMIC (review HIGH-2b). Opens ONE
 * `inWriteTransaction` and INSIDE it does the emptiness check AND the drop —
 * so no concurrent value write can land between them (empty-at-drop-time is
 * enforced atomically). Empty → immediate drop via the NON-mutexed core (calling
 * the public `dropField` here would nest the mutex → deadlock); populated →
 * quarantine, leaving data + column untouched. Immediate delete is NEVER offered
 * for a populated field (§14.5 data-loss guard).
 */
export function deleteOrQuarantineField(
  exec: SqlExecutor,
  def: DropTarget,
  now: string,
): Promise<"deleted" | "quarantined"> {
  const col = quoteCol(def.col_name);
  return inWriteTransaction(exec, async () => {
    const populated = await exec.getFirstAsync<{ one: number }>(
      `SELECT 1 AS one FROM contact_custom_values WHERE ${col} IS NOT NULL LIMIT 1`,
    );
    if (populated === null) {
      // Empty — call the core DIRECTLY (already inside this txn; do NOT call the
      // public dropField, which would nest the mutex and deadlock).
      await dropFieldColumns(exec, def, "delete", now);
      return "deleted";
    }
    await exec.runAsync(
      "UPDATE custom_field_defs SET quarantined_at = ?, modified_at = ? WHERE id = ?",
      [now, now, def.id],
    );
    return "quarantined";
  });
}

/**
 * The sweep-specific expiry op (Plan 07) that closes the scan→drop TOCTOU
 * (review cycle-2 MED). Opens ONE `inWriteTransaction` and FIRST re-verifies
 * staleness UNDER THE LOCK: the field must still be quarantined AND still past
 * the window (STRICT `<`, the same boundary Plan 07's candidate scan uses). If a
 * `restoreField` (also serialized through the shared mutex) landed after the
 * sweep's bare candidate scan, it is ordered BEFORE this transaction, the guard
 * SELECT sees the nulled `quarantined_at`, and the field SURVIVES (returns
 * false). Only a still-stale field is dropped, via the NON-mutexed core (calling
 * `dropField` here would nest the mutex → deadlock). Returns whether it dropped.
 */
export function expireFieldIfStale(
  exec: SqlExecutor,
  def: DropTarget,
  windowModifier: string,
  now: string,
): Promise<boolean> {
  return inWriteTransaction(exec, async () => {
    const stale = await exec.getFirstAsync<{ one: number }>(
      `SELECT 1 AS one FROM custom_field_defs
        WHERE id = ?
          AND quarantined_at IS NOT NULL
          AND quarantined_at < datetime('now', 'localtime', ?)`,
      [def.id, windowModifier],
    );
    if (stale === null) {
      return false;
    }
    await dropFieldColumns(exec, def, "quarantine_expiry", now);
    return true;
  });
}
