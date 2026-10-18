/**
 * The type-change layer (FLD-04) — the phase's most-misread requirement, made
 * safe by construction.
 *
 * =============================================================================
 * BLAST RADIUS ZERO — READ BEFORE EDITING (§14.2, CLAUDE.md invariant, T-03-02):
 *   A custom field's `type` drives the UI WIDGET only; storage is TEXT forever.
 *   Changing a field's type is therefore ONE `UPDATE custom_field_defs SET type`
 *   and touches `custom_field_values` NOT AT ALL. There is no ALTER COLUMN, no
 *   value normalization, no "convert" pass over the value column. "Auto-convert
 *   clean values" means the clean values are ALREADY VALID under the new type and
 *   render/sort correctly at read time (via the widget + `sortExpr`); an
 *   unconvertible value renders a tap-to-fix error state on the profile. Nothing
 *   is coerced or cleared — a byte-identical-values test forbids any value write.
 * =============================================================================
 *
 * Two read-only pre-flights + one apply:
 *   • `preflightTypeChange` classifies every stored value against the TARGET
 *     type AND options with `isFlaggedCustomValue` (38.12 convergence c2 B-5)
 *     and partitions contacts into `convert` (clean under the new type and
 *     options) vs `flag` (unconvertible or, for a dropdown target, not one of
 *     the new options → tap-to-fix). This produces the UI summary "N of M will
 *     convert automatically; K need your input" (§14.4).
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
 * SECURITY (T-16-08): `col_name` is compatibility metadata only. Every SQL
 * runtime value — including `field_def_id` — is bound with `?`; this module
 * never interpolates metadata into SQL.
 *
 * Node-pure control flow: takes `exec: SqlExecutor` and imports the shared
 * `inWriteTransaction` — never expo `withTransactionAsync`.
 */

import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { isFlaggedCustomValue, isValueInOptions } from "@/db/field-parsers";
import type { CustomFieldDef } from "@/db/field-types";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import type { FieldType } from "@/schemas/types";

/** One stored value keyed by its owning contact. */
interface ValueRow {
  contact_id: number;
  value: string | null;
}

/**
 * Read every non-null normalized raw value for a field as `{ contact_id, value
 * }` rows. `fieldDefId` is bound so a definition's compatibility `col_name`
 * can never influence SQL; no transaction is opened — this is the read the
 * pre-flights share.
 */
function readValues(
  exec: SqlExecutor,
  fieldDefId: number,
): Promise<ValueRow[]> {
  return exec.getAllAsync<ValueRow>(
    `SELECT contact_id, value
       FROM custom_field_values
      WHERE field_def_id = ? AND value IS NOT NULL`,
    [fieldDefId],
  );
}

/**
 * READ-ONLY type-change pre-flight (FLD-04). Classifies every stored value
 * against the TARGET type and options with `isFlaggedCustomValue` — the same
 * predicate as the Profile marker, Edit's field error and the "Review now"
 * list (38.12 D-121, convergence c2 B-5) — and partitions the owning
 * contact_ids into `convert` (clean under the new type and options — renders/
 * sorts correctly, no rewrite needed) vs `flag` (the tap-to-fix error state).
 * `parsers.dropdown` is identity, so the options are what flag a text →
 * dropdown change's out-of-list values; a dropdown target with null or
 * unreadable options flags nothing. Writes NOTHING and opens no transaction;
 * this only produces the UI summary. The actual change is `applyTypeChange`.
 */
export async function preflightTypeChange(
  exec: SqlExecutor,
  field: Pick<CustomFieldDef, "id" | "col_name">,
  target: Pick<CustomFieldDef, "type" | "options">,
): Promise<{ total: number; convert: number[]; flag: number[] }> {
  const rows = await readValues(exec, field.id);
  const convert: number[] = [];
  const flag: number[] = [];
  for (const row of rows) {
    if (!isFlaggedCustomValue(target, row.value)) {
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
  field: Pick<CustomFieldDef, "id" | "col_name">,
  nextOptions: string | null,
): Promise<{ total: number; keep: number[]; flag: number[] }> {
  const rows = await readValues(exec, field.id);
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
 * `UPDATE custom_field_defs SET type`. `custom_field_values` is NEVER touched —
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
 *   (b) UPDATE the def's `type` (and `modified_at`). A change TO photo also
 *       turns the field's Allow AI (`share_with_ai`) off in the same statement:
 *       photo fields are never sent to AI (38.12 D-129, D-138).
 * Unconvertible values remain, flagged at read time — never coerced or cleared.
 */
export function applyTypeChange(
  exec: SqlExecutor,
  field: Pick<CustomFieldDef, "id" | "col_name" | "type">,
  target: FieldType,
  now: string,
): Promise<void> {
  const operation = `type_change:${field.type}->${target}`;
  return inWriteTransaction(exec, async () => {
    // (a) Audit snapshot of the pre-change state — the col_name is BOTH the
    //     compatibility key written to field_col_name and a bound value. The
    //     normalized value row is selected solely by its bound field_def_id;
    //     values themselves are left byte-identical.
    await exec.runAsync(
      `INSERT INTO field_history
         (contact_id, field_col_name, old_value, operation, created_at)
       SELECT contact_id, ?, value, ?, ?
         FROM custom_field_values
        WHERE field_def_id = ? AND value IS NOT NULL`,
      [field.col_name, operation, now, field.id],
    );
    // (b) The ONLY def mutation. NO UPDATE of custom_field_values and no value
    //     normalization — that is the whole point (T-16-08).
    await exec.runAsync(
      `UPDATE custom_field_defs
          SET type = ?,
              share_with_ai = CASE WHEN ? = 'photo' THEN 0 ELSE share_with_ai END,
              modified_at = ?
        WHERE id = ?`,
      [target, target, now, field.id],
    );
    await bumpDataRevisionCore(exec);
  });
}
