/**
 * Shared shell contact-picker read (SHELL-10).
 *
 * This is a local, read-only static query: it opens no transaction, takes no
 * writer mutex, and performs no network work. Favourite rank is deliberately
 * used only as a membership flag; user-visible order within that band is
 * interaction recency and then name (ADR-075).
 */
import type { SqlExecutor } from "@/db/types";

export interface PickerContactRow {
  id: number;
  name: string;
  photo: string | null;
  modified_at: string;
  favourite_rank: number | null;
  last_contact: string | null;
  snooze_until: string | null;
  archived_at: string | null;
}

/**
 * Lists contacts for the reusable shell picker. Archived records participate
 * only while the caller has an explicit non-empty search term.
 */
export function listPickerContacts(
  exec: SqlExecutor,
  { includeArchived }: { includeArchived: boolean },
): Promise<PickerContactRow[]> {
  const query = includeArchived
    ? `SELECT id, name, photo, modified_at, favourite_rank, last_contact,
              snooze_until, archived_at
         FROM contacts
        ORDER BY (favourite_rank IS NULL),
                 (last_contact IS NULL),
                 last_contact DESC,
                 name COLLATE NOCASE ASC`
    : `SELECT id, name, photo, modified_at, favourite_rank, last_contact,
              snooze_until, archived_at
         FROM contacts
        WHERE archived_at IS NULL
        ORDER BY (favourite_rank IS NULL),
                 (last_contact IS NULL),
                 last_contact DESC,
                 name COLLATE NOCASE ASC`;

  return exec.getAllAsync<PickerContactRow>(query);
}
