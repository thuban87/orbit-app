/**
 * Pure save resolver for the post-log Add Note sheet (CAPT-05, dossier §I;
 * Phase 38.10 D-37, D-42, D-95).
 *
 * A Quick Log writes the interaction immediately; AFTER that write the success
 * snackbar offers "Add Note", which opens a small sheet bound to the created
 * interaction. The sheet saves the interaction's note and, optionally, a linked
 * entry in one section ("Also save to", D-42). A note sent to a section is one
 * text in two places (D-37); the old separate memory path is gone (D-42).
 *
 * This module maps a save request to exactly one persistence intent that the
 * caller executes (`editTouchpointFull`, or `saveNoteWithLinkedEntry` when a
 * section applies). It never writes. React-native-free and node-tested.
 */
import type { LinkedSection } from "@/db/linked-entry-dao";
import { effectiveAlsoSaveTo } from "@/logic/also-save-to-logic";

/** Exactly one persistence outcome per save. */
export type PostLogSaveTarget = "note" | "missing" | "noop";

/**
 * The sheet's save request. `interactionExists` is the caller's existence
 * signal (a `readInteractionForEdit` that returned non-null); it lets the save
 * decline to edit a row that was already undone/deleted (Add-Note-after-Undo
 * race, Review MEDIUM 34-06). `alsoSaveTo` is the picker's choice (D-95).
 */
export interface PostLogSaveInput {
  text: string;
  interactionId: number;
  interactionExists: boolean;
  alsoSaveTo: LinkedSection | null;
}

/**
 * The note save: the existing interaction's `note`, plus the section actually
 * saved (`effectiveAlsoSaveTo`, convergence c10 C-01), null for none.
 */
export interface PostLogNoteResult {
  target: "note";
  interactionId: number;
  note: string;
  alsoSaveTo: LinkedSection | null;
}

/** No write happens: empty text ("noop") or an undone interaction ("missing"). */
export interface PostLogInertResult {
  target: "noop" | "missing";
}

export type PostLogSaveResult = PostLogNoteResult | PostLogInertResult;

/**
 * Map one save request to exactly one persistence intent.
 *
 * - Empty/whitespace text → "noop" (never an empty note, never a linked
 *   entry), whatever section was chosen; the sheet closes.
 * - A missing interaction → "missing" (no write; the caller shows a friendly
 *   error instead of editing a deleted row).
 * - Otherwise → the trimmed note, with the chosen section.
 */
export function resolvePostLogSave(input: PostLogSaveInput): PostLogSaveResult {
  const text = input.text.trim();
  if (text.length === 0) {
    return { target: "noop" };
  }
  if (!input.interactionExists) {
    return { target: "missing" };
  }
  return {
    target: "note",
    interactionId: input.interactionId,
    note: text,
    alsoSaveTo: effectiveAlsoSaveTo(text, input.alsoSaveTo),
  };
}

/**
 * Whether closing the Add Note sheet by Back, the scrim or Cancel would throw
 * away work, so it must ask "Discard changes?" first (38.9 D-14; review
 * CR-02). Typed note text counts, and so does a chosen section. A successful
 * save closes directly and never asks (D-61). PURE.
 */
export function shouldPromptOnNoteClose(state: {
  text: string;
  alsoSaveTo: LinkedSection | null;
}): boolean {
  return state.text.trim() !== "" || state.alsoSaveTo !== null;
}
