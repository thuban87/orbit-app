/** Read choke point for live structured contact relationships. */
import { RELATIONSHIPS_GROUP } from "@/db/memory-registry";
import type { SqlExecutor } from "@/db/types";

export interface RelationshipRow {
  id: number;
  uid: string;
  contact_id: number;
  person_name: string;
  relation_type: string | null;
  linked_contact_id: number | null;
  linked_contact_name: string | null;
  note: string | null;
  pinned: number;
  hidden: number | null;
  created_at: string;
  modified_at: string;
  deleted_at: string | null;
}

const LIST_RELATIONSHIPS_FOR_CONTACT = `
SELECT r.id, r.uid, r.contact_id, r.person_name, r.relation_type,
       r.linked_contact_id, c.name AS linked_contact_name, r.note, r.pinned,
       r.hidden, r.created_at, r.modified_at, r.deleted_at
  FROM relationships r
  LEFT JOIN contacts c ON c.id = r.linked_contact_id
 WHERE r.contact_id = ? AND r.deleted_at IS NULL
 ORDER BY r.pinned DESC, r.created_at DESC, r.id DESC`;

/** List a contact's live Key People rows with their optional linked contact name. */
export function listRelationshipsForContact(
  exec: SqlExecutor,
  contactId: number,
): Promise<RelationshipRow[]> {
  return exec.getAllAsync<RelationshipRow>(LIST_RELATIONSHIPS_FOR_CONTACT, [contactId]);
}

/** Resolve a Key People item's Profile presentation preference, never privacy. */
export function resolveRelationshipVisibility(hidden: number | null): "show" | "hide" {
  if (hidden === 1) return "hide";
  if (hidden === 0) return "show";
  return RELATIONSHIPS_GROUP.visibilityDefault;
}
