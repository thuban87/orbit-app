/**
 * Transactional custom-field DDL (FLD-02 / FLD-05 / FLD-06) — the correctness
 * core of the custom-fields subsystem.
 *
 * A custom field is a definition row with one normalized value row per contact.
 * Creating one inserts the definition plus durable NULL pairs in ONE transaction;
 * deleting a populated field snapshots its values to `field_history`, then removes
 * its pairs and definition in the same transaction.
 *
 * =============================================================================
 * CONCURRENCY STRUCTURE — READ BEFORE EDITING (review HIGH-1 / HIGH-2b):
 *   The drop logic is SPLIT so it can be composed atomically WITHOUT nesting the
 *   non-reentrant mutex (mutex.ts:32-36 — a nested `inWriteTransaction` is a
 *   PERMANENT hang).
 *
 *     • `dropFieldValues` is a PRIVATE, NON-mutexed core. It assumes the caller
 *       ALREADY holds the transaction: no BEGIN, no withMutex, no
 *       inWriteTransaction. It does snapshot + DELETE pairs + DELETE def and
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
 * SECURITY (T-16-06): every runtime value is `?`-bound; `col_name` survives only
 * as the immutable, bound `field_history.field_col_name` compatibility key.
 *
 * DATA-SAFETY: every destructive op snapshots non-NULL values to `field_history`
 * before explicitly deleting normalized pairs and the definition.
 *
 * Node-pure control flow: takes `exec: SqlExecutor` as its first argument and
 * imports the shared `inWriteTransaction` — never expo `withTransactionAsync`.
 */
import type { CustomFieldDef, NewFieldDef } from "@/db/field-types";
import { upsertValueCore } from "@/db/field-values-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

/** The identifying slice of a def a drop/expire op needs. */
type DropTarget = Pick<CustomFieldDef, "id" | "col_name">;

/**
 * Create a definition and a durable NULL pair for every existing contact,
 * including archived contacts, in one serialized transaction.
 */
export function createField(
  exec: SqlExecutor,
  def: NewFieldDef,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
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
    const contacts = await exec.getAllAsync<{ id: number }>(
      "SELECT id FROM contacts ORDER BY id",
    );
    for (const contact of contacts) {
      await upsertValueCore(
        exec,
        contact.id,
        result.lastInsertRowId,
        newUid(),
        null,
        def.now,
      );
    }
  });
}

/**
 * PRIVATE, NON-mutexed drop core (HIGH-1 composition primitive). Assumes the
 * caller ALREADY holds the transaction — no BEGIN, no withMutex, no
 * inWriteTransaction. Snapshots every non-null value to `field_history` BEFORE
 * dropping (Pitfall 1 — the only recovery mechanism that exists), then DELETE
 * normalized pairs + definition, both explicit. NOT exported —
 * composed by the three mutex-owning entries below.
 */
async function dropFieldValues(
  exec: SqlExecutor,
  def: DropTarget,
  operation: string,
  now: string,
): Promise<void> {
  // (a) Snapshot every non-null value to field_history BEFORE deleting the
  //     current pairs. col_name is the immutable, bound history key.
  await exec.runAsync(
    `INSERT INTO field_history
       (contact_id, field_col_name, old_value, operation, created_at)
     SELECT contact_id, ?, value, ?, ?
       FROM custom_field_values
      WHERE field_def_id = ? AND value IS NOT NULL`,
    [def.col_name, operation, now, def.id],
  );
  // (b) Delete pairs explicitly before their definition, retaining a single
  //     atomic snapshot/delete boundary without relying on cascade ordering.
  await exec.runAsync(
    "DELETE FROM custom_field_values WHERE field_def_id = ?",
    [def.id],
  );
  // (c) Delete the definition after its dependent pairs.
  await exec.runAsync("DELETE FROM custom_field_defs WHERE id = ?", [def.id]);

  // A permanently deleted custom-PHOTO definition can leave at most one local
  // photo file per contact. purge-photo-cleanup enumerates surviving definitions
  // by col_name, so it cannot rediscover these files after this deletion; they
  // remain bounded on-device orphans until a future history-driven cleanup.
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
    dropFieldValues(exec, def, operation, now),
  );
}

/**
 * The dynamic delete action (FLD-05), ATOMIC (review HIGH-2b). Opens ONE
 * `inWriteTransaction` and INSIDE it does the emptiness check AND the drop —
 * so no concurrent value write can land between them (empty-at-drop-time is
 * enforced atomically). Empty → immediate deletion via the NON-mutexed core (calling
 * the public `dropField` here would nest the mutex → deadlock); populated →
 * quarantine, leaving data + column untouched. Immediate delete is NEVER offered
 * for a populated field (§14.5 data-loss guard).
 */
export function deleteOrQuarantineField(
  exec: SqlExecutor,
  def: DropTarget,
  now: string,
): Promise<"deleted" | "quarantined"> {
  return inWriteTransaction(exec, async () => {
    const populated = await exec.getFirstAsync<{ one: number }>(
      `SELECT 1 AS one FROM custom_field_values
        WHERE field_def_id = ? AND value IS NOT NULL
        LIMIT 1`,
      [def.id],
    );
    if (populated === null) {
      // Empty — call the core DIRECTLY (already inside this txn; do NOT call the
      // public dropField, which would nest the mutex and deadlock).
      await dropFieldValues(exec, def, "delete", now);
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
    await dropFieldValues(exec, def, "quarantine_expiry", now);
    return true;
  });
}
