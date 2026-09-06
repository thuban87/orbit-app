/**
 * Bounded, batched knowledge candidates for Dashboard List line 3.
 *
 * This module deliberately reads each source once for the visible Dashboard
 * population. Presentation and final priority selection belong to the pure
 * list-row selector; no component is permitted to issue a per-row knowledge
 * query while rendering a virtualized list.
 */
import { resolveVisibility } from "@/db/memories-read";
import { resolveRelationshipVisibility } from "@/db/relationships-read";
import type { SqlExecutor } from "@/db/types";

/** Tunable final number of useful line-3 candidates retained for one contact. */
export const CANDIDATE_BUDGET = 6;
/** Visibility is registry-resolved in TypeScript, so fetch bounded headroom first. */
export const CANDIDATE_OVER_FETCH = 6;

const PER_CONTACT_WINDOW = CANDIDATE_BUDGET + CANDIDATE_OVER_FETCH;

export type Line3CandidateKind = "memory" | "relationship" | "current-state";

/** A stable, display-ready knowledge candidate consumed by the pure selector. */
export interface Line3Candidate {
  readonly kind: Line3CandidateKind;
  readonly contactId: number;
  readonly id: number;
  readonly createdAt: string;
  readonly value: string;
  readonly type: string;
  readonly pinned: boolean;
  readonly meaningfulDate: string | null;
}

interface MemoryCandidateRow {
  id: number;
  contactId: number;
  type: string;
  value: string;
  pinned: number;
  meaningfulDate: string | null;
  hidden: number | null;
  createdAt: string;
}

interface RelationshipCandidateRow {
  id: number;
  contactId: number;
  type: string | null;
  value: string;
  pinned: number;
  hidden: number | null;
  createdAt: string;
}

interface CurrentStateCandidateRow {
  id: number;
  contactId: number;
  type: string;
  value: string;
  createdAt: string;
}

function placeholders(values: readonly unknown[]): string {
  return values.map(() => "?").join(", ");
}

function memorySql(contactIds: readonly number[]): string {
  return `
SELECT id, contactId, type, value, pinned, meaningfulDate, hidden, createdAt
  FROM (
    SELECT m.id,
           m.contact_id AS contactId,
           m.type,
           COALESCE(NULLIF(TRIM(m.value), ''), NULLIF(TRIM(m.note), ''), NULLIF(TRIM(m.custom_label), '')) AS value,
           m.pinned,
           m.meaningful_date AS meaningfulDate,
           m.hidden,
           m.created_at AS createdAt,
           ROW_NUMBER() OVER (
             PARTITION BY m.contact_id
             ORDER BY m.pinned DESC,
                      CASE WHEN m.meaningful_date IS NULL THEN 1 ELSE 0 END ASC,
                      m.meaningful_date DESC,
                      m.created_at DESC,
                      m.id DESC
           ) AS candidateRowNumber
      FROM memories m
     WHERE m.contact_id IN (${placeholders(contactIds)})
       AND m.deleted_at IS NULL
       AND m.outdated = 0
       AND m.type != 'birthday'
       AND COALESCE(NULLIF(TRIM(m.value), ''), NULLIF(TRIM(m.note), ''), NULLIF(TRIM(m.custom_label), '')) IS NOT NULL
  )
 WHERE candidateRowNumber <= ${PER_CONTACT_WINDOW}
 ORDER BY contactId, pinned DESC,
          CASE WHEN meaningfulDate IS NULL THEN 1 ELSE 0 END ASC,
          meaningfulDate DESC, createdAt DESC, id DESC`;
}

function relationshipSql(contactIds: readonly number[]): string {
  return `
SELECT id, contactId, type, value, pinned, hidden, createdAt
  FROM (
    SELECT r.id,
           r.contact_id AS contactId,
           r.relation_type AS type,
           r.person_name AS value,
           r.pinned,
           r.hidden,
           r.created_at AS createdAt,
           ROW_NUMBER() OVER (
             PARTITION BY r.contact_id
             ORDER BY r.pinned DESC, r.created_at DESC, r.id DESC
           ) AS candidateRowNumber
      FROM relationships r
     WHERE r.contact_id IN (${placeholders(contactIds)})
       AND r.deleted_at IS NULL
       AND NULLIF(TRIM(r.person_name), '') IS NOT NULL
  )
 WHERE candidateRowNumber <= ${PER_CONTACT_WINDOW}
 ORDER BY contactId, pinned DESC, createdAt DESC, id DESC`;
}

