/**
 * "Also save to" (Phase 38.10 D-37, D-38, D-40, D-42, D-95, D-96) — the pure
 * rules shared by the three logging surfaces: Log Interaction, the Add Note
 * sheet and Group Log.
 *
 * - The choice is one section or None (D-95), offered in D-38 order.
 * - Section names come from the same registries the Profile sections and the
 *   share card read (D-89 "one registry"): the Profile module registry for
 *   Last Talked About and Memories, the memory type registry for Gift Ideas and
 *   Thought of Them.
 * - One destination rule (convergence c10, Codex C-01 / Cursor CU-04): a save
 *   branches on `effectiveAlsoSaveTo(note, chosen)`, never on "a section is
 *   chosen". A blank note saves plainly, because the linked-entry DAO refuses a
 *   blank value and would roll the whole save back. The note-change handler
 *   runs through `alsoSaveChoiceAfterNoteChange`, so a blanked note resets the
 *   picker to None.
 *
 * React-native-free and DAO-free at runtime (type-only DAO import), so it is
 * unit-tested in the node env.
 */
import type { LinkedSection } from "@/db/linked-entry-dao";
import { MEMORY_TYPE_REGISTRY } from "@/db/memory-registry";
import { PROFILE_MODULE_REGISTRY } from "@/profile/module-registry";
import { plural } from "@/utils/plural";

/** D-38 order: Last Talked About, Gift Ideas, Thought of Them, Memories. */
export const ALSO_SAVE_TO_SECTIONS: readonly LinkedSection[] = [
  "last_talked_about",
  "gift_idea",
  "thought_of_them",
  "memory",
];

const SECTION_LABELS: Readonly<Record<LinkedSection, string>> = Object.freeze({
  last_talked_about: PROFILE_MODULE_REGISTRY["last-talked-about"].label,
  gift_idea: MEMORY_TYPE_REGISTRY.gift_idea.displayName,
  thought_of_them: MEMORY_TYPE_REGISTRY.thought_of_them.displayName,
  memory: PROFILE_MODULE_REGISTRY.memories.label,
});

/** The label of the "no section" chip (D-95 default). */
export const ALSO_SAVE_TO_NONE_LABEL = "None";

/** A section's user-facing name (the Profile section it lands in). */
export function alsoSaveToLabel(section: LinkedSection): string {
  return SECTION_LABELS[section];
}

/** A note can also be saved to a section only when it has text. */
export function canAlsoSave(note: string | null | undefined): boolean {
  return typeof note === "string" && note.trim().length > 0;
}

/** The section a save actually writes: the choice, or null for a blank note. */
export function effectiveAlsoSaveTo(
  note: string | null | undefined,
  chosen: LinkedSection | null,
): LinkedSection | null {
  return canAlsoSave(note) ? chosen : null;
}

/** The picker's choice after the note changes: None once the note is blank. */
export function alsoSaveChoiceAfterNoteChange(
  note: string | null | undefined,
  chosen: LinkedSection | null,
): LinkedSection | null {
  return canAlsoSave(note) ? chosen : null;
}

/** ", also saved to Gift Ideas", or "" when nothing else was saved. */
export function alsoSavedSuffix(section: LinkedSection | null): string {
  return section === null ? "" : `, also saved to ${alsoSaveToLabel(section)}`;
}

/**
 * Log Interaction's success snackbar (38.9 D-39, D-46: verb first, then whom;
 * the channel for logs), plus the section when one was saved. Proposed
 * wording, reviewed in plan 19.
 */
export function loggedInteractionSnackbar(input: {
  channel: string;
  personName: string | null;
  section: LinkedSection | null;
}): string {
  const whom = input.personName ? ` with ${input.personName}` : "";
  return `Logged ${input.channel}${whom}${alsoSavedSuffix(input.section)}`;
}

/**
 * The Add Note sheet's success snackbar (38.9 D-39, D-46; F-18: a note save
 * was silent). Proposed wording, reviewed in plan 19.
 */
export function addedNoteSnackbar(input: {
  personName: string | null;
  section: LinkedSection | null;
}): string {
  const whom = input.personName ? ` for ${input.personName}` : "";
  return `Added note${whom}${alsoSavedSuffix(input.section)}`;
}

/**
 * Group Log's success snackbar (38.9 D-39, D-46: verb first, then whom; it was
 * silent). Names the event and counts the people through the plural helper
 * (D-21), plus the section the Group Note was also saved to. Proposed wording,
 * reviewed in plan 19.
 */
export function loggedGroupEventSnackbar(input: {
  title: string;
  participantCount: number;
  section: LinkedSection | null;
}): string {
  const people = plural(input.participantCount, "person", "people");
  return `Logged ${input.title} with ${people}${alsoSavedSuffix(input.section)}`;
}

/**
 * The inline error under a note that is also saved to a section when it is
 * cleared to blank (Research Q4; the edit screens). Worded per D-137 W16b;
 * the no-section fallback (the DAO refused but the section could not be read)
 * says "another section" in both places.
 */
export function linkedNoteBlankMessage(section: LinkedSection | null): string {
  const where = section === null ? "another section" : alsoSaveToLabel(section);
  return `This note is also saved to ${where}, so it can't be empty. Type something, or remove it from ${where} first.`;
}
