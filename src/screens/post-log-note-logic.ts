/**
 * Pure branch resolver for the post-log capture editor (CAPT-05, dossier §I).
 *
 * A Quick Log writes the interaction immediately; AFTER that write the success
 * snackbar offers "Add Note", which opens a small editor bound to the created
 * interaction. That editor saves EITHER an Interaction Note OR a basic Memory —
 * never both (dossier §I: "no drift/sync problem"). This module owns that
 * mutually-exclusive decision as a react-native-free, node-testable function so
 * the correctness core is proven independently of the UI that composes it.
 *
 * The resolver never writes; it maps the editor's choice to exactly ONE
 * persistence intent that the caller then executes (Note via editTouchpointFull,
 * Memory via addMemory keyed by DEFAULT_MEMORY_TYPE_KEY).
 */
import {
  DEFAULT_MEMORY_TYPE_KEY,
  type MemoryTypeKey,
} from "@/db/memory-registry";

/** Exactly one persistence outcome per save — the branches cannot both fire. */
export type PostLogSaveTarget = "note" | "memory" | "missing" | "noop";

/**
 * The editor's save request. `interactionExists` is the caller's existence
 * signal (a `readInteractionForEdit` that returned non-null); it lets the Note
 * branch decline to edit a row that was already undone/deleted (Add-Note-after-
 * Undo race, Review MEDIUM 34-06). The Memory branch never depends on it.
 */
export type PostLogSaveInput =
  | {
      kind: "note";
      text: string;
      interactionId: number;
      interactionExists: boolean;
    }
  | { kind: "memory"; text: string };

/** The Note branch: seed the existing interaction's `note` and nothing else. */
export interface PostLogNoteResult {
  target: "note";
  interactionId: number;
  note: string;
}

/** The Memory branch: create a basic Memory of the registry default type. */
export interface PostLogMemoryResult {
  target: "memory";
  type: MemoryTypeKey;
  value: string;
}

/** No write happens: empty text ("noop") or an undone interaction ("missing"). */
export interface PostLogInertResult {
  target: "noop" | "missing";
}

export type PostLogSaveResult =
  | PostLogNoteResult
  | PostLogMemoryResult
  | PostLogInertResult;

/**
 * Map one editor save request to exactly one persistence intent.
 *
 * - Empty/whitespace text → "noop" (never an empty Note or empty Memory).
 * - kind "note" with a missing interaction → "missing" (NO editTouchpointFull
 *   patch — the caller surfaces a friendly error instead of editing a deleted
 *   row).
 * - kind "note" → a Note patch only; kind "memory" → an addMemory intent only.
 *   The two are structurally exclusive: a single result carries one `target`.
 */
export function resolvePostLogSave(
  input: PostLogSaveInput,
): PostLogSaveResult {
  const text = input.text.trim();
  if (text.length === 0) {
    return { target: "noop" };
  }

  if (input.kind === "memory") {
    // Requested by KEY (D-11), never a hardcoded display name or type ID.
    return { target: "memory", type: DEFAULT_MEMORY_TYPE_KEY, value: text };
  }

  // kind === "note"
  if (!input.interactionExists) {
    return { target: "missing" };
  }
  return { target: "note", interactionId: input.interactionId, note: text };
}

/**
 * Decide what the editor does AFTER a Memory has already been created (review
 * WR-02). `addMemory` is the durable write and is TERMINAL: once it returns an
 * id the Memory exists, so the editor must NEVER route back to the re-submittable
 * "Add Note" surface — that let a second tap create a duplicate Memory when the
 * post-create re-read happened to miss the freshly-inserted row.
 *
 * - re-read found the row → "edit" (offer the inline Edit-Memory affordance);
 * - re-read returned null → "close" (the write still committed; there is simply
 *   nothing to edit inline, so dismiss rather than fall back to Add Note).
 *
 * Generic over the row shape so it stays react-native-free and node-testable.
 */
export function resolvePostCreateMemoryTarget<T>(
  reReadRow: T | null,
): { target: "edit"; row: T } | { target: "close" } {
  if (reReadRow === null) {
    return { target: "close" };
  }
  return { target: "edit", row: reReadRow };
}
