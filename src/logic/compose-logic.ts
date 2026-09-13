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

import type {
  DefaultMessageMode,
  RememberedMessageMode,
} from "@/db/app-settings-dao";
import type { ContactMethodRow } from "@/db/contact-methods-dao";

/**
 * A concrete compose message mode — the transport the user is composing for.
 * Aliased to the DAO's `RememberedMessageMode` ('text' | 'email') so the pure
 * logic layer and the migration-028 preference share ONE vocabulary and cannot
 * drift. The 'remember' sentinel is NOT a mode — it is resolved to one of these
 * by `effectiveMode` before any control resolution.
 */
export type MessageMode = RememberedMessageMode;

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
 * Return the selected DAO-owned SMS destination, or suppress the handoff when
 * the stored method is not actionable. This is intentionally a guard, not a
 * parser: phone-region interpretation is durable method-DAO work.
 */
export function actionablePrimaryPhoneDestination(
  method: ContactMethodRow | null,
): string | null {
  if (method === null || method.is_actionable !== 1) {
    return null;
  }
  return method.canonical_value;
}

/**
 * Resolve the compose Send/Copy controls. Pure: same inputs → same output; no I/O;
 * never throws.
 *
 * `smsAvailable === null` is the INTERIM (probe-pending) state — the device SMS
 * capability is UNKNOWN, not false. While pending, NEITHER Send NOR the
 * SMS-unavailable helper renders and Copy stays the sole primary, so there is no
 * wrong-state flash; the add-number affordance still follows `!hasPhone` (that is
 * knowable without the probe). Folding this here keeps ALL capability arithmetic in
 * this one node-tested place — the screen never re-derives it inline (WR-02).
 */
export function resolveComposeControls(
  hasPhone: boolean,
  smsAvailable: boolean | null,
  mode: MessageMode = "text",
  hasEmail = false,
): ComposeControls {
  // Resolve the mode ACTUALLY usable after preferred-then-fallback: the preferred
  // mode wins when it has a destination; otherwise the alternate mode is used; when
  // NEITHER exists there is no usable mode. This subsumes the old top-level
  // `!hasPhone` branch — a numberless Text request with no email is `null` here.
  const usable = resolveUsableMode(mode, hasPhone, hasEmail);

  // No usable destination in EITHER mode: Transmit unavailable, Copy the sole
  // primary, and an establish-a-primary affordance. Drafting + Copy stay usable —
  // this is a degraded-but-usable state, never a thrown error (T-35-11). With
  // `mode='text'`/`hasEmail=false` this is byte-identical to the wave-1 no-phone
  // row (`addNumber: true`), so the 2-arg call is preserved (H1).
  if (usable === null) {
    return {
      send: "hidden",
      copyEmphasis: "primary",
      addNumber: true,
      smsUnavailableHelper: false,
    };
  }

  // EMAIL is transmittable whenever an actionable primary email exists. The SMS
  // probe — including the `=== null` probe-pending branch — does NOT gate Email
  // (mailto via Linking has no expo-sms dependency and is assumed available), so
  // Email has no probe-pending state and never shows the SMS-unavailable helper
  // (HIGH-2). Send filled-accent (shown), Copy demoted to secondary.
  if (usable === "email") {
    return {
      send: "shown",
      copyEmphasis: "secondary",
      addNumber: false,
      smsUnavailableHelper: false,
    };
  }

  // usable === "text": a phone destination is guaranteed (resolveUsableMode only
  // returns "text" when `hasPhone`), so the SMS probe alone decides among the
  // remaining rows — the same explicit precedence the wave-1 gate used.

  // (a) Probe pending (SMS capability UNKNOWN, Text only): Send hidden, Copy sole
  // primary, no helper — no wrong-state flash while the probe resolves.
  if (smsAvailable === null) {
    return {
      send: "hidden",
      copyEmphasis: "primary",
      addNumber: false,
      smsUnavailableHelper: false,
    };
  }

  // (b) Phone present but the device can't text: Send hidden, Copy promoted, and a
  // helper line explains why Send is absent.
  if (!smsAvailable) {
    return {
      send: "hidden",
      copyEmphasis: "primary",
      addNumber: false,
      smsUnavailableHelper: true,
    };
  }

  // (c) Phone present and the device can text: both controls — Send filled-accent
  // (shown), Copy demoted to accent-outline (secondary).
  return {
    send: "shown",
    copyEmphasis: "secondary",
    addNumber: false,
    smsUnavailableHelper: false,
  };
}

/** The mode actually usable after fallback, or `null` when no destination exists. */
export type UsableMode = MessageMode | null;

/**
 * Resolve the compose mode ACTUALLY usable given which destinations exist. The
 * PREFERRED mode wins when it has a destination; otherwise the alternate mode is
 * used when IT has one; when NEITHER phone nor email exists there is no usable
 * mode (`null`). Pure: same inputs → same output; never throws.
 *
 * The screen consumes this to pick the phone-vs-email destination and to gate the
 * Subject affordance (Email only) — capability arithmetic never leaks into the
 * screen (WR-02).
 */
