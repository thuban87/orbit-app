/** Read choke point for live typed Memories. */
import {
  isMemoryTypeKey,
  MEMORY_TYPE_REGISTRY,
} from "@/db/memory-registry";
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
}

/**
 * The only Memory eligibility predicate for AI egress. It is explicit item
 * state, never a derived property of Memory type, provenance, or visibility.
 */
export const MEMORY_AI_ELIGIBILITY = "allow_ai = 1 AND deleted_at IS NULL";

const LIST_MEMORIES_FOR_CONTACT = `
SELECT id, uid, contact_id, type, custom_label, value, note, url,
       meaningful_date, pinned, outdated, hidden, provenance, created_at, modified_at,
       deleted_at, allow_ai
  FROM memories
 WHERE contact_id = ? AND deleted_at IS NULL
 ORDER BY pinned DESC,
          CASE WHEN meaningful_date IS NULL THEN 1 ELSE 0 END ASC,
          meaningful_date DESC,
          created_at DESC,
          id DESC`;

const LIST_RECENTLY_DELETED = `
SELECT id, uid, contact_id, type, custom_label, value, note, url,
       meaningful_date, pinned, outdated, hidden, provenance, created_at, modified_at,
       deleted_at, allow_ai
  FROM memories
 WHERE contact_id = ? AND deleted_at IS NOT NULL
 ORDER BY deleted_at DESC, id DESC`;

/** Return a contact's live Memories with deterministic glanceable ordering. */
export function listMemoriesForContact(
  exec: SqlExecutor,
  contactId: number,
): Promise<MemoryRow[]> {
  return exec.getAllAsync<MemoryRow>(LIST_MEMORIES_FOR_CONTACT, [contactId]);
}

/** Return a contact's restorable Memories, newest deletion first. */
export function listRecentlyDeleted(
  exec: SqlExecutor,
  contactId: number,
): Promise<MemoryRow[]> {
  return exec.getAllAsync<MemoryRow>(LIST_RECENTLY_DELETED, [contactId]);
}

const LIST_AI_ELIGIBLE_MEMORIES = `
SELECT id, uid, contact_id, type, custom_label, value, note, url,
       meaningful_date, pinned, outdated, hidden, provenance, created_at, modified_at,
       deleted_at, allow_ai
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
  exec: SqlExecutor,
  contactId: number,
): Promise<MemoryRow[]> {
  const rows = await listMemoriesForContact(exec, contactId);
  return rows.filter((row) => resolveVisibility(row.type, row.hidden) === "show");
}
