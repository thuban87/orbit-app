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

export interface PromoteToCurrentValueInput {
  contactId: number;
  fieldKey: CurrentStateFieldKey;
  targetId: number;
  now: string;
}

export interface EditHistoryEntryInput {
  contactId: number;
  fieldKey: CurrentStateFieldKey;
  entryId: number;
  value: string;
  now: string;
}

function assertMeaningfulValue(value: string): void {
  if (value.trim().length === 0) {
    throw new Error("current-state-history-dao: value must not be blank");
  }
}

function assertOneChange(op: string, changes: number): void {
  if (changes !== 1) {
    throw new Error(`${op}: no current-state entry matched (changed ${changes})`);
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
  if (!isCurrentStateFieldKey(input.fieldKey)) {
    throw new Error("current-state-history-dao: unknown field_key");
  }
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

/**
 * Promote a historical entry to current while preserving the former current row.
 * The target update asserts the id belongs to the requested contact and field, so
 * a wrong target rolls back the preceding demotion instead of corrupting state.
 */
export async function promoteToCurrentValueCore(
  exec: SqlExecutor,
  input: PromoteToCurrentValueInput,
): Promise<void> {
  if (!isCurrentStateFieldKey(input.fieldKey)) {
    throw new Error("current-state-history-dao: unknown field_key");
  }

  await exec.runAsync(
    `UPDATE current_state_entries
        SET is_current = 0, modified_at = ?
      WHERE contact_id = ? AND field_key = ? AND is_current = 1`,
    [input.now, input.contactId, input.fieldKey],
  );
  const promoted = await exec.runAsync(
    `UPDATE current_state_entries
        SET is_current = 1, modified_at = ?
      WHERE id = ? AND contact_id = ? AND field_key = ?`,
    [input.now, input.targetId, input.contactId, input.fieldKey],
  );
  assertOneChange("promoteToCurrentValue", promoted.changes);
}

/** Promote one retained entry inside a single, revision-bumping write. */
export function promoteToCurrentValue(
  exec: SqlExecutor,
  input: PromoteToCurrentValueInput,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await promoteToCurrentValueCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}

/**
 * Update a retained value in place. The three-key scope intentionally fails
 * closed if a route's field key does not match the supplied entry id.
 */
export async function editHistoryEntryCore(
  exec: SqlExecutor,
  input: EditHistoryEntryInput,
): Promise<void> {
  if (!isCurrentStateFieldKey(input.fieldKey)) {
    throw new Error("current-state-history-dao: unknown field_key");
  }
  assertMeaningfulValue(input.value);

  const updated = await exec.runAsync(
    `UPDATE current_state_entries
        SET value = ?, modified_at = ?
      WHERE id = ? AND contact_id = ? AND field_key = ?`,
    [
      input.value,
      input.now,
      input.entryId,
      input.contactId,
      input.fieldKey,
    ],
  );
  assertOneChange("editHistoryEntry", updated.changes);
}

/** Edit a single current or historical value without changing its current flag. */
export function editHistoryEntry(
  exec: SqlExecutor,
  input: EditHistoryEntryInput,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await editHistoryEntryCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}
