/**
 * The compose surface's Send/Copy capability gate (CMP-03). A pure module with no
 * UI-framework imports (mirrors the `dashboard-empty-logic` / `birthday-logic`
 * convention) so every branch is node-tested off-device.
 *
 * It answers ONE question: given whether the contact has a phone number and whether
 * the device can text (`SMS.isAvailableAsync()`), WHICH controls does the compose
 * screen render? The SCREEN owns the copy + styling; this owns the decision, so no
 * capability arithmetic leaks into ComposeScreen.
 *
 * EXPLICIT PRECEDENCE, top to bottom — the three rows of the 09-UI-SPEC
 * "Interaction States — Send / Copy capability matrix":
 *   (1) !hasPhone                 → Send hidden, Copy the sole PRIMARY, an
 *                                   add-a-number affordance. A missing number ALWAYS
 *                                   wins over SMS capability, so (false, true) reads
 *                                   identically to (false, false) — SMS capability is
 *                                   irrelevant without a number to text.
 *   (2) hasPhone && !smsAvailable → Send hidden (the device can't text), Copy
 *                                   promoted to PRIMARY, an SMS-unavailable helper
 *                                   line; no add-number (the number exists).
 *   (3) hasPhone && smsAvailable  → Send shown (filled-accent), Copy demoted to
 *                                   SECONDARY (accent-outline); no affordances.
 *
 * Why (1) is checked first (the load-bearing ordering): with no number there is
 * nothing for Send to address, so a missing number must short-circuit ahead of the
 * SMS-capability branch — otherwise a textable device with a numberless contact
 * would wrongly offer Send.
 *
 * Pure: same inputs → same output; no I/O; never throws.
 */

/** The compose Send/Copy control state this gate resolves. */
export interface ComposeControls {
  /** Whether the Send button renders at all (only with phone + SMS capability). */
  send: "shown" | "hidden";
  /** Copy's visual weight: sole primary when Send is hidden, secondary alongside Send. */
  copyEmphasis: "primary" | "secondary";
  /** Whether to show the "add a phone number" affordance (no-phone only). */
  addNumber: boolean;
  /** Whether to show the "this device can't text" helper (phone present, no SMS). */
  smsUnavailableHelper: boolean;
}

/**
 * Resolve the compose Send/Copy controls. Pure: same inputs → same output; no I/O;
 * never throws.
 */
export function resolveComposeControls(
  hasPhone: boolean,
  smsAvailable: boolean,
): ComposeControls {
  // (1) No number: SMS capability is irrelevant — Copy is the sole primary and an
  // add-number affordance appears. Checked FIRST so a missing number always wins.
  if (!hasPhone) {
    return {
      send: "hidden",
      copyEmphasis: "primary",
      addNumber: true,
      smsUnavailableHelper: false,
    };
  }

  // (2) Number present but the device can't text: Send hidden, Copy promoted, and a
  // helper line explains why Send is absent.
  if (!smsAvailable) {
    return {
      send: "hidden",
      copyEmphasis: "primary",
      addNumber: false,
      smsUnavailableHelper: true,
    };
  }

  // (3) Number present and the device can text: both controls — Send filled-accent
  // (shown), Copy demoted to accent-outline (secondary).
  return {
    send: "shown",
    copyEmphasis: "secondary",
    addNumber: false,
    smsUnavailableHelper: false,
  };
}
