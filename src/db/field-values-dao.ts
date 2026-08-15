/**
 * Per-contact custom-value data access (FLD-01 / FLD-07).
 *
 * A custom field's data is ONE column per field on `contact_custom_values`, with
 * ONE row per contact (`contact_id` PK). This module owns:
 *   - reading a contact's values with a dynamic (whitelist-built) SELECT,
 *   - UPSERTing a single value keyed on `contact_id`,
 *   - the three pure placement selectors from HANDOFF §14.7 (profile / create /
 *     edit form) that Phase 4's forms + profile call with already-loaded data.
 *
 * =============================================================================
 * INJECTION SURFACE (T-03-01 / T-03-04): `col_name` is the ONE identifier this
 *   module interpolates — identifiers cannot be `?`-bound. Every col_name is
 *   guarded by `isSafeColName` and double-quoted before it reaches SQL; a name
 *   that somehow bypassed `makeColName` still cannot inject. EVERY runtime value
 *   (contactId / uid / value / now) is a bound `?` parameter, never interpolated.
 * =============================================================================
 *
 * WRITE SERIALIZATION (review HIGH-2a): `upsertValue` runs inside the shared
 *   `inWriteTransaction` (the ONE mutex the recency writers, the def-metadata
 *   writers, and the launch-sweep/DDL all share on the single connection). A bare
 *   UPSERT would race the sweep's in-flight drop transaction and could be captured
 *   into it — routing through the one boundary is a stated design contract
 *   (mutex.ts header), not a nicety.
 *
 * UID CONTRACT (review MED): `uid` is the `contact_custom_values` ROW uid — ONE
 *   per CONTACT (the row's `uid TEXT NOT NULL UNIQUE` merge key), NOT one per
 *   field. It is written on the INSERT branch ONLY; the `ON CONFLICT(contact_id)
 *   DO UPDATE` branch NEVER touches uid. Callers MUST mint a per-contact uid once
 *   (e.g. `newUid()` per contact) — a per-FIELD uid would make a second contact's
 *   INSERT collide on `UNIQUE(uid)`, and because that constraint is NOT the
 *   `ON CONFLICT(contact_id)` target, SQLite RAISES instead of taking the DO
 *   UPDATE branch and the save fails outright. Phase 4's contact-create is the
 *   PRIMARY creator of this row; `upsertValue` is safe when the row is absent (it
 *   INSERTs with the supplied per-contact uid on the first custom value) but must
 *   be given the contact's OWN uid, never a fresh one per write.
 *
 * Node-pure: takes `exec: SqlExecutor`; imports the shared `inWriteTransaction`.
 */
import { isSafeColName } from "@/db/col-name";
import type { CustomFieldDef } from "@/db/field-types";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

/** Throw at the interpolation boundary — a bad col_name is a bug, never input. */
function assertSafeCol(colName: string): void {
  if (!isSafeColName(colName)) {
    throw new Error(`unsafe custom-field col_name: ${JSON.stringify(colName)}`);
  }
}

/**
 * Read a contact's custom values as a `col_name → value` map. The SELECT column
 * list is built ONLY from `isSafeColName`-guarded, double-quoted col_names;
 * `contactId` is `?`-bound.
 *
 * Returns `{}` immediately for an EMPTY `defs` array (review LOW): otherwise the
 * column list is empty and the statement becomes a malformed
 * `SELECT  FROM contact_custom_values WHERE contact_id = ?` — a syntax error
 * reachable on a fresh install with zero custom fields. Also returns `{}` when
 * the contact has no `contact_custom_values` row yet.
 */
export async function getValuesForContact(
  exec: SqlExecutor,
  contactId: number,
  defs: CustomFieldDef[],
): Promise<Record<string, string | null>> {
  if (defs.length === 0) {
    return {};
  }
  const cols = defs.map((d) => {
    assertSafeCol(d.col_name);
    return `"${d.col_name}"`;
  });
  const row = await exec.getFirstAsync<Record<string, string | null>>(
    `SELECT ${cols.join(", ")} FROM contact_custom_values WHERE contact_id = ?`,
    [contactId],
  );
  if (!row) {
    return {};
  }
  const out: Record<string, string | null> = {};
  for (const d of defs) {
    out[d.col_name] = row[d.col_name] ?? null;
  }
  return out;
}

/**
 * UPSERT a single custom value for a contact, keyed on `contact_id` (one row per
 * contact). Runs inside `inWriteTransaction` (serialized with the DDL/sweep).
 *
 * INSERT-or-UPDATE via `ON CONFLICT(contact_id) DO UPDATE`. `modified_at` is
 * ALWAYS bumped (the Phase-16 newest-wins merge depends on it). `col_name` is the
 * ONLY interpolated identifier (guarded + double-quoted); `contactId` / `uid` /
 * `value` / `now` are all `?`-bound. `uid` is written on INSERT only — the DO
 * UPDATE branch never rewrites it (see the UID CONTRACT in the module header).
 */
export function upsertValue(
  exec: SqlExecutor,
  contactId: number,
  uid: string,
  colName: string,
  value: string | null,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    assertSafeCol(colName);
    const col = `"${colName}"`;
    await exec.runAsync(
      `INSERT INTO contact_custom_values (contact_id, uid, modified_at, ${col})
       VALUES (?, ?, ?, ?)
       ON CONFLICT(contact_id) DO UPDATE
         SET ${col} = excluded.${col}, modified_at = excluded.modified_at`,
      [contactId, uid, now, value],
    );
  });
}
