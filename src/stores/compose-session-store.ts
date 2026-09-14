/**
 * compose-session-store (COMP-07 / D-10) — the SESSION-ONLY draft state for the
 * Compose surface. It holds the in-progress composition for ONE contact at a time
 * (`body`, `subject`, `mode`, `destination`) so the draft survives ordinary in-app
 * navigation and backgrounding — but NOT relaunch.
 *
 * =============================================================================
 * LOAD-BEARING INVARIANT (D-10, dossier §): this is NOT a durable draft.
 *   - It is plain in-memory module state (a Zustand singleton), modelled on the
 *     `assist-store` shape. It is therefore naturally lost when the JS context is
 *     torn down (relaunch / process death) — by design. There is NO drafts table,
 *     NO backup contract, and NO AsyncStorage: it never imports expo-sqlite,
 *     @react-native-async-storage, or any DAO.
 *   - Ordinary backgrounding does not tear down the JS context, so the module
 *     singleton keeps the draft with no special AppState handling — mirroring how
 *     `assist-store`'s queue persists across a foreground return (it re-queries
 *     the DB; we have nothing to re-query, only session state to retain).
 * =============================================================================
 *
 * `subject` lives here from this plan even though only Text mode ships now: the
 * Email-mode Subject field (a later plan) must survive nav/background exactly like
 * the body, so the field is seeded in the store now (COMP-07). `mode` defaults to
 * 'text'; the 'email' branch is added by a later plan.
 *
 * =============================================================================
 * MESSAGE FOCUS (COMP-11 / D-10, plan 35-06): `messageFocus` is a session-only,
 * capped-at-three selection of "Things to Remember" Research items the human has
 * toggled Add to AI. It belongs to the ACTIVE contact's session — it resets on a
 * contact switch (startSession) and clears on a Transmit-confirmed send
 * (clearSession), exactly like the draft body — and is naturally lost on relaunch.
 *   - It grants NO AI permission and performs NO network/DAO op: the store holds a
 *     reference to already-validated `ResearchItem`s only.
 *   - Eligibility is NEVER inferred here from raw source rows. `addToFocus` accepts
 *     the normalized `ResearchItem` shape (built at the read boundary in
 *     `compose-research-read.ts`) and rejects anything that is not `aiEligible` or
 *     that `isOffLimits` — Off Limits can never become Message Focus (HIGH-6,
 *     T-35-15/T-35-16, ADR-107).
 *   - The `ResearchItem` import is TYPE-ONLY (A5): this consumer lands before the
 *     `compose-research-read.ts` module exists (plan Task 2), and the store reads
 *     only `.aiEligible`/`.isOffLimits`/`.id` at runtime — never the type as a
 *     value — so the type-only import is erased by the bundler.
 * =============================================================================
 */
import { create } from "zustand";
import { MESSAGE_FOCUS_CAP } from "@/ai/message-focus";
import type { ResearchItem } from "@/db/compose-research-read";

/** The compose delivery mode. 'email' is an additive branch in a later plan. */
export type ComposeMode = "text" | "email";

export { MESSAGE_FOCUS_CAP } from "@/ai/message-focus";

export interface ComposeSessionState {
  /** The contact whose draft the session currently holds, or null before start. */
  contactId: number | null;
  /** The editable message body — opens blank, never templated/greeted (COMP-01). */
  body: string;
  /** The Email-mode Subject (default ''); carried now so it survives nav/background. */
  subject: string;
  /** Delivery mode; drives the Transmit channel. Default 'text' this plan. */
  mode: ComposeMode;
  /** The resolved endpoint value (phone/email), or null when unresolved. */
  destination: string | null;

  /**
   * The session-only Message Focus selection (≤ MESSAGE_FOCUS_CAP), in stable
   * selection (append) order. Empty until the human toggles Add to AI on an
   * AI-eligible Research item. Belongs to the active contact's session (COMP-11 /
   * D-10) — reset on contact switch, cleared on a confirmed send.
   */
  messageFocus: ResearchItem[];

  /**
   * Begin (or resume) a session for `contactId`. Resuming the SAME contact is a
   * no-op so an in-app navigation away and back — or an ordinary background /
   * foreground — preserves the in-progress draft (COMP-07 / D-10). Switching to a
   * DIFFERENT contact resets to a blank draft.
   */
  startSession: (contactId: number) => void;
  setBody: (body: string) => void;
  setSubject: (subject: string) => void;
  setMode: (mode: ComposeMode) => void;
  setDestination: (value: string | null) => void;
  /**
   * Toggle a Research item's Message Focus selection (COMP-11). Rejects any item
   * that is not `aiEligible` or that `isOffLimits` (the store guards on the
   * validated `ResearchItem` shape, never raw rows). Re-adding an already-selected
   * item removes it (tap-again toggle, deduped by identity). A fourth add while
   * MESSAGE_FOCUS_CAP are selected is a no-op. New selections append (stable
   * order, never sorted). Grants no permission; performs no network/DAO op.
   */
  addToFocus: (item: ResearchItem) => void;
  /** Remove a Message Focus selection by its Research-item identity. */
  removeFromFocus: (itemId: string) => void;
  /** Whether a Research item is currently in Message Focus (by identity). */
  isInFocus: (itemId: string) => boolean;

  /**
   * Clear the draft for `contactId` (body, subject, destination, mode, and the
   * Message Focus selection) on a Transmit-confirmed send. A no-op when a
   * different contact owns the session.
   */
  clearSession: (contactId: number) => void;
}

/** A blank draft's field values (everything except `contactId`). */
const BLANK_DRAFT = {
  body: "",
  subject: "",
  mode: "text" as ComposeMode,
  destination: null as string | null,
};

export const useComposeSession = create<ComposeSessionState>()((set, get) => ({
  contactId: null,
  ...BLANK_DRAFT,
  // A fresh array per store instance; never the shared BLANK_DRAFT reference, so
  // a reset can never alias a prior contact's selection.
  messageFocus: [],

  startSession(contactId) {
    if (get().contactId === contactId) {
      // Same contact re-entered: preserve the in-progress draft (D-10).
      return;
    }
    set({ contactId, ...BLANK_DRAFT, messageFocus: [] });
  },

  addToFocus(item) {
    // Eligibility is validated at the read boundary (compose-research-read); the
    // store never infers it from raw rows. Off Limits can never be Message Focus.
    if (item.aiEligible !== true || item.isOffLimits === true) {
      return;
    }
    const current = get().messageFocus;
    if (current.some((existing) => existing.id === item.id)) {
      // Tap-again removes (dedupe by identity).
      set({
        messageFocus: current.filter((existing) => existing.id !== item.id),
      });
      return;
    }
    if (current.length >= MESSAGE_FOCUS_CAP) {
      // Hard ceiling: a fourth add while three are selected is a no-op.
      return;
    }
    // Append preserves stable selection order (never sorted).
    set({ messageFocus: [...current, item] });
  },

  removeFromFocus(itemId) {
    set({
      messageFocus: get().messageFocus.filter((item) => item.id !== itemId),
    });
  },

  isInFocus(itemId) {
    return get().messageFocus.some((item) => item.id === itemId);
  },

  setBody(body) {
    set({ body });
  },

  setSubject(subject) {
    set({ subject });
  },

  setMode(mode) {
    set({ mode });
  },

  setDestination(value) {
    set({ destination: value });
  },

  clearSession(contactId) {
    if (get().contactId !== contactId) {
      return;
    }
    set({ ...BLANK_DRAFT, messageFocus: [] });
  },
}));
