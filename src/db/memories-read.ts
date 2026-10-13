/** Read choke point for live typed Memories. */
import { isMemoryTypeKey, MEMORY_TYPE_REGISTRY } from "@/db/memory-registry";
import type { ReadOnlyExecutor } from "@/db/transaction";
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
  deleted_at: string | null;
  /** Explicit, per-item permission for AI egress; defaults to 0 in migration 017. */
  allow_ai: number;
  /** The linked interaction (migration 033); NULL when standalone. */
  interaction_id: number | null;
  /** Which of the interaction's notes this links to: 'note' | 'group_note'. */
  link_source: string | null;
  /** D-102 Group Note copy marker (0/1); a copy is always AI-off. */
  group_note_copy: number;
  /**
   * D-103: 1 when this memory is linked to an interaction note that a move
   * into Off Limits locked AI-off for good; 0 otherwise (standalone, Group
   * Note link, or an unlocked note). Derived, never stored on the memory.
   */
  linked_note_ai_locked: number;
}

/**
 * The only Memory eligibility predicate for AI egress. It is explicit item
 * state, never a derived property of Memory type, provenance, or visibility.
 * It is two-sided and fails closed in SQL (D-13, D-31, D-49):
 * - the memory itself allows AI and is live;
 * - it is not a Group Note copy, whether or not it is still linked (the
 *   marker survives FK SET NULL, detach and dissolve; D-102, ADR-078/136);
 * - a linked memory reaches AI only through a participant's own note
 *   (`link_source = 'note'`) whose interaction belongs to the same contact,
 *   allows AI and is not locked by a move into Off Limits (D-49, D-103).
 *   The same-contact term only narrows (convergence c1 F-D1).
 *
 * Unaliased on purpose: it is interpolated against `FROM memories`.
 */
export const MEMORY_AI_ELIGIBILITY = `allow_ai = 1 AND deleted_at IS NULL AND group_note_copy = 0 AND (interaction_id IS NULL OR (link_source = 'note' AND EXISTS (SELECT 1 FROM interactions i WHERE i.id = memories.interaction_id AND i.contact_id = memories.contact_id AND i.allow_ai = 1 AND i.note_ai_locked = 0)))`;

/** The derived D-103 lock column every memories read projects. */
const LINKED_NOTE_AI_LOCKED = `COALESCE((SELECT i.note_ai_locked FROM interactions i WHERE i.id = memories.interaction_id AND memories.link_source = 'note'), 0) AS linked_note_ai_locked`;

const LIST_MEMORIES_FOR_CONTACT = `
SELECT id, uid, contact_id, type, custom_label, value, note, url,
       meaningful_date, pinned, outdated, hidden, provenance, created_at, modified_at,
       deleted_at, allow_ai, interaction_id, link_source, group_note_copy,
       ${LINKED_NOTE_AI_LOCKED}
  FROM memories
 WHERE contact_id = ? AND deleted_at IS NULL
 ORDER BY pinned DESC,
          CASE WHEN meaningful_date IS NULL THEN 1 ELSE 0 END ASC,
          meaningful_date DESC,
          created_at DESC,
          id DESC`;

/** Return a contact's live Memories with deterministic glanceable ordering. */
export function listMemoriesForContact(
  exec: ReadOnlyExecutor,
  contactId: number,
): Promise<MemoryRow[]> {
  return exec.getAllAsync<MemoryRow>(LIST_MEMORIES_FOR_CONTACT, [contactId]);
}

const LIST_AI_ELIGIBLE_MEMORIES = `
SELECT id, uid, contact_id, type, custom_label, value, note, url,
       meaningful_date, pinned, outdated, hidden, provenance, created_at, modified_at,
       deleted_at, allow_ai, interaction_id, link_source, group_note_copy,
       ${LINKED_NOTE_AI_LOCKED}
  FROM memories
 WHERE contact_id = ? AND ${MEMORY_AI_ELIGIBILITY}
 ORDER BY pinned DESC,
          CASE WHEN meaningful_date IS NULL THEN 1 ELSE 0 END ASC,
          meaningful_date DESC,
          created_at DESC,
          id DESC`;

/**
 * Return only live Memories explicitly opted into AI egress. This projection is
 * deliberately separate from the owner-facing editor read, which includes
 * every live Memory regardless of permission.
 */
export function listAiEligibleMemories(
  exec: SqlExecutor,
  contactId: number,
): Promise<MemoryRow[]> {
  return exec.getAllAsync<MemoryRow>(LIST_AI_ELIGIBLE_MEMORIES, [contactId]);
}

/**
 * Resolve a Memory's Profile presentation visibility. This is strictly a render
 * preference, not a privacy or AI-egress control. Unknown persisted types fail
 * visible so corrupt data can never disappear silently; invalid hidden values
 * instead inherit the registered type's default.
 */
export function resolveVisibility(
  type: string,
  hidden: number | null,
): "show" | "hide" {
  if (!isMemoryTypeKey(type)) return "show";
  if (hidden === 1) return "hide";
  if (hidden === 0) return "show";
  return MEMORY_TYPE_REGISTRY[type].visibilityDefault;
}

/**
 * Return the live, Profile-visible subset in the same deterministic order as
 * `listMemoriesForContact`. Hidden items remain durable and available to their
 * owner through non-Profile surfaces; this filter is presentation-only.
 */
export async function listProfileVisibleMemoriesForContact(
  exec: ReadOnlyExecutor,
  contactId: number,
): Promise<MemoryRow[]> {
  const rows = await listMemoriesForContact(exec, contactId);
  return rows.filter(
    (row) => resolveVisibility(row.type, row.hidden) === "show",
  );
}
