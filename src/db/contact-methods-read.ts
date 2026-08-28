import type { ContactMethodRow } from "@/db/contact-methods-dao";
import type { SqlExecutor } from "@/db/types";

export type ContactMethodGroups = Record<"phone" | "email", ContactMethodRow[]>;

/** Ordered type groups for profile and edit-form reads. */
export async function listContactMethodGroups(
  exec: SqlExecutor,
  contactId: number,
): Promise<ContactMethodGroups> {
  const rows = await exec.getAllAsync<ContactMethodRow>(
    `SELECT id, uid, contact_id, method_type, raw_value, display_value,
            canonical_value, canonical_region, extension, is_actionable,
            is_primary, display_order, created_at, modified_at
       FROM contact_methods
      WHERE contact_id = ?
      ORDER BY method_type, display_order, id`,
    [contactId],
  );
  return {
    phone: rows.filter((row) => row.method_type === "phone"),
    email: rows.filter((row) => row.method_type === "email"),
  };
}

/**
 * Select one actionable method per type. The stored primary wins when actionable;
 * otherwise the first actionable ordered row is the effective primary.
 */
export async function listActionablePrimaryMethods(
  exec: SqlExecutor,
  contactId: number,
): Promise<{ phone: ContactMethodRow | null; email: ContactMethodRow | null }> {
  const groups = await listContactMethodGroups(exec, contactId);
  const select = (rows: ContactMethodRow[]) =>
    rows.find((row) => row.is_primary === 1 && row.is_actionable === 1) ??
    rows.find((row) => row.is_actionable === 1) ??
    null;
  return { phone: select(groups.phone), email: select(groups.email) };
}
