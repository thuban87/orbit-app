/**
 * Merge review counts: what the absorbed contact brings to the survivor, as
 * the merge review screen lists it (MergeImpactSummary). A pure read — no
 * transaction. Every table name is a literal and the contact id is `?`-bound.
 *
 * Off Limits, memories, key people and current state are not listed: the
 * merge review shows the same lines it always has, minus the retired one
 * (D-87 removes lines only; a new line would be new wording for the owner).
 */
import type { SqlExecutor } from "@/db/types";

export interface MergeImpactCounts {
  interactions: number;
  events: number;
  methods: number;
  externalLinks: number;
}

async function count(
  exec: SqlExecutor,
  sql: string,
  contactId: number,
): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(sql, [contactId]);
  return row?.n ?? 0;
}

/** The row counts the merge review lists for the contact being absorbed. */
export async function readMergeImpactCounts(
  exec: SqlExecutor,
  contactId: number,
): Promise<MergeImpactCounts> {
  const [interactions, events, methods, externalLinks] = await Promise.all([
    count(
      exec,
      "SELECT COUNT(*) AS n FROM interactions WHERE contact_id = ?",
      contactId,
    ),
    count(
      exec,
      "SELECT COUNT(*) AS n FROM events WHERE contact_id = ?",
      contactId,
    ),
    count(
      exec,
      "SELECT COUNT(*) AS n FROM contact_methods WHERE contact_id = ?",
      contactId,
    ),
    count(
      exec,
      "SELECT COUNT(*) AS n FROM external_contact_links WHERE contact_id = ?",
      contactId,
    ),
  ]);
  return { interactions, events, methods, externalLinks };
}
