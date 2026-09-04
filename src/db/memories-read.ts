/** Read choke point for live typed Memories. */
import type { SqlExecutor } from "@/db/types";

export interface MemoryRow {
  id: number;
  uid: string;
  contact_id: number;
  type: string;
  custom_label: string | null;
  value: string | null;
  note: string | null;
  url: string | null;
  meaningful_date: string | null;
  pinned: number;
  outdated: number;
  hidden: number | null;
  provenance: string;
  created_at: string;
  modified_at: string;
}

const LIST_MEMORIES_FOR_CONTACT = `
SELECT id, uid, contact_id, type, custom_label, value, note, url,
       meaningful_date, pinned, outdated, hidden, provenance, created_at, modified_at
  FROM memories
 WHERE contact_id = ? AND deleted_at IS NULL
 ORDER BY pinned DESC,
          CASE WHEN meaningful_date IS NULL THEN 1 ELSE 0 END ASC,
          meaningful_date DESC,
          created_at DESC,
          id DESC`;

/** Return a contact's live Memories with deterministic glanceable ordering. */
export function listMemoriesForContact(
  exec: SqlExecutor,
  contactId: number,
): Promise<MemoryRow[]> {
  return exec.getAllAsync<MemoryRow>(LIST_MEMORIES_FOR_CONTACT, [contactId]);
}
