/**
 * Merge review counts: what the absorbed contact brings to the survivor, as
 * the merge review screen lists it (MergeImpactSummary). A pure read — no
 * transaction. Every table name is a literal and the contact id is `?`-bound.
 *
 * 38.12 D-44: one count for every child table `mergeContacts` reparents (the
 * `for (const table of [...])` list in merge-dao.ts; merge-impact-read.test.ts
 * pins the match): interactions, events, off_limits, custom_field_values,
 * contact_links, contact_methods, external_contact_links,
 * interaction_assists, memories, relationships, current_state_entries. The
 * audit trails merge also moves (`field_history`,
 * `custom_field_value_history`) are not user data and are not listed.
 *
 * Two counts are narrowed to what the person would recognise: custom field
 * values count only non-blank values (a blank row moves nothing), and
 * interaction assists count only pending ones (a resolved assist is already an
 * interaction or was dismissed).
 */
import type { SqlExecutor } from "@/db/types";

export interface MergeImpactCounts {
  interactions: number;
  events: number;
  methods: number;
  externalLinks: number;
  /** `memories` (every Things to Remember memory type). */
  memories: number;
  /** `relationships` owned by the absorbed contact. */
  keyPeople: number;
  /** `current_state_entries` (Last Talked About / Current Location). */
  currentState: number;
  offLimits: number;
  /** Non-blank `custom_field_values`. */
  customValues: number;
  /** `contact_links` (the person's saved links). */
  links: number;
  /** Pending `interaction_assists`. */
  pendingAssists: number;
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
  const [
    interactions,
    events,
    methods,
    externalLinks,
    memories,
    keyPeople,
    currentState,
    offLimits,
    customValues,
    links,
    pendingAssists,
  ] = await Promise.all([
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
    count(
      exec,
      "SELECT COUNT(*) AS n FROM memories WHERE contact_id = ?",
      contactId,
    ),
    count(
      exec,
      "SELECT COUNT(*) AS n FROM relationships WHERE contact_id = ?",
      contactId,
    ),
    count(
      exec,
      "SELECT COUNT(*) AS n FROM current_state_entries WHERE contact_id = ?",
      contactId,
    ),
    count(
      exec,
      "SELECT COUNT(*) AS n FROM off_limits WHERE contact_id = ?",
      contactId,
    ),
    count(
      exec,
      "SELECT COUNT(*) AS n FROM custom_field_values WHERE contact_id = ? AND NULLIF(TRIM(COALESCE(value, '')), '') IS NOT NULL",
      contactId,
    ),
    count(
      exec,
      "SELECT COUNT(*) AS n FROM contact_links WHERE contact_id = ?",
      contactId,
    ),
    count(
      exec,
      "SELECT COUNT(*) AS n FROM interaction_assists WHERE contact_id = ? AND status = 'pending'",
      contactId,
    ),
  ]);
  return {
    interactions,
    events,
    methods,
    externalLinks,
    memories,
    keyPeople,
    currentState,
    offLimits,
    customValues,
    links,
    pendingAssists,
  };
}
