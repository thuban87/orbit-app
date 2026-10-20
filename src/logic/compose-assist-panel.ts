/**
 * Compose's "Did you send it?" panel — the pure answer state machine (38.14).
 *
 * The panel answers Yes, log it / No, don't log / Later (carried D-01, from
 * 39 D-76). Yes and No run through the one assist runner (`runAssistAction`,
 * D-08 / ADR-164); the screen feeds the runner's result in here and applies the
 * returned outcome. Later writes nothing: the record stays pending and quiet on
 * the banner and pending list until the next return to Orbit (D-77).
 *
 *   - Yes, done      → close, exit "logged" (clears the draft, leaves), snackbar
 *                      naming channel and person (D-43)
 *   - No, done       → close, exit "dismissed" (stays on Compose, draft kept, D-78)
 *   - Yes/No, closed → close, no exit, the runner's "Already closed" snackbar
 *   - failed / busy  → the panel stays so the user can try again
 *   - Later          → defer the record, close, exit "later" (stays)
 *
 * The panel claim itself (D-23) is not here: ComposeScreen's focus effect claims
 * while the panel shows and releases when it closes.
 *
 * Node-testable by construction: no react-native, store or database import.
 */
import { assistAnswerSnackbar } from "@/logic/assist-display";
import type { ComposeExit } from "@/logic/compose-logic";
import type { AssistActionResult } from "@/services/assist-commit";

export type ComposePanelAnswer = "yes" | "dismiss" | "later";

/** Which confirmation the screen shows; it builds the copy (it has the names). */
export type ComposePanelSnackbar = "logged" | "dismissed" | "closed";

export interface ComposePanelOutcome {
  /** Clear the panel (`setConfirm(null)`), which also releases the claim. */
  closePanel: boolean;
  /** The Compose exit to perform, or null to do nothing more. */
  exit: ComposeExit | null;
  /** Add this record to the assist store's Later set BEFORE closing (D-77). */
  deferUid: boolean;
  snackbar: ComposePanelSnackbar | null;
}

const STAY: ComposePanelOutcome = {
  closePanel: false,
  exit: null,
  deferUid: false,
  snackbar: null,
};

/**
 * The outcome of one panel answer. `result` is the runner's result for Yes and
 * No; Later runs no write and takes none.
 */
export function composePanelOutcome(
  answer: "later",
  result?: undefined,
): ComposePanelOutcome;
export function composePanelOutcome(
  answer: "yes" | "dismiss",
  result: AssistActionResult,
): ComposePanelOutcome;
export function composePanelOutcome(
  answer: ComposePanelAnswer,
  result?: AssistActionResult,
): ComposePanelOutcome {
  if (answer === "later") {
    return { closePanel: true, exit: "later", deferUid: true, snackbar: null };
  }
  switch (result) {
    case "done":
      return answer === "yes"
        ? {
            closePanel: true,
            exit: "logged",
            deferUid: false,
            snackbar: "logged",
          }
        : {
            closePanel: true,
            exit: "dismissed",
            deferUid: false,
            snackbar: "dismissed",
          };
    case "closed":
      // For "dismiss" this branch is defensive only: `markAssistDismissed`
      // resolves void and the runner reports "closed" only when the write
      // returns "closed", so the integrated dismiss path never yields it today
      // (D-23 forbids a DAO change). Kept so a future DAO outcome lands safely.
      return {
        closePanel: true,
        exit: null,
        deferUid: false,
        snackbar: "closed",
      };
    default:
      // "failed" (the runner already showed the error) or "busy" (another tap
      // holds the latch): the panel stays.
      return STAY;
  }
}

/**
 * Compose's success snackbar after "Yes, log it" (D-43): "Logged Message with
 * Maya". Text and email both log as Message (D-10, ADR-116). One wording with
 * the banner and pending list (`assistAnswerSnackbar`, D-39).
 */
export function composeLoggedSnackbar(
  channel: "text" | "email",
  personName: string | null,
): string {
  return assistAnswerSnackbar({ channel, personName, answer: "logged" });
}

/**
 * Compose's confirmation after "No, don't log" (D-78, D-20 named snackbar):
 * "Didn't log Message with Maya" — the same wording the banner and pending
 * list use for "Don't log".
 */
export function composeDismissedSnackbar(
  channel: "text" | "email",
  personName: string | null,
): string {
  return assistAnswerSnackbar({ channel, personName, answer: "dismissed" });
}
