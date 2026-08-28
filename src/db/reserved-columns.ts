/**
 * Reserved fixed-column whitelist (FLD-02, T-03-06) — the set of identifiers a
 * custom `col_name` may NEVER equal.
 *
 * `col_name` remains a compatibility and filename key. `makeColName`
 * (col-name.ts) uniquifies every produced name against THIS set so a custom
 * field can never shadow a fixed column such as `tracking_enabled` or the
 * normalized value-table's own literal columns.
 *
 * SOURCE OF TRUTH: transcribed from the v11 literal schema —
 *   • every column of `contacts` (migration 011)
 *   • every column of `custom_field_values` (migration 006)
 *   • the SQLite rowid aliases (rowid, oid, _rowid_), which name the same hidden
 *     column and would collide silently.
 *
 * DRIFT GUARD: this list is transcribed by hand, so reserved-columns.test.ts runs
 * migrations 001 through 011 and asserts this set is a SUPERSET of the live
 * `PRAGMA table_info` column names. If a future migration adds a fixed column and
 * this whitelist is not updated, that test fails loudly rather than allowing a
 * silent name collision.
 *
 * Node-pure: no expo/react-native import.
 */

/**
 * Every fixed column of `contacts` (migration 011).
 * Transcribed verbatim, in DDL order.
 */
const CONTACTS_COLUMNS: readonly string[] = [
  "id",
  "uid",
  "name",
  "category_id",
  "interval_days",
  "tracking_enabled",
  "social_battery",
  "birthday",
  "photo",
  "last_contact",
  "favourite_rank",
  "ring_seq",
  "archived_at",
  "snooze_until",
  "rarely_responds",
  "reminders_off",
  "created_at",
  "modified_at",
];

/**
 * The literal columns of `custom_field_values` (migration 006). This table no
 * longer contains one dynamic schema column per custom definition.
 */
const CUSTOM_FIELD_VALUES_COLUMNS: readonly string[] = [
  "id",
  "uid",
  "contact_id",
  "field_def_id",
  "value",
  "created_at",
  "modified_at",
];

/**
 * SQLite rowid aliases — every table has these hidden names, and a value column
 * declared with any of them would collide. `PRAGMA table_info` does NOT list
 * them, so they are reserved explicitly (never surfaced by the drift test).
 */
const ROWID_ALIASES: readonly string[] = ["rowid", "oid", "_rowid_"];

/**
 * The whitelist a custom `col_name` may never equal. Lowercased because slugs
 * are always lowercase (`isSafeColName` guarantees `[a-z][a-z0-9_]*`), so a
 * case-insensitive comparison is unnecessary at the collision check.
 */
export const RESERVED_COLUMN_NAMES: ReadonlySet<string> = new Set<string>([
  ...CONTACTS_COLUMNS,
  ...CUSTOM_FIELD_VALUES_COLUMNS,
  ...ROWID_ALIASES,
]);
