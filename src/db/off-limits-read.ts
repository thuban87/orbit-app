/**
 * Off Limits read (Phase 38.10, D-09, D-36).
 *
 * The owner-facing list of a contact's Off Limits entries. There is no AI
 * projection of this table and there must never be one (D-09). Legacy
 * contentless rows (copied as-is by migration 033, D-97) are returned too.
 * Pure read: no transaction, `contact_id` is the only bound value.
 */
import type { ReadOnlyExecutor } from "@/db/transaction";

export interface OffLimitsRow {
  id: number;
  uid: string;
  contact_id: number;
  label: string | null;
  text: string | null;
  url: string | null;
  /** D-102 Group Note copy marker (nothing renders it yet). */
  group_note_copy: number;
  /** D-108 share-origin marker (nothing renders it yet). */
  from_share: number;
  created_at: string;
  modified_at: string;
}

const LIST_OFF_LIMITS_FOR_CONTACT = `
SELECT id, uid, contact_id, label, text, url, group_note_copy, from_share,
       created_at, modified_at
  FROM off_limits
 WHERE contact_id = ?
 ORDER BY created_at DESC, id DESC`;

/** A contact's Off Limits entries, newest first. */
export function listOffLimitsForContact(
  exec: ReadOnlyExecutor,
  contactId: number,
): Promise<OffLimitsRow[]> {
  return exec.getAllAsync<OffLimitsRow>(LIST_OFF_LIMITS_FOR_CONTACT, [
    contactId,
  ]);
}
