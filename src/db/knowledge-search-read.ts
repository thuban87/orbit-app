/** SQL eligibility read for the bounded TypeScript knowledge search scorer. */
import { MEMORY_TYPE_REGISTRY } from "@/db/memory-registry";
import type { KnowledgeSearchItem } from "@/services/knowledge-search";
import type { SqlExecutor } from "@/db/types";

const SEARCHABLE_MEMORY_TYPES = Object.entries(MEMORY_TYPE_REGISTRY)
  .filter(([, metadata]) => metadata.searchable)
  .map(([type]) => `'${type}'`)
  .join(", ");

/**
 * Return only the user-facing searchable Memory text for a contact. This query
 * intentionally has no term LIKE predicate: typo handling belongs to the
 * TypeScript scorer after the complete eligible corpus has been read.
 */
const LIST_SEARCHABLE_MEMORIES = `
SELECT custom_label, value, note
  FROM memories
 WHERE contact_id = ?
   AND deleted_at IS NULL
   AND type IN (${SEARCHABLE_MEMORY_TYPES})
 ORDER BY id`;

export interface KnowledgeSearchMemory extends KnowledgeSearchItem {}

export function listKnowledgeSearchMemories(
  exec: SqlExecutor,
  contactId: number,
): Promise<KnowledgeSearchMemory[]> {
  return exec.getAllAsync<KnowledgeSearchMemory>(LIST_SEARCHABLE_MEMORIES, [contactId]);
}
