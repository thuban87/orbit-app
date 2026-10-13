/**
 * Read-only projections for Last Talked About / Current Location (KNOW-03).
 *
 * Since migration 033 the table has no "current" flag (D-45). Most Recent is
 * simply the first row in date order (D-51, D-53): the latest `entry_date`,
 * then within a day `entry_time` where present, else the creation time, else
 * the id. Every reader of the order goes through `currentStateOrderSql()` so
 * the rule lives in one place.
 */
import {
  type CurrentStateFieldKey,
  isCurrentStateFieldKey,
} from "@/db/memory-registry";
import type { SqlExecutor } from "@/db/types";

/** One stored Last Talked About / Current Location entry. */
export interface CurrentStateEntryRow {
  id: number;
  uid: string;
  contact_id: number;
  field_key: string;
  value: string;
  /** Local `YYYY-MM-DD` the entry is about (D-41). */
  entry_date: string;
  /** `HH:MM:SS` for a linked entry; NULL for a direct entry (D-48). */
  entry_time: string | null;
  url: string | null;
  interaction_id: number | null;
  link_source: string | null;
  /** D-102 Group Note copy marker. */
  group_note_copy: number;
  /** D-108 share-origin marker. */
  from_share: number;
  created_at: string;
  modified_at: string;
}

/**
 * Every column a reader needs (convergence c10): the row type alone does not
 * put a column into the result.
 */
const ENTRY_PROJECTION = `id, uid, contact_id, field_key, value, entry_date, entry_time, url, interaction_id, link_source, group_note_copy, from_share, created_at, modified_at`;

const ORDER_ALIAS = /^[a-z_][a-z0-9_]*$/;

/**
 * The one current-state order (D-45, D-51, D-53), newest first. `entry_time`
 * and `substr(created_at,12,8)` are both `HH:MM:SS`, so the COALESCE compares
 * like with like. Pass the table alias in a joined query, where a bare `id` or
 * `created_at` would be ambiguous (convergence c1 F-D9). The alias is a code
 * literal, never user input; anything else throws.
 */
export function currentStateOrderSql(alias?: string): string {
  if (alias !== undefined && !ORDER_ALIAS.test(alias)) {
    throw new Error(`currentStateOrderSql: invalid alias ${String(alias)}`);
  }
  const p = alias === undefined ? "" : `${alias}.`;
  return `${p}entry_date DESC, COALESCE(${p}entry_time, substr(${p}created_at,12,8)) DESC, ${p}id DESC`;
}

/** The Most Recent entry for one field, or null when the field is empty. */
export function getCurrentStateValue(
  exec: SqlExecutor,
  contactId: number,
  fieldKey: CurrentStateFieldKey,
): Promise<CurrentStateEntryRow | null> {
  return exec.getFirstAsync<CurrentStateEntryRow>(
    `SELECT ${ENTRY_PROJECTION}
       FROM current_state_entries
      WHERE contact_id = ? AND field_key = ?
      ORDER BY ${currentStateOrderSql()}
      LIMIT 1`,
    [contactId, fieldKey],
  );
}

/**
 * The Most Recent entry of every field for a contact in one query. Malformed
 * stored keys are left out of the map but never changed on disk.
 */
export async function getCurrentStateValues(
  exec: SqlExecutor,
  contactId: number,
): Promise<Partial<Record<CurrentStateFieldKey, CurrentStateEntryRow>>> {
  const rows = await exec.getAllAsync<CurrentStateEntryRow>(
    `SELECT ${ENTRY_PROJECTION}
       FROM (
         SELECT ${ENTRY_PROJECTION},
                ROW_NUMBER() OVER (
                  PARTITION BY field_key
                  ORDER BY ${currentStateOrderSql()}
                ) AS rank_in_field
           FROM current_state_entries
          WHERE contact_id = ?
       )
      WHERE rank_in_field = 1`,
    [contactId],
  );
  const values: Partial<Record<CurrentStateFieldKey, CurrentStateEntryRow>> =
    {};
  for (const row of rows) {
    if (isCurrentStateFieldKey(row.field_key)) {
      values[row.field_key] = row;
    }
  }
  return values;
}

/**
 * Every entry of one field, in the current-state order (Most Recent first).
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
      ORDER BY ${currentStateOrderSql()}`,
    [contactId, fieldKey],
  );
}
