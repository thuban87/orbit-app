/**
 * The type-change layer (FLD-04) — the phase's most-misread requirement, made
 * safe by construction.
 *
 * =============================================================================
 * BLAST RADIUS ZERO — READ BEFORE EDITING (§14.2, CLAUDE.md invariant, T-03-02):
 *   A custom field's `type` drives the UI WIDGET only; storage is TEXT forever.
 *   Changing a field's type is therefore ONE `UPDATE custom_field_defs SET type`
 *   and touches `contact_custom_values` NOT AT ALL. There is no ALTER COLUMN, no
 *   value normalization, no "convert" pass over the value column. "Auto-convert
 *   clean values" means the clean values are ALREADY VALID under the new type and
 *   render/sort correctly at read time (via the widget + `sortExpr`); an
 *   unconvertible value renders a tap-to-fix error state on the profile. Nothing
 *   is coerced or cleared — a byte-identical-values test forbids any value write.
 * =============================================================================
 *
 * Two read-only pre-flights + one apply:
 *   • `preflightTypeChange` runs the TARGET parser (`parsers[target]`) over every
 *     stored value and partitions contacts into `convert` (parse-clean under the
 *     new type) vs `flag` (unconvertible → tap-to-fix). This produces the UI
 *     summary "N of M will convert automatically; K need your input" (§14.4).
 *   • `preflightOptionsChange` partitions on option-membership against the NEW
 *     options (`isValueInOptions`) — `keep` vs `flag` — so editing a dropdown's
 *     options to exclude a stored value shows the SAME convert/flag summary and
 *     renders the same tap-to-fix state (review MED). It is the options-edit
 *     sibling of the type pre-flight; the actual `UPDATE options` lives in
 *     `changeFieldOptions` (field-defs-dao.ts), NOT here.
 *   • `applyTypeChange` writes a same-transaction `field_history` audit snapshot
 *     of the pre-change state, then `UPDATE custom_field_defs SET type` — the
 *     ENTIRE write (§14.6: snapshot before a destructive op, in one transaction).
 *
 * Both pre-flights are STRICTLY READ-ONLY: no BEGIN, no write, no transaction.
 *
 * FIELD_HISTORY HAS NO TYPE COLUMN (001-initial.ts:155-163 — contact_id,
 * field_col_name, old_value, operation, created_at). A type change leaves values
 * byte-identical, so `old_value` alone carries zero recoverable type info. The
 * transition is therefore encoded in the free-text `operation`
 * (`type_change:<old>-><new>`, e.g. `type_change:number->text`) so the snapshot
 * records WHAT changed. This is an audit trail; no undo surface is built here.
 *
 * SECURITY (T-03-01): `col_name` is the ONLY interpolated identifier (identifiers
 * cannot be `?`-bound). It is guarded by `isSafeColName` and double-quoted at
 * every interpolation site; every runtime value is a bound `?`.
 *
 * Node-pure control flow: takes `exec: SqlExecutor` and imports the shared
 * `inWriteTransaction` — never expo `withTransactionAsync`.
 */
import { isSafeColName } from "@/db/col-name";
import { isValueInOptions, parsers } from "@/db/field-parsers";
import type { CustomFieldDef } from "@/db/field-types";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import type { FieldType } from "@/schemas/types";

/**
 * Guard-then-quote a col_name for interpolation. Defence in depth: even a name
 * that bypassed `makeColName` cannot reach SQL — a bad name throws BEFORE any
 * read/write.
 */
function quoteCol(colName: string): string {
  if (!isSafeColName(colName)) {
    throw new Error(`unsafe custom-field col_name: ${JSON.stringify(colName)}`);
  }
  return `"${colName}"`;
}

/** One stored value keyed by its owning contact. */
interface ValueRow {
  contact_id: number;
  value: string | null;
}

/**
 * Read every non-null stored value for a field as `{ contact_id, value }` rows.
 * `col_name` is guarded + double-quoted (the ONE interpolated identifier); no
 * transaction is opened — this is the read the pre-flights share.
 */
function readValues(exec: SqlExecutor, colName: string): Promise<ValueRow[]> {
  const col = quoteCol(colName);
  return exec.getAllAsync<ValueRow>(
    `SELECT contact_id, ${col} AS value
       FROM contact_custom_values
      WHERE ${col} IS NOT NULL`,
  );
}

