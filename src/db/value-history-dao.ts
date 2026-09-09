/** Additive, backup-includable history for opted-in custom-field values. */
import type { ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

export interface ValueHistoryEntry {
  id: number;
  uid: string;
  contact_id: number;
  field_def_id: number;
  value: string | null;
  created_at: string;
}

/** Non-mutexed append for composition into the owning edit transaction. */
export async function appendValueHistoryCore(
  exec: SqlExecutor,
  input: {
    contactId: number;
    fieldDefId: number;
    value: string | null;
    now: string;
  },
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO custom_field_value_history
       (uid, contact_id, field_def_id, value, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [newUid(), input.contactId, input.fieldDefId, input.value, input.now],
  );
}

/**
 * Preserve the prior raw TEXT only for history-retained definitions and only
 * when an existing non-null current value is actually changing.
 */
export async function maybeAppendPriorValueHistoryCore(
  exec: SqlExecutor,
  input: {
    contactId: number;
    fieldDefId: number;
    incomingValue: string | null;
    now: string;
  },
): Promise<void> {
  const def = await exec.getFirstAsync<{ history_retained: number }>(
    "SELECT history_retained FROM custom_field_defs WHERE id = ?",
    [input.fieldDefId],
  );
  if (def?.history_retained !== 1) return;
  const current = await exec.getFirstAsync<{ value: string | null }>(
    `SELECT value FROM custom_field_values
      WHERE contact_id = ? AND field_def_id = ?`,
    [input.contactId, input.fieldDefId],
  );
  if (current?.value == null || current.value === input.incomingValue) return;
  await appendValueHistoryCore(exec, {
    contactId: input.contactId,
    fieldDefId: input.fieldDefId,
    value: current.value,
    now: input.now,
  });
}

/** Deferred Phase-31 history drill-in read; newest retained value first. */
export function listValueHistory(
  exec: ReadOnlyExecutor,
  contactId: number,
  fieldDefId: number,
): Promise<ValueHistoryEntry[]> {
  return exec.getAllAsync<ValueHistoryEntry>(
    `SELECT id, uid, contact_id, field_def_id, value, created_at
       FROM custom_field_value_history
      WHERE contact_id = ? AND field_def_id = ?
      ORDER BY created_at DESC, id DESC`,
    [contactId, fieldDefId],
  );
}
