/** Read-only projections for retained current-state values (KNOW-03). */
import {
  isCurrentStateFieldKey,
  type CurrentStateFieldKey,
} from "@/db/memory-registry";
import type { SqlExecutor } from "@/db/types";

/** A current-state row, including its status in the retained backlist. */
export interface CurrentStateEntryRow {
  id: number;
  uid: string;
  contact_id: number;
  field_key: string;
  value: string;
  is_current: number;
  created_at: string;
  modified_at: string;
}

const ENTRY_PROJECTION = `id, uid, contact_id, field_key, value, is_current, created_at, modified_at`;

/** Read the one current value for a registered contact field, or null when empty. */
export function getCurrentStateValue(
  exec: SqlExecutor,
  contactId: number,
  fieldKey: CurrentStateFieldKey,
): Promise<CurrentStateEntryRow | null> {
  return exec.getFirstAsync<CurrentStateEntryRow>(
    `SELECT ${ENTRY_PROJECTION}
       FROM current_state_entries
      WHERE contact_id = ? AND field_key = ? AND is_current = 1
      LIMIT 1`,
    [contactId, fieldKey],
  );
}

/**
 * Read every current value for a contact in one query. Malformed historical keys
 * are intentionally omitted from the surfaced map but never changed on disk.
 */
export async function getCurrentStateValues(
  exec: SqlExecutor,
  contactId: number,
): Promise<Partial<Record<CurrentStateFieldKey, CurrentStateEntryRow>>> {
  const rows = await exec.getAllAsync<CurrentStateEntryRow>(
    `SELECT ${ENTRY_PROJECTION}
       FROM current_state_entries
      WHERE contact_id = ? AND is_current = 1`,
    [contactId],
  );
  const values: Partial<Record<CurrentStateFieldKey, CurrentStateEntryRow>> = {};
  for (const row of rows) {
    if (isCurrentStateFieldKey(row.field_key)) {
      values[row.field_key] = row;
    }
  }
  return values;
}

/**
 * Read a field's complete retained history, newest creation first.
 *
 * Accepts a read-only surface (`getAllAsync` only) so read-layer callers such as
 * `history-read` can compose it without holding a writable executor — this is a
 * pure SELECT, no transaction.
 */
export function getCurrentStateHistory(
  exec: Pick<SqlExecutor, "getAllAsync">,
  contactId: number,
  fieldKey: CurrentStateFieldKey,
): Promise<CurrentStateEntryRow[]> {
  return exec.getAllAsync<CurrentStateEntryRow>(
    `SELECT ${ENTRY_PROJECTION}
       FROM current_state_entries
      WHERE contact_id = ? AND field_key = ?
      ORDER BY created_at DESC, id DESC`,
    [contactId, fieldKey],
  );
}
