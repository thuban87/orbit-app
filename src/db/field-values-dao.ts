/**
 * Per-contact normalized custom-value data access (FLD-01 / FLD-07).
 *
 * Values are immutable-identity rows in `custom_field_values`, keyed by the
 * literal `(contact_id, field_def_id)` pair. `col_name` remains an output-only
 * compatibility key: this module never interpolates or quotes it into SQL.
 * Every runtime SQL value is bound. The public writer owns the shared mutex;
 * its Core counterpart is deliberately non-mutexed for an existing transaction.
 */
import type { CustomFieldDef } from "@/db/field-types";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

/**
 * Return a `col_name → value` projection for exactly the definitions supplied
 * by the caller. The literal join prevents quarantined/non-shared definitions
 * from leaking when their caller does not include them in `defs`.
 */
export async function getValuesForContact(
  exec: SqlExecutor,
  contactId: number,
  defs: CustomFieldDef[],
): Promise<Record<string, string | null>> {
  if (defs.length === 0) return {};

  const placeholders = defs.map(() => "?").join(", ");
  const rows = await exec.getAllAsync<{ col_name: string; value: string | null }>(
    `SELECT defs.col_name, values_table.value
       FROM custom_field_values AS values_table
       JOIN custom_field_defs AS defs ON defs.id = values_table.field_def_id
      WHERE values_table.contact_id = ?
        AND values_table.field_def_id IN (${placeholders})`,
    [contactId, ...defs.map((definition) => definition.id)],
  );

  return Object.fromEntries(rows.map((row) => [row.col_name, row.value]));
}

/**
 * UPSERT a current value pair under the shared write mutex. `uid` and
 * `created_at` belong exclusively to the INSERT branch; clearing writes NULL
 * through the same statement and retains the pair row.
 */
export function upsertValue(
  exec: SqlExecutor,
  contactId: number,
  fieldDefId: number,
  uid: string,
  value: string | null,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    // Production edit history is composed in updateContactFull before this pure
    // primitive overwrites a pair. Keeping this wrapper history-free preserves
    // create-time null seeding and first-set semantics.
    await upsertValueCore(exec, contactId, fieldDefId, uid, value, now);
    await bumpDataRevisionCore(exec);
  });
}

/**
 * Reject a second contact from claiming a directly-present contact-scoped def.
 * This defense-in-depth marker is unreachable through the public 24.2 creator;
 * Phase 31 will pair scoped creation with durable ownership and edit filtering.
 */
export async function assertContactScopedWriteAllowedCore(
  exec: SqlExecutor,
  contactId: number,
  fieldDefId: number,
): Promise<void> {
  const def = await exec.getFirstAsync<{ scope: string }>(
    "SELECT scope FROM custom_field_defs WHERE id = ?",
    [fieldDefId],
  );
  if (def?.scope !== "contact") return;
  const own = await exec.getFirstAsync<{ one: number }>(
    `SELECT 1 AS one FROM custom_field_values
      WHERE contact_id = ? AND field_def_id = ? LIMIT 1`,
    [contactId, fieldDefId],
  );
  if (own) return;
  const another = await exec.getFirstAsync<{ one: number }>(
    `SELECT 1 AS one FROM custom_field_values
      WHERE contact_id != ? AND field_def_id = ? LIMIT 1`,
    [contactId, fieldDefId],
  );
  if (another) {
    throw new Error(
      `contact-scoped custom field ${fieldDefId} belongs to a different contact`,
    );
  }
}

/**
 * Non-mutexed transaction body for composition by callers which already own a
 * single outer `inWriteTransaction`. Never wrap this Core call in another
 * transaction: the shared mutex is non-reentrant.
 */
export function upsertValueCore(
  exec: SqlExecutor,
  contactId: number,
  fieldDefId: number,
  uid: string,
  value: string | null,
  now: string,
): Promise<void> {
  return exec
    .runAsync(
      `INSERT INTO custom_field_values (
         uid, contact_id, field_def_id, value, created_at, modified_at
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(contact_id, field_def_id) DO UPDATE
         SET value = excluded.value, modified_at = excluded.modified_at`,
      [uid, contactId, fieldDefId, value, now, now],
    )
    .then(() => undefined);
}

// --- Pure visibility selectors (HANDOFF §14.7) -------------------------------
//
// The three surfaces where a custom field can appear. All are PURE functions
// over an already-loaded defs list (+ a value map for the profile), so Phase 4's
// forms and profile call them with data they already hold — NO DB access. A
// QUARANTINED field (quarantined_at set) is excluded from ALL THREE. There is NO
// per-profile view configuration or per-profile exception — that was explicitly
// dropped/declined (03-CONTEXT.md "Where fields appear"). Each returns a new
// array ordered by display_order; the input array is never mutated.

/** A field is live (usable on a surface) when it is not quarantined. */
function isLive(d: CustomFieldDef): boolean {
  return d.quarantined_at === null;
}

/** Order a filtered def list by display_order without mutating the input. */
function byDisplayOrder(defs: CustomFieldDef[]): CustomFieldDef[] {
  return [...defs].sort((a, b) => a.display_order - b.display_order);
}

/**
 * Create-contact form: only `show_on_new` (and non-quarantined) fields, ordered
 * by display_order (§14.7).
 */
export function defsForCreateForm(defs: CustomFieldDef[]): CustomFieldDef[] {
  return byDisplayOrder(defs.filter((d) => isLive(d) && d.show_on_new === 1));
}

/**
 * Edit form: EVERY non-quarantined field, ordered by display_order. There is NO
 * curation config on the edit surface (§14.7) — editing an existing contact can
 * touch any live field.
 */
export function defsForEditForm(defs: CustomFieldDef[]): CustomFieldDef[] {
  return byDisplayOrder(defs.filter(isLive));
}

/**
 * Profile: a non-quarantined field shows when `always_show` is set OR the value
 * map holds a non-null value for its col_name (§14.7). An empty, non-always_show
 * field is hidden. Ordered by display_order.
 */
export function visibleDefsForProfile(
  defs: CustomFieldDef[],
  values: Record<string, string | null>,
): CustomFieldDef[] {
  return byDisplayOrder(
    defs.filter(
      (d) => isLive(d) && (d.always_show === 1 || values[d.col_name] != null),
    ),
  );
}
