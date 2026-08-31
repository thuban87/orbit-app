import type { SqlExecutor } from "@/db/types";

export interface MergeCandidate {
  id: number;
  name: string;
  photo: string | null;
  createdAt: string;
  interactionCount: number;
  activeExternalLinkCount: number;
  completeDataCount: number;
}

const MERGE_CANDIDATE_SELECT = `SELECT c.id, c.name, c.photo, c.created_at AS createdAt,
  (SELECT COUNT(*) FROM interactions AS i WHERE i.contact_id = c.id) AS interactionCount,
  (SELECT COUNT(*) FROM external_contact_links AS e WHERE e.contact_id = c.id AND e.is_active = 1) AS activeExternalLinkCount,
  ((CASE WHEN NULLIF(TRIM(c.name), '') IS NULL THEN 0 ELSE 1 END) +
   (CASE WHEN c.birthday IS NULL THEN 0 ELSE 1 END) +
   (CASE WHEN c.category_id IS NULL THEN 0 ELSE 1 END) +
   (CASE WHEN c.photo IS NULL THEN 0 ELSE 1 END) +
   (SELECT COUNT(*) FROM custom_field_values AS v WHERE v.contact_id = c.id AND NULLIF(TRIM(COALESCE(v.value, '')), '') IS NOT NULL) +
   (SELECT COUNT(*) FROM contact_methods AS m WHERE m.contact_id = c.id AND NULLIF(TRIM(m.display_value), '') IS NOT NULL)) AS completeDataCount
  FROM contacts AS c`;

/** Every live contact is eligible for a profile-initiated merge, Bound or Unbound. */
export function listMergeCandidates(exec: SqlExecutor, excludeContactId: number): Promise<MergeCandidate[]> {
  return exec.getAllAsync<MergeCandidate>(
    `${MERGE_CANDIDATE_SELECT}
      WHERE c.archived_at IS NULL AND c.id <> ?
      ORDER BY (c.favourite_rank IS NULL), c.favourite_rank ASC, c.name COLLATE NOCASE, c.id`,
    [excludeContactId],
  );
}

export function getMergeCandidate(
  exec: SqlExecutor,
  contactId: number,
): Promise<MergeCandidate | null> {
  return exec.getFirstAsync<MergeCandidate>(
    `${MERGE_CANDIDATE_SELECT} WHERE c.id = ? AND c.archived_at IS NULL`,
    [contactId],
  );
}