function currentStateSql(contactIds: readonly number[]): string {
  return `
SELECT id, contactId, type, value, createdAt
  FROM (
    SELECT cse.id,
           cse.contact_id AS contactId,
           cse.field_key AS type,
           cse.value,
           cse.created_at AS createdAt,
           ROW_NUMBER() OVER (
             PARTITION BY cse.contact_id
             ORDER BY cse.created_at DESC, cse.id DESC
           ) AS candidateRowNumber
      FROM current_state_entries cse
     WHERE cse.contact_id IN (${placeholders(contactIds)})
       AND cse.is_current = 1
       AND NULLIF(TRIM(cse.value), '') IS NOT NULL
  )
 WHERE candidateRowNumber <= ${PER_CONTACT_WINDOW}
 ORDER BY contactId, createdAt DESC, id DESC`;
}

function compareCandidate(left: Line3Candidate, right: Line3Candidate): number {
  if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
  const leftDate = left.meaningfulDate ?? "";
  const rightDate = right.meaningfulDate ?? "";
  if (leftDate !== rightDate) return rightDate.localeCompare(leftDate);
  if (left.createdAt !== right.createdAt) return right.createdAt.localeCompare(left.createdAt);
  if (left.id !== right.id) return right.id - left.id;
  return left.kind.localeCompare(right.kind);
}

/**
 * Batch-read one bounded candidate window per contact for each knowledge source.
 * Runtime ids only occupy SQLite placeholders; the interpolated SQL values above
 * are closed constants owned by this module.
 */
export async function readLine3Candidates(
  exec: SqlExecutor,
  contactIds: readonly number[],
): Promise<Line3Candidate[]> {
  const uniqueContactIds = [...new Set(contactIds)];
  if (uniqueContactIds.length === 0) return [];

  const [memoryRows, relationshipRows, currentStateRows] = await Promise.all([
    exec.getAllAsync<MemoryCandidateRow>(memorySql(uniqueContactIds), uniqueContactIds),
    exec.getAllAsync<RelationshipCandidateRow>(relationshipSql(uniqueContactIds), uniqueContactIds),
    exec.getAllAsync<CurrentStateCandidateRow>(currentStateSql(uniqueContactIds), uniqueContactIds),
  ]);

  const visibleCandidates: Line3Candidate[] = [
    ...memoryRows
      .filter((row) => resolveVisibility(row.type, row.hidden) === "show")
      .map((row) => ({
        kind: "memory" as const,
        contactId: row.contactId,
        id: row.id,
        createdAt: row.createdAt,
        value: row.value,
        type: row.type,
        pinned: row.pinned === 1,
        meaningfulDate: row.meaningfulDate,
      })),
    ...relationshipRows
      .filter((row) => resolveRelationshipVisibility(row.hidden) === "show")
      .map((row) => ({
        kind: "relationship" as const,
        contactId: row.contactId,
        id: row.id,
        createdAt: row.createdAt,
        value: row.value,
        type: row.type ?? "relationship",
        pinned: row.pinned === 1,
        meaningfulDate: null,
      })),
    ...currentStateRows.map((row) => ({
      kind: "current-state" as const,
      contactId: row.contactId,
      id: row.id,
      createdAt: row.createdAt,
      value: row.value,
      type: row.type,
      pinned: false,
      meaningfulDate: null,
    })),
  ];

  const candidatesByContact = new Map<number, Line3Candidate[]>();
  for (const candidate of visibleCandidates) {
    const candidates = candidatesByContact.get(candidate.contactId) ?? [];
    candidates.push(candidate);
    candidatesByContact.set(candidate.contactId, candidates);
  }

  return uniqueContactIds.flatMap((contactId) =>
    (candidatesByContact.get(contactId) ?? []).sort(compareCandidate).slice(0, CANDIDATE_BUDGET),
  );
}
