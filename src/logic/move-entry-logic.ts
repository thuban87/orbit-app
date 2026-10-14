/**
 * Moving an entry between Things to Remember sections (Phase 38.10 D-84,
 * D-85, D-118; 38.9 D-39/D-46 via D-19). Pure rules for `MoveEntrySheet`.
 *
 * - Targets are the five D-84 sections; Imported and custom fields never are.
 * - Section names come from the registries the Profile reads (D-89 "one
 *   registry"): Memories, Last Talked About and Off Limits from the Profile
 *   module registry, Gift Ideas and Thought of Them from the memory type
 *   registry.
 * - The D-85 confirm lists, in plain words, every field `fieldsDroppedByMove`
 *   can return. Field names and every sentence here are proposals (this plan
 *   only) for the plan-19 wording review.
 *
 * React-native-free and DAO-free at runtime (type-only DAO import).
 */
import type {
  DroppedFieldName,
  KnowledgeSection,
} from "@/db/knowledge-move-dao";
import {
  HIDE_FROM_PROFILE_ENABLED,
  MEMORY_TYPE_REGISTRY,
} from "@/db/memory-registry";
import { PROFILE_MODULE_REGISTRY } from "@/profile/module-registry";

/** D-84's sections, in the Profile's memory-first order. */
export const MOVE_SECTIONS: readonly KnowledgeSection[] = [
  "memory",
  "thought_of_them",
  "gift_idea",
  "last_talked_about",
  "off_limits",
];

const SECTION_LABELS: Readonly<Record<KnowledgeSection, string>> =
  Object.freeze({
    memory: PROFILE_MODULE_REGISTRY.memories.label,
    thought_of_them: MEMORY_TYPE_REGISTRY.thought_of_them.displayName,
    gift_idea: MEMORY_TYPE_REGISTRY.gift_idea.displayName,
    last_talked_about: PROFILE_MODULE_REGISTRY["last-talked-about"].label,
    off_limits: PROFILE_MODULE_REGISTRY["off-limits"].label,
  });

export function moveSectionLabel(section: KnowledgeSection): string {
  return SECTION_LABELS[section];
}

/** Every other D-84 section. */
export function moveTargetsFor(section: KnowledgeSection): KnowledgeSection[] {
  return MOVE_SECTIONS.filter((target) => target !== section);
}

const DROPPED_FIELD_WORDS: Readonly<Record<DroppedFieldName, string>> =
  Object.freeze({
    note: "its note",
    "meaningful date": "its meaningful date",
    pinned: "its pin",
    outdated: "its outdated mark",
    "visibility setting": "its Hide from Profile setting",
    label: "its label",
    "linked note": "its link to the interaction note",
    "entry date": "its date",
  });

function listWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/**
 * D-85's confirm message: null when the move drops nothing, otherwise one
 * sentence naming every dropped field. While Hide from Profile is switched off
 * (D-134) the confirm never names that setting: the DAO still drops the stored
 * value on a cross-table move, but the setting is hidden from every caption.
 * `hideFromProfileEnabled` exists so tests can exercise the kept wording.
 */
export function dropConfirmText(
  fields: readonly DroppedFieldName[],
  target: KnowledgeSection,
  hideFromProfileEnabled: boolean = HIDE_FROM_PROFILE_ENABLED,
): string | null {
  const shown = hideFromProfileEnabled
    ? fields
    : fields.filter((field) => field !== "visibility setting");
  if (shown.length === 0) return null;
  const words = shown.map((field) => DROPPED_FIELD_WORDS[field]);
  return `Moving this to ${moveSectionLabel(target)} removes ${listWords(words)}.`;
}

function forName(name: string | null): string {
  return name === null || name.trim() === "" ? "" : ` for ${name}`;
}

/** "Moved to <section> for <name>" (verb first, names the person). */
export function movedSnackbar(
  target: KnowledgeSection,
  name: string | null,
): string {
  return `Moved to ${moveSectionLabel(target)}${forName(name)}`;
}

/** The confirming snackbar after a move's Undo (D-118; 38.9 D-39). */
export function moveUndoneSnackbar(
  original: KnowledgeSection,
  name: string | null,
): string {
  return `Move undone, back in ${moveSectionLabel(original)}${forName(name)}`;
}