/**
 * READ-ONLY type-change pre-flight (FLD-04). Runs `parsers[target]` over every
 * stored value and partitions the owning contact_ids into `convert` (parse-clean
 * under the new type — renders/sorts correctly, no rewrite needed) vs `flag`
 * (unconvertible → the tap-to-fix error state). Writes NOTHING and opens no
 * transaction; this only produces the UI summary. The actual change is
 * `applyTypeChange`.
 */
export async function preflightTypeChange(
  exec: SqlExecutor,
  field: Pick<CustomFieldDef, "col_name">,
  target: FieldType,
): Promise<{ total: number; convert: number[]; flag: number[] }> {
  const rows = await readValues(exec, field.col_name);
  const parse = parsers[target];
  const convert: number[] = [];
  const flag: number[] = [];
  for (const row of rows) {
    if (parse(row.value).ok) {
      convert.push(row.contact_id);
    } else {
      flag.push(row.contact_id);
    }
  }
  return { total: rows.length, convert, flag };
}

/**
 * READ-ONLY options-change pre-flight (review MED). The dropdown-options sibling
 * of `preflightTypeChange`: editing a dropdown's options to EXCLUDE a stored
 * value must show the SAME convert/flag summary and render out-of-list values as
 * the same tap-to-fix state. Partitions the owning contact_ids on
 * `isValueInOptions({ type: 'dropdown', options: nextOptions }, value)` — `keep`
 * (still a member of the NEW options) vs `flag` (excluded by the edit). Writes
 * NOTHING and opens no transaction; Plan 08 runs this before committing an
 * options edit, and `changeFieldOptions` performs the actual `UPDATE options`.
 */
export async function preflightOptionsChange(
  exec: SqlExecutor,
  field: Pick<CustomFieldDef, "col_name">,
  nextOptions: string | null,
): Promise<{ total: number; keep: number[]; flag: number[] }> {
  const rows = await readValues(exec, field.col_name);
  const keep: number[] = [];
  const flag: number[] = [];
  for (const row of rows) {
    if (
      isValueInOptions({ type: "dropdown", options: nextOptions }, row.value)
    ) {
      keep.push(row.contact_id);
    } else {
      flag.push(row.contact_id);
    }
  }
  return { total: rows.length, keep, flag };
}

/**
 * Apply a type change (FLD-04): the ENTIRE write is a same-transaction
 * `field_history` audit snapshot of the pre-change state PLUS
 * `UPDATE custom_field_defs SET type`. `contact_custom_values` is NEVER touched —
 * no value is rewritten, cleared, or normalized (blast radius zero, §14.2 /
 * T-03-02). There is NO separate confirmation prompt beyond the pre-flight
 * summary (§14.4).
 *
 * The signature carries `field.type` — the CURRENT (pre-change) type — because
 * `field_history` has no type column, so the transition is recorded in the
 * `operation` string (`type_change:<old>-><new>`). Inside ONE
 * `inWriteTransaction`:
 *   (a) INSERT one field_history row per contact with a non-null value —
 *       col_name, the current (pre-change) old_value, operation
 *       `type_change:${field.type}->${target}`, and `now`;
 *   (b) UPDATE the def's `type` (and `modified_at`).
 * Unconvertible values remain, flagged at read time — never coerced or cleared.
 */
export function applyTypeChange(
  exec: SqlExecutor,
  field: Pick<CustomFieldDef, "id" | "col_name" | "type">,
  target: FieldType,
  now: string,
): Promise<void> {
  const col = quoteCol(field.col_name);
  const operation = `type_change:${field.type}->${target}`;
  return inWriteTransaction(exec, async () => {
    // (a) Audit snapshot of the pre-change state — the col_name is BOTH the
    //     field_col_name literal (?-bound) AND the value column read
    //     (interpolated identifier, guarded above). This is the §14.6 snapshot;
    //     the values themselves are left byte-identical.
    await exec.runAsync(
      `INSERT INTO field_history
         (contact_id, field_col_name, old_value, operation, created_at)
       SELECT contact_id, ?, ${col}, ?, ?
         FROM contact_custom_values
        WHERE ${col} IS NOT NULL`,
      [field.col_name, operation, now],
    );
    // (b) The ONLY def mutation. NO UPDATE of contact_custom_values, NO ALTER
    //     COLUMN, NO value normalization — that is the whole point (T-03-02).
    await exec.runAsync(
      "UPDATE custom_field_defs SET type = ?, modified_at = ? WHERE id = ?",
      [target, now, field.id],
    );
  });
}
