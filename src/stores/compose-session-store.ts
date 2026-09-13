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
 */
import { create } from "zustand";

/** The compose delivery mode. 'email' is an additive branch in a later plan. */
export type ComposeMode = "text" | "email";

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
   * Clear the draft for `contactId` (body, subject, destination, mode) on a
   * Transmit-confirmed send. A no-op when a different contact owns the session.
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

  startSession(contactId) {
    if (get().contactId === contactId) {
      // Same contact re-entered: preserve the in-progress draft (D-10).
      return;
    }
    set({ contactId, ...BLANK_DRAFT });
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
    set({ ...BLANK_DRAFT });
  },
}));
