/**
 * Current-state history writers (KNOW-03 / KNOW-04).
 *
 * The shared write transaction is deliberately opened only by public wrappers.
 * Cores are composition primitives which assume their caller already owns BEGIN;
 * keeping that split prevents nesting the non-reentrant write mutex.
 */
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import {
  isCurrentStateFieldKey,
  type CurrentStateFieldKey,
} from "@/db/memory-registry";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

export interface SetCurrentStateValueInput {
  contactId: number;
  fieldKey: CurrentStateFieldKey;
  value: string;
  now: string;
}

function assertCurrentStateFieldKey(fieldKey: string): asserts fieldKey is CurrentStateFieldKey {
  if (!isCurrentStateFieldKey(fieldKey)) {
    throw new Error("current-state-history-dao: unknown field_key");
  }
}

function assertMeaningfulValue(value: string): void {
  if (value.trim().length === 0) {
    throw new Error("current-state-history-dao: value must not be blank");
  }
}

/**
 * Add a new current value while retaining the prior current value as history.
 * Caller owns the transaction; zero demotions is valid for a field's first row.
 */
export async function setCurrentStateValueCore(
  exec: SqlExecutor,
  input: SetCurrentStateValueInput,
): Promise<number> {
  assertCurrentStateFieldKey(input.fieldKey);
  assertMeaningfulValue(input.value);

  await exec.runAsync(
    `UPDATE current_state_entries
        SET is_current = 0, modified_at = ?
      WHERE contact_id = ? AND field_key = ? AND is_current = 1`,
    [input.now, input.contactId, input.fieldKey],
  );
  const inserted = await exec.runAsync(
    `INSERT INTO current_state_entries
       (uid, contact_id, field_key, value, is_current, created_at, modified_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [
      newUid(),
      input.contactId,
      input.fieldKey,
      input.value,
      input.now,
      input.now,
    ],
  );
  return inserted.lastInsertRowId;
}

/** Set a standalone current value and advance the durable data revision once. */
export function setCurrentStateValue(
  exec: SqlExecutor,
  input: SetCurrentStateValueInput,
): Promise<number> {
  return inWriteTransaction(exec, async () => {
    const id = await setCurrentStateValueCore(exec, input);
    await bumpDataRevisionCore(exec);
    return id;
  });
}
