/**
 * Capture's own hardware Back (38.9 D-33): Back first closes the innermost open
 * surface, and with typed text it shows the shared "Discard changes?" prompt
 * (D-13) instead of discarding. D-14 is enforced inside D-33: an open
 * New-contact surface holding a typed name prompts before it closes.
 *
 * Precedence: New-contact surface, search, multi-select, note, cancel. 38.10's
 * Capture rebuild keeps this behaviour (D-33). Its search is always visible
 * (D-80), so `searchOpen` now means "the search has text": Back clears it
 * before anything else closes.
 */

export type CaptureBackState = {
  inlineOpen: boolean;
  inlineName: string;
  /** The search has text (38.10: the field itself is always shown). */
  searchOpen: boolean;
  multiSelect: boolean;
  noteOpen: boolean;
  noteText: string;
};

export type CaptureBackOutcome =
  | "close-inline"
  | "prompt-discard-inline"
  | "close-search"
  | "exit-multi-select"
  | "prompt-discard-note"
  | "cancel-capture";

export function resolveCaptureBack({
  inlineOpen,
  inlineName,
  searchOpen,
  multiSelect,
  noteOpen,
  noteText,
}: CaptureBackState): CaptureBackOutcome {
  if (inlineOpen) {
    return inlineName.trim() === "" ? "close-inline" : "prompt-discard-inline";
  }
  if (searchOpen) return "close-search";
  if (multiSelect) return "exit-multi-select";
  if (noteOpen && noteText.trim() !== "") return "prompt-discard-note";
  return "cancel-capture";
}
