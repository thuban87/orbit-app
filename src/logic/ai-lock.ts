/**
 * Why an item's Allow AI switch is locked (Phase 38.10 D-98, D-102, D-103).
 * Pure; plans 12 and 13 render the reason under a locked switch, and no other
 * file hard-codes these strings.
 *
 * - `group_note`: a Group Note copy. Group Notes are never sent to AI
 *   (ADR-078, ADR-136); the lock is keyed on the copy's own marker, so it
 *   holds after the copy is unlinked (D-102).
 * - `off_limits`: the linked interaction note was moved into Off Limits, so
 *   AI stays off for good (D-103).
 */

export type AiLock = "group_note" | "off_limits";

/** The lock fields of a memory row (`MemoryRow` carries both). */
export interface MemoryAiLockFields {
  group_note_copy: number;
  linked_note_ai_locked: number;
}

export function memoryAiLock(row: MemoryAiLockFields): AiLock | null {
  if (row.group_note_copy === 1) return "group_note";
  if (row.linked_note_ai_locked === 1) return "off_limits";
  return null;
}

/**
 * The short reason shown under a locked switch. Proposed wording (this plan
 * only); the owner reviews it at the plan-19 look checkpoint.
 */
export function aiLockReason(lock: AiLock): string {
  switch (lock) {
    case "group_note":
      return "Group Notes are never shared with AI.";
    case "off_limits":
      return "Moved to Off Limits, so AI stays off.";
  }
}
