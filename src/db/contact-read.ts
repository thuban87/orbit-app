/**
 * Shared contact reads (CRUD-01 / CRUD-02) — the light, pure reads the
 * create/edit forms and the Profile scaffold need.
 *
 * All three are read-only (NO transaction), every value `?`-bound, no string
 * interpolation (T-04-02). Timestamps are never written here.
 *
 * Node-pure: takes `exec: SqlExecutor`.
 */
import type { SqlExecutor } from "@/db/types";

/**
 * Is `name` already used by a LIVE contact (the create/edit duplicate warning)?
 *
 * `COLLATE NOCASE` makes "chris" match "Chris" — symmetric with how a user reads
 * the warning (Pitfall 6). `archived_at IS NULL` restricts to live contacts (an
 * archived same-name row does not block reuse — mirrors STATUS_SCAN's live
 * filter). `id != ?` excludes the row itself on EDIT; on CREATE pass no
 * `excludeId` and the bound `-1` makes the self-exclusion a no-op (no row has
 * id -1). Returns whether any other live row already holds the name.
 */
export async function isDuplicateName(
  exec: SqlExecutor,
  name: string,
  excludeId?: number,
): Promise<boolean> {
  const row = await exec.getFirstAsync<{ one: number }>(
    `SELECT 1 AS one
       FROM contacts
      WHERE name = ? COLLATE NOCASE
        AND archived_at IS NULL
        AND id != ?
      LIMIT 1`,
    [name, excludeId ?? -1],
  );
  return row !== null;
}

/**
 * The seeded categories in display order — the create/edit category-picker
 * source. `?`-bound read (no params); ordered by `display_order`.
 */
export function listCategories(
  exec: SqlExecutor,
): Promise<{ id: number; name: string }[]> {
  return exec.getAllAsync<{ id: number; name: string }>(
    "SELECT id, name FROM categories ORDER BY display_order",
  );
}

/**
 * The light Profile-scaffold read (Plan 04): a by-id seek returning the header
 * fields, or null for a missing id.
 *
 * NOTE this by-id seek INTENTIONALLY does NOT filter `archived_at IS NULL`: an
 * archived contact stays loadable by id (a deep link, or a later phase) — no
 * Phase-4 surface routes to an archived profile/edit, so a blanket archived
 * filter is unnecessary here. Any NEW live/list surface must still filter
 * `archived_at IS NULL` (see the archived-read reconciliation in Plans 05/08).
 */
export function getContactHeader(
  exec: SqlExecutor,
  contactId: number,
): Promise<{
  id: number;
  name: string;
  rarely_responds: number;
  archived_at: string | null;
} | null> {
  return exec.getFirstAsync<{
    id: number;
    name: string;
    rarely_responds: number;
    archived_at: string | null;
  }>(
    "SELECT id, name, rarely_responds, archived_at FROM contacts WHERE id = ?",
    [contactId],
  );
}
