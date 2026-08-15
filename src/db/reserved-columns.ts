/**
 * Reserved fixed-column whitelist (FLD-02, T-03-06) — the set of identifiers a
 * custom `col_name` may NEVER equal.
 *
 * `col_name` is the ONE identifier this subsystem interpolates (double-quoted)
 * into SQL. `makeColName` (col-name.ts) uniquifies every produced name against
 * THIS set so a custom field can never shadow a fixed column such as `phone`,
 * `email`, or the value-table's own `contact_id`/`uid`/`modified_at`.
 *
 * SOURCE OF TRUTH: transcribed from migrations/001-initial.ts —
 *   • every column of `contacts` (CREATE_CONTACTS)
 *   • every FIXED column of `contact_custom_values` (contact_id, uid, modified_at;
 *     value columns are added dynamically in Phase 3 and are NOT reserved)
 *   • the SQLite rowid aliases (rowid, oid, _rowid_), which name the same hidden
 *     column and would collide silently.
 *
 * DRIFT GUARD: this list is transcribed by hand, so reserved-columns.test.ts runs
 * the REAL migration001 and asserts this set is a SUPERSET of the live
 * `PRAGMA table_info` column names. If a future migration adds a fixed column and
 * this whitelist is not updated, that test fails loudly rather than allowing a
 * silent name collision.
 *
 * Node-pure: no expo/react-native import.
 */

/**
 * Every fixed column of `contacts` (CREATE_CONTACTS, migrations/001-initial.ts).
 * Transcribed verbatim, in DDL order.
 */
const CONTACTS_COLUMNS: readonly string[] = [
  "id",
  "uid",
  "name",
  "category_id",
  "interval_days",
  "social_battery",
  "birthday",
  "phone",
  "email",
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
 * The FIXED columns of `contact_custom_values` (CREATE_CONTACT_CUSTOM_VALUES).
 * Value columns are added dynamically in Phase 3 and are deliberately excluded.
 */
const CONTACT_CUSTOM_VALUES_FIXED_COLUMNS: readonly string[] = [
  "contact_id",
  "uid",
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
  ...CONTACT_CUSTOM_VALUES_FIXED_COLUMNS,
  ...ROWID_ALIASES,
]);
