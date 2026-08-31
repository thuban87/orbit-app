import type { SqlExecutor } from "@/db/types";

export interface MergeCandidate { id: number; name: string; photo: string | null }

/** Every live contact is eligible for a profile-initiated merge, Bound or Unbound. */
export function listMergeCandidates(exec: SqlExecutor, excludeContactId: number): Promise<MergeCandidate[]> {
  return exec.getAllAsync<MergeCandidate>(
    `SELECT id, name, photo FROM contacts
      WHERE archived_at IS NULL AND id <> ?
      ORDER BY (favourite_rank IS NULL), favourite_rank ASC, name COLLATE NOCASE, id`,
    [excludeContactId],
  );
}
