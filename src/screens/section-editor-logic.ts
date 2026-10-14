/**
 * The per-section memory editor's pure rules (Phase 38.10 D-75, D-35, D-84,
 * D-107; 38.9 D-39/D-46 via D-19).
 *
 * Memories, Thought of Them, Gift Ideas and Imported share one editor design
 * that edits only its own section. This module holds what the screen decides
 * without React: the section's title and rows, whether it offers Add or Move,
 * which entry an `editId` opens, and the snackbar wording. Every snackbar
 * string here is a proposal (this plan only) for the plan-19 wording review,
 * listed from this one place.
 *
 * React-native-free and DAO-free at runtime (type-only imports), so it is
 * unit-tested in the node env.
 */
import type { KnowledgeSection } from "@/db/knowledge-move-dao";
import type { MemoryRow } from "@/db/memories-read";
import { MEMORY_TYPE_REGISTRY, type MemoryTypeKey } from "@/db/memory-registry";
import { PROFILE_MODULE_REGISTRY } from "@/profile/module-registry";

/**
 * The section's title (D-91: from the registries, the same names the Profile
 * sections show): Memories and Imported come from the Profile module
 * registry, Gift Ideas and Thought of Them from the memory type registry.
 */
export function sectionTitle(type: MemoryTypeKey): string {
  switch (type) {
    case "general":
      return PROFILE_MODULE_REGISTRY.memories.label;
    case "imported":
      return PROFILE_MODULE_REGISTRY["imported-contact-notes"].label;
    case "gift_idea":
    case "thought_of_them":
      return MEMORY_TYPE_REGISTRY[type].displayName;
  }
}

/**
 * The section's entries in read order (pinned first, then meaningful date,
 * then newest; `listMemoriesForContact`). Hidden entries are kept: the
 * section editor shows them dimmed with "Show on Profile" (D-17).
 */
export function sectionEntries(
  rows: readonly MemoryRow[],
  type: MemoryTypeKey,
): MemoryRow[] {
  return rows.filter((row) => row.type === type);
}

/** Imported is not a move source (D-84; PLAN-MAP §5). */
export function canMove(type: MemoryTypeKey): boolean {
  return type !== "imported";
}

/**
 * The section's solid Add label (D-130). Today's wording for every type;
 * plan 25 applies D-137's section names here, and plan 21's section FAB
 * reads it too. Imported never shows an Add (D-35).
 */
export function sectionAddLabel(_type: MemoryTypeKey): string {
  return "Add memory";
}

/** Only the Contacts import writes Imported, so its editor has no Add (D-35). */
export function canAdd(type: MemoryTypeKey): boolean {
  return type !== "imported";
}

/** The move DAO's section for a memory type; null for Imported (D-84). */
export function moveSectionOf(type: MemoryTypeKey): KnowledgeSection | null {
  switch (type) {
    case "general":
      return "memory";
    case "gift_idea":
    case "thought_of_them":
      return type;
    case "imported":
      return null;
  }
}

/**
 * The entry whose edit form the screen opens after its read (D-107; the
 * Profile's item-level Edit, plan 16): `editId` when a loaded row has it,
 * otherwise undefined, so an entry deleted meanwhile or of another section
 * falls back to the plain list. Generic: plan 15's editors reuse it.
 */
export function openEditTarget<T extends { id: number }>(
  editId: number | undefined,
  rows: readonly T[],
): number | undefined {
  if (editId === undefined) return undefined;
  return rows.some((row) => row.id === editId) ? editId : undefined;
}

/** " for Ann", or "" while the person line has not loaded. */
function forName(name: string | null): string {
  return name === null || name.trim() === "" ? "" : ` for ${name}`;
}

/** Delete snackbar, verb first, naming the person (D-69; 38.9 D-39/D-46). */
export function deletedSnackbar(section: string, name: string | null): string {
  return `Deleted ${section} entry${forName(name)}`;
}

/** The confirming snackbar after a delete's Undo (38.9 D-39). */
export function restoredSnackbar(section: string, name: string | null): string {
  return `${section} entry restored${forName(name)}`;
}

/** The immediate Pin / Unpin snackbar; `pinned` is the value just written. */
export function sectionPinSnackbar(
  pinned: boolean,
  name: string | null,
): string {
  return `${pinned ? "Pinned" : "Unpinned"}${forName(name)}`;
}

/** The confirming snackbar after a Pin / Unpin's Undo. */
export function sectionPinUndoneSnackbar(
  pinned: boolean,
  name: string | null,
): string {
  return `${pinned ? "Pin" : "Unpin"} undone${forName(name)}`;
}

/** "Show on Profile" on a hidden entry (D-17). */
export function shownOnProfileSnackbar(name: string | null): string {
  return `Shown on Profile${forName(name)}`;
}

/** Add snackbar (38.9 D-39: a write names the person). */
export function addedSnackbar(section: string, name: string | null): string {
  return `Added ${section} entry${forName(name)}`;
}

/** Save snackbar for an edited entry. */
export function savedSnackbar(section: string, name: string | null): string {
  return `Saved ${section} entry${forName(name)}`;
}

/**
 * The refusal when an entry linked to its interaction's note is saved with
 * no text (the DAO's `LinkedNoteBlankError`, D-37 Q4 from the entry side).
 */
export const LINKED_ENTRY_NEEDS_TEXT =
  "This entry is linked to an interaction note, so it needs some text.";

/** The empty section's text (D-68: text only here; the editor's Add acts). */
export function sectionEmptyText(type: MemoryTypeKey): {
  heading: string;
  body: string;
} {
  const title = sectionTitle(type);
  return {
    heading: `Nothing in ${title} yet`,
    body: canAdd(type)
      ? "Use Add memory below to add the first one."
      : "Only the Contacts import adds entries here.",
  };
}
