/**
 * `sortExpr()` — raw-TEXT ordering for a future normalized custom-value join.
 *
 * This is intentionally a latent, forward-looking helper: it has no runtime
 * consumer in this repository. It does not migrate or claim parity with any
 * live sort/filter surface. Its first consumer must join
 * `custom_field_values AS values_table` and constrain that join by the selected
 * definition's `field_def_id`; without that constraint an ORDER BY could use an
 * arbitrary field value or multiply contact rows.
 *
 * The emitted expression always refers to the literal `values_table.value`
 * column. `field.col_name` remains compatibility metadata for audit/history
 * paths and is never read to construct SQL here. The only type-specific logic
 * is static: numbers cast raw TEXT to REAL, toggles cast raw TEXT to INTEGER,
 * and every other type retains raw TEXT ordering. Parsers are deliberately not
 * duplicated in SQL, so unusual historic bytes retain the existing raw-TEXT
 * ordering behavior until a person repairs them through the normal UI.
 */
import type { CustomFieldDef } from "@/db/field-types";

const NORMALIZED_VALUE_COLUMN = "values_table.value";

/**
 * Build the static ORDER BY / filter expression for the literal normalized
 * value column. Future callers must use the `values_table` alias and constrain
 * `field_def_id` in its join. `col_name` is accepted solely as compatibility
 * metadata on a field definition; it never reaches the generated SQL.
 */
export function sortExpr(
  field: Pick<CustomFieldDef, "col_name" | "type">,
): string {
  switch (field.type) {
    case "number":
      return `CAST(${NORMALIZED_VALUE_COLUMN} AS REAL)`;
    case "toggle":
      return `CAST(${NORMALIZED_VALUE_COLUMN} AS INTEGER)`;
    default:
      return NORMALIZED_VALUE_COLUMN;
  }
}
