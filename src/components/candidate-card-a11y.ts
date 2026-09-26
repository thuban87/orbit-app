/**
 * Pure accessible representation for a CandidateCardGrid review card
 * (Duplicate Review + Reconcile Grid) — RG-031 ui-accessibility/AUD-UIA-008.
 *
 * The card announces what it displays: the person's name, the recommendation
 * chip text (import confidence or reconciliation advisory copy — advisory
 * only, never a decision), the evidence line, and any per-card failure copy.
 * Selection is exposed as `accessibilityState.selected` only while the grid is
 * selecting, and a Select/Deselect custom action mirrors the long-press that
 * enters/toggles selection. Stable internal ids are never inputs here, so they
 * can never be announced as identity. React-Native-free (node-testable).
 */

/** Custom accessibility action name the grid maps to `toggleSelection`. */
export const CANDIDATE_SELECTION_ACTION = "toggle-selection";

/** The per-card failure copy the grid renders and announces verbatim. */
export const CANDIDATE_CARD_FAILURE_COPY =
  "This action could not be completed. Try again.";

export interface CandidateCardAccessibilityInput {
  name: string;
  /** The chip text the card displays (confidence label or advisory chip). */
  recommendationText: string | null;
  /** The evidence line the card displays. */
  evidenceHint: string | null;
  /** The failure copy, only when the card currently displays it. */
  failureText: string | null;
  selected: boolean;
  /** True while the grid is in multi-select mode. */
  selectionMode: boolean;
}

export interface CandidateCardAccessibility {
  accessibilityLabel: string;
  accessibilityHint: string;
  accessibilityState: { selected?: boolean };
  accessibilityActions: { name: string; label: string }[];
}

const SENTENCE_END = /[.!?…]$/;

function sentence(part: string): string {
  return SENTENCE_END.test(part) ? part : `${part}.`;
}

export function buildCandidateCardAccessibility({
  name,
  recommendationText,
  evidenceHint,
  failureText,
  selected,
  selectionMode,
}: CandidateCardAccessibilityInput): CandidateCardAccessibility {
  const accessibilityLabel = [
    name,
    recommendationText,
    evidenceHint,
    failureText,
  ]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .map(sentence)
    .join(" ");

  return {
    accessibilityLabel,
    // Activation keeps its current meaning: inspect when not selecting,
    // toggle when selecting.
    accessibilityHint: selectionMode
      ? "Activating toggles selection."
      : "Use the Select action to choose cards for a bulk action.",
    accessibilityState: selectionMode ? { selected } : {},
    accessibilityActions: [
      {
        name: CANDIDATE_SELECTION_ACTION,
        label: selected ? "Deselect" : "Select",
      },
    ],
  };
}