export function resolveUsableMode(
  mode: MessageMode,
  hasPhone: boolean,
  hasEmail: boolean,
): UsableMode {
  if (mode === "text") {
    if (hasPhone) return "text";
    return hasEmail ? "email" : null;
  }
  // mode === "email"
  if (hasEmail) return "email";
  return hasPhone ? "text" : null;
}

/**
 * Resolve the effective compose mode from the stored default. The `remember`
 * sentinel resolves to the remembered concrete mode; a fixed default is used
 * verbatim. Pure; never throws. (COMP-02: equality is over the fixed lowercase
 * token set, never a free-text/locale-sensitive comparison.)
 */
export function effectiveMode(
  defaultMode: DefaultMessageMode,
  remembered: RememberedMessageMode,
): MessageMode {
  return defaultMode === "remember" ? remembered : defaultMode;
}

/**
 * The remembered mode advances ONLY on a commit (Transmit or Copy) — never on an
 * ad-hoc in-session mode switch. Returns the ad-hoc mode when `committed`, else
 * the current remembered value unchanged. Pure; never throws. (COMP-02)
 */
export function nextRememberedMode(
  current: RememberedMessageMode,
  adHocMode: RememberedMessageMode,
  committed: boolean,
): RememberedMessageMode {
  return committed ? adHocMode : current;
}

/** The two Copy affordances the compose surface exposes (COMP-04). */
export interface CopyTargets {
  /** The MAIN Copy affordance always copies the Body text — in any mode. */
  body: string;
  /**
   * The separate Subject copy affordance's target: the Subject text in Email
   * mode, or `null` when the affordance is NOT offered (Text mode has no Subject).
   */
  subject: string | null;
}

/**
 * Resolve the two Copy targets so the screen never inlines the rule (WR-02). The
 * main Copy target is ALWAYS the Body; the Subject copy affordance targets the
 * Subject and is offered in Email mode ONLY (`null` in Text mode). Pure; never
 * throws.
 */
export function resolveCopyTargets(
  mode: MessageMode,
  body: string,
  subject: string,
): CopyTargets {
  return { body, subject: mode === "email" ? subject : null };
}

/**
 * The distinct ways the user can leave an in-progress compose flow (COMP-14 / D-10).
 *   - `back`             — ordinary Back, no send.
 *   - `transmit-pending` — Transmit fired, the "Did you send it?" panel is open but
 *                          the send is not yet confirmed.
 *   - `not-yet`          — the user dismissed that panel ("Not yet").
 *   - `logged`           — the user confirmed the send ("Yes, log interaction") and
 *                          the assist row logged successfully.
 *   - `copy`             — the user copied the draft.
 */
export type ComposeExit =
  | "back"
  | "transmit-pending"
  | "not-yet"
  | "logged"
  | "copy";

/** The per-exit SESSION + NAVIGATION disposition (COMP-14 / D-10, review MEDIUM #3). */
export interface ComposeExitDisposition {
  /**
   * Clear THIS contact's session draft (body/subject/mode/destination/Message
   * Focus). TRUE for the confirmed-log path ONLY — every other exit PRESERVES the
   * in-memory session (COMP-07 / D-10). Ordinary Back never clears.
   */
  clearSession: boolean;
  /**
   * Remove the finished Compose route from Back history so a completed draft can
   * never be resurrected/re-sent (T-35-20). TRUE for the confirmed-log path only.
   */
  removeFinishedRoute: boolean;
  /**
   * Navigate AWAY toward the launch origin (vs staying on Compose). TRUE for Back
   * (returns toward origin) and the confirmed log; FALSE for transmit-pending,
   * "Not yet", and Copy (all stay on the Compose surface).
   */
  navigatesToOrigin: boolean;
}

/**
 * Enumerate the per-path disposition so the clear-on-confirm vs preserve-on-Back
 * distinction (decided by D-10 + 35-01 but never previously enumerated per path) is
 * a single pure, node-tested mapping the screen consumes — no scattered ad-hoc
 * clear/reset calls. Pure: same input → same output; never throws.
 *
 * ONLY the confirmed `logged` path is a "finished" flow: it clears the session and
 * removes the finished route. Back preserves the session but still returns toward
 * origin. Transmit-pending / "Not yet" / Copy preserve everything and stay put.
 */
export function composeExitDisposition(
  exit: ComposeExit,
): ComposeExitDisposition {
  switch (exit) {
    case "logged":
      return {
        clearSession: true,
        removeFinishedRoute: true,
        navigatesToOrigin: true,
      };
    case "back":
      return {
        clearSession: false,
        removeFinishedRoute: false,
        navigatesToOrigin: true,
      };
    case "transmit-pending":
    case "not-yet":
    case "copy":
      return {
        clearSession: false,
        removeFinishedRoute: false,
        navigatesToOrigin: false,
      };
  }
}
