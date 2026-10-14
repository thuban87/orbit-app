/**
 * The share confirmation card's pure logic (Phase 38.10 D-77, D-78, D-79,
 * D-83, D-87, D-89, D-99, D-100, D-110, D-120). RN-free and node-tested; the
 * card (`ShareConfirmationCard.tsx`) and the share screen
 * (`CaptureScreen.tsx`) are thin shells over it.
 *
 * =============================================================================
 * WHAT LIVES HERE:
 *   - `SHARE_CARD_AUTO_CLOSE_MS`, the card's auto-close tunable (D-77).
 *   - The card reducer: chips, Undo, Add note, the Allow AI switch, the write
 *     lifecycle (single-flight, committed refs) and the five timer holds
 *     (touching, a pending write, the note editor, a discard prompt, the app
 *     not active). A `timeout` finishes only when no hold is set.
 *   - The auto-close timer controller and callback, driven the same way by
 *     the card and by the fake-clock tests.
 *   - The share sequence (`advanceShareSequence`, `isLiveShareIntent`), the
 *     per-sequence payload snapshot, and the stale-completion predicate
 *     (`shouldPublishShareResult`) that keeps a second share from showing the
 *     first share's card, rows or Undo (D-89 I-14).
 *   - The screen-level helpers: `shareListLocked` (the WR-01 list lock) and
 *     `shareScreenAfterUndo` (D-120: Undo returns to the unlocked list with
 *     the same shared item).
 *   - The visible copy: section labels from the registries (D-89 one label
 *     source), "Saved to <name> · <section>" (D-87), "Created <name> ·
 *     checking in monthly" (D-83) and the Undo snackbars (D-110, D-120).
 * =============================================================================
 */
import type { ShareRowRef, ShareSection } from "@/db/capture-dao";
import { MEMORY_TYPE_REGISTRY } from "@/db/memory-registry";
import type { CaptureInput, CapturePayload } from "@/logic/capture-logic";
import { resolveCapturePayload } from "@/logic/capture-logic";
import { PROFILE_MODULE_REGISTRY } from "@/profile/module-registry";

/**
 * How long the confirmation card stays before Orbit returns to the source app
 * (D-77). Longer than the old 1500 ms toast because the card now has chips,
 * Undo, Add note and the AI switch. Every hold (touch, a pending write, the
 * note editor, a discard prompt, the app in the background) pauses it, and it
 * restarts in full when the last hold clears. Single-number tunable
 * (CLAUDE.md); the owner tunes it at the plan-19 look checkpoint.
 */
export const SHARE_CARD_AUTO_CLOSE_MS = 5000;

// --- Sections and copy ---------------------------------------------------------

/** The chips, in D-77 order. */
export const SHARE_CHIP_ORDER: readonly ShareSection[] = [
  "thought_of_them",
  "gift_idea",
  "last_talked_about",
  "memory",
];

/** Section names from the one label source (D-89 G-23, D-44 Title Case). */
export const SHARE_SECTION_LABELS: Readonly<Record<ShareSection, string>> =
  Object.freeze({
    thought_of_them: MEMORY_TYPE_REGISTRY.thought_of_them.displayName,
    gift_idea: MEMORY_TYPE_REGISTRY.gift_idea.displayName,
    last_talked_about: PROFILE_MODULE_REGISTRY["last-talked-about"].label,
    memory: PROFILE_MODULE_REGISTRY.memories.label,
  });

/** "A", "A and B", or "N contacts" for three or more people. */
function namesPhrase(names: readonly string[]): string {
  if (names.length === 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.length} contacts`;
}

/** "Saved to <name> · <section>", following the chip (D-87; multi-name aware). */
export function confirmationLabel(
  names: readonly string[],
  section: ShareSection,
): string {
  return `Saved to ${namesPhrase(names)} · ${SHARE_SECTION_LABELS[section]}`;
}

/** The inline-create confirmation (D-83). */
export function createdLabel(name: string): string {
  return `Created ${name} · checking in monthly`;
}

/** What a successful Undo did (D-100, D-110). */
export type ShareUndoResult =
  | { kind: "share" }
  | { kind: "create-and-share"; contactRemoved: boolean };

/**
 * The confirming snackbar for every successful Undo (38.9 D-39/D-46; D-110,
 * D-120). The share is gone in every case; none is an error. Each result
 * deletes the share rows, so it reports in the warning style (38.10 D-132).
 * Proposed wording (this plan only), reviewed by the owner at plan 19.
 */
export function undoResultSnackbar(
  result: ShareUndoResult,
  name: string,
): { kind: "warning"; label: string } {
  if (result.kind === "share") {
    return { kind: "warning", label: "Share removed" };
  }
  return result.contactRemoved
    ? { kind: "warning", label: `Removed share and ${name}` }
    : {
        kind: "warning",
        label: `Kept ${name} because they have other details.`,
      };
}

// --- The card reducer ----------------------------------------------------------

export type ShareCardWriteKind = "move" | "ai" | "undo" | "note";

/** What the card last committed to the database. */
interface CommittedCard {
  rows: readonly ShareRowRef[];
  section: ShareSection;
  aiOn: boolean;
  aiDisabled: boolean;
}

export interface ShareCardState {
  /** The committed row refs; replaced only by a successful move. */
  rows: readonly ShareRowRef[];
  /** Set when the share created its contact (D-83), so Undo can remove it (D-100). */
  createdContactId: number | null;
  /** The highlighted chip (optimistic while a move is pending). */
  section: ShareSection;
  aiOn: boolean;
  /** D-99: true while Last Talked About is selected. */
  aiDisabled: boolean;
  note: string;
  touching: boolean;
  undone: boolean;
  /** The single in-flight card write, or null. */
  writePending: ShareCardWriteKind | null;
  noteEditing: boolean;
  discardPrompt: boolean;
  appInactive: boolean;
  /** The auto-close fired with no hold set. */
  finished: boolean;
  /** The last committed values a failed write snaps back to. */
  committed: CommittedCard;
}

export type ShareCardAction =
  | { type: "selectChip"; section: ShareSection }
  | { type: "toggleAi" }
  | { type: "undo" }
  | { type: "saveNote" }
  | { type: "setNote"; text: string }
  | { type: "noteOpened" }
  | { type: "noteClosed" }
  | { type: "discardOpened" }
  | { type: "discardClosed" }
  | { type: "touchStart" }
  | { type: "touchEnd" }
  | { type: "backgrounded" }
  | { type: "foregrounded" }
  | { type: "timeout" }
  | { type: "writeSucceeded"; result: ShareCardWriteResult }
  | { type: "writeFailed" };

export type ShareCardWriteResult =
  | {
      kind: "move";
      rows: readonly ShareRowRef[];
      section: ShareSection;
      aiOn: boolean;
    }
  | { kind: "ai"; aiOn: boolean }
  | { kind: "undo" }
  | { kind: "note" };

/** A fresh card for a just-written share: Thought of Them, AI off (D-03, D-04, D-78). */
export function initialShareCardState(
  rows: readonly ShareRowRef[],
  createdContactId: number | null,
): ShareCardState {
  const committed: CommittedCard = {
    rows,
    section: "thought_of_them",
    aiOn: false,
    aiDisabled: false,
  };
  return {
    rows,
    createdContactId,
    section: committed.section,
    aiOn: committed.aiOn,
    aiDisabled: committed.aiDisabled,
    note: "",
    touching: false,
    undone: false,
    writePending: null,
    noteEditing: false,
    discardPrompt: false,
    appInactive: false,
    finished: false,
    committed,
  };
}

/** True while any of the five holds keeps the auto-close from finishing (D-77). */
export function autoCloseHeld(state: ShareCardState): boolean {
  return (
    state.touching ||
    state.writePending !== null ||
    state.noteEditing ||
    state.discardPrompt ||
    state.appInactive
  );
}

/** Whether a new card write may start (single-flight; nothing after Undo). */
export function canStartCardWrite(state: ShareCardState): boolean {
  return state.writePending === null && !state.undone;
}

function restoreCommitted(state: ShareCardState): ShareCardState {
  return {
    ...state,
    writePending: null,
    rows: state.committed.rows,
    section: state.committed.section,
    aiOn: state.committed.aiOn,
    aiDisabled: state.committed.aiDisabled,
  };
}

export function shareCardReducer(
  state: ShareCardState,
  action: ShareCardAction,
): ShareCardState {
  switch (action.type) {
    case "selectChip": {
      if (!canStartCardWrite(state) || action.section === state.section) {
        return state;
      }
      // Optimistic highlight; D-99 disables the switch for Last Talked About
      // and re-enables it for any other chip. The shown permission comes from
      // the move's stored value on success, never from the chip (G-U1).
      const lta = action.section === "last_talked_about";
      return {
        ...state,
        writePending: "move",
        section: action.section,
        aiDisabled: lta,
        aiOn: lta ? false : state.aiOn,
      };
    }
    case "toggleAi":
      if (!canStartCardWrite(state) || state.aiDisabled) return state;
      return { ...state, writePending: "ai", aiOn: !state.aiOn };
    case "undo":
      if (!canStartCardWrite(state)) return state;
      return { ...state, writePending: "undo" };
    case "saveNote":
      if (!canStartCardWrite(state)) return state;
      return { ...state, writePending: "note" };
    case "setNote":
      return { ...state, note: action.text };
    case "noteOpened":
      return state.undone ? state : { ...state, noteEditing: true };
    case "noteClosed":
      return { ...state, noteEditing: false, note: "" };
    case "discardOpened":
      return { ...state, discardPrompt: true };
    case "discardClosed":
      return { ...state, discardPrompt: false };
    case "touchStart":
      return { ...state, touching: true };
    case "touchEnd":
      return { ...state, touching: false };
    case "backgrounded":
      return { ...state, appInactive: true };
    case "foregrounded":
      // The timer re-arms for the full duration once no hold is left; a
      // finish the inactive app refused is retried the same way.
      return { ...state, appInactive: false, finished: false };
    case "timeout":
      if (autoCloseHeld(state) || state.undone) return state;
      return { ...state, finished: true };
    case "writeSucceeded": {
      const { result } = action;
      if (state.writePending === null) return state;
      switch (result.kind) {
        case "move": {
          // The switch shows the permission the move stored (G-U1); D-99
          // keeps it disabled while Last Talked About is the section.
          const committed: CommittedCard = {
            rows: result.rows,
            section: result.section,
            aiOn: result.aiOn,
            aiDisabled: result.section === "last_talked_about",
          };
          return {
            ...state,
            writePending: null,
            rows: committed.rows,
            section: committed.section,
            aiOn: committed.aiOn,
            aiDisabled: committed.aiDisabled,
            committed,
          };
        }
        case "ai": {
          const committed = { ...state.committed, aiOn: result.aiOn };
          return {
            ...state,
            writePending: null,
            aiOn: result.aiOn,
            committed,
          };
        }
        case "undo":
          return { ...state, writePending: null, undone: true };
        case "note":
          return {
            ...state,
            writePending: null,
            noteEditing: false,
            note: "",
          };
      }
      return state;
    }
    case "writeFailed":
      if (state.writePending === null) return state;
      return restoreCommitted(state);
  }
}

/** Which DAO an Undo calls (D-100): the create-and-share undo, or the plain one. */
export type ShareUndoTarget =
  | {
      kind: "create-and-share";
      contactId: number;
      rows: readonly ShareRowRef[];
    }
  | { kind: "share"; rows: readonly ShareRowRef[] };

export function undoTarget(state: ShareCardState): ShareUndoTarget {
  return state.createdContactId !== null
    ? {
        kind: "create-and-share",
        contactId: state.createdContactId,
        rows: state.committed.rows,
      }
    : { kind: "share", rows: state.committed.rows };
}

// --- The auto-close timer --------------------------------------------------------

/** Whether the auto-close timer should be running for this state. */
export function shouldArmAutoClose(state: ShareCardState): boolean {
  return !state.finished && !state.undone && !autoCloseHeld(state);
}

export interface AutoCloseTimerDeps {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  ms: number;
  /** Fired when the full duration elapses with no hold (dispatch `timeout`). */
  onFire: () => void;
}

/**
 * The card's auto-close timer. `sync(state)` after every state change: a hold
 * clears the pending timeout (so no overdue fire on resume), and the first
 * state with no hold arms a fresh full-length timeout. `dispose()` on unmount.
 */
export function createAutoCloseTimer(deps: AutoCloseTimerDeps): {
  sync: (state: ShareCardState) => void;
  dispose: () => void;
} {
  let handle: unknown = null;
  const clear = () => {
    if (handle !== null) {
      deps.clearTimeout(handle);
      handle = null;
    }
  };
  return {
    sync(state) {
      if (!shouldArmAutoClose(state)) {
        clear();
        return;
      }
      if (handle !== null) return;
      handle = deps.setTimeout(() => {
        handle = null;
        deps.onFire();
      }, deps.ms);
    },
    dispose: clear,
  };
}

/**
 * The finish callback the screen hands the card: it returns to the source app
 * only when the share it was armed under is still current and the app is
 * active (convergence c4, c5). Otherwise it does nothing.
 */
export function buildAutoCloseCallback(deps: {
  armedSeq: number;
  currentSeq: () => number;
  appState: () => string;
  finish: () => void;
}): () => void {
  return () => {
    if (!shouldPublishShareResult(deps.armedSeq, deps.currentSeq())) return;
    if (deps.appState() !== "active") return;
    deps.finish();
  };
}

// --- Share sequence and snapshot -------------------------------------------------

/** The parts of `expo-share-intent`'s ShareIntent this screen reads. */
export interface ShareIntentLike {
  text?: string | null;
  webUrl?: string | null;
  files?: readonly unknown[] | null;
  meta?: { title?: string | null } | null;
}

/**
 * A live share carries a non-empty text, webUrl or files. Stricter than the
 * library's private check (which also accepts `files: []`), so the default
 * object the library resets to on background never advances the sequence.
 */
export function isLiveShareIntent(intent: unknown): boolean {
  if (intent === null || typeof intent !== "object") return false;
  const { text, webUrl, files } = intent as ShareIntentLike;
  return (
    (typeof text === "string" && text.length > 0) ||
    (typeof webUrl === "string" && webUrl.length > 0) ||
    (Array.isArray(files) && files.length > 0)
  );
}

export interface ShareSequence {
  intent: unknown;
  seq: number;
}

/**
 * Count share intents: only a live intent with a new identity advances the
 * sequence. Not live → unchanged (a background reset keeps the card); the same
 * identity → unchanged (idempotent across re-renders).
 */
export function advanceShareSequence(
  prev: ShareSequence | null,
  intent: unknown,
  live: boolean,
): ShareSequence {
  if (!live) return prev ?? { intent: null, seq: 0 };
  if (prev === null) return { intent, seq: 1 };
  if (prev.intent === intent) return prev;
  return { intent, seq: prev.seq + 1 };
}

/** The payload a share sequence writes from, taken once when it advances. */
export interface ShareSnapshot {
  seq: number;
  payload: CapturePayload;
  /** The raw share the note recompose needs (`applyShareNote`'s base). */
  shareText: Omit<CaptureInput, "note">;
}

export function takeShareSnapshot(
  seq: number,
  intent: ShareIntentLike,
): ShareSnapshot {
  const shareText = {
    text: intent.text ?? "",
    webUrl: intent.webUrl ?? null,
    title: intent.meta?.title ?? null,
  };
  return { seq, payload: resolveCapturePayload(shareText), shareText };
}

/**
 * What the screen shows: the snapshot's payload, or null for "Nothing to
 * save" (no live intent seen yet, or one that resolves to nothing).
 */
export function captureViewPayload(
  snapshot: { seq: number; payload: CapturePayload } | null,
): CapturePayload | null {
  if (snapshot === null || snapshot.seq === 0) return null;
  const { payload } = snapshot;
  if (payload.displayText === null && payload.url === null) return null;
  return payload;
}

/** Publish an async share result only while its share is still current. */
export function shouldPublishShareResult(
  startSeq: number,
  currentSeq: number,
): boolean {
  return startSeq === currentSeq;
}

export type ShareWriteOutcome<T> =
  | { status: "ok"; value: T }
  | { status: "failed"; error: unknown }
  | { status: "stale" }
  | { status: "busy" };

/**
 * Every async share handler's shape: one shared latch (set before the first
 * await, cleared in `finally`), the sequence captured at the start, and the
 * UI published only when the sequence is unchanged. The database write stands
 * either way.
 */
export async function runShareWrite<T>(opts: {
  latch: { current: boolean };
  startSeq: number;
  currentSeq: () => number;
  write: () => Promise<T>;
  onBusyChange?: (busy: boolean) => void;
  onSuccess?: (value: T) => void;
  onError?: (error: unknown) => void;
}): Promise<ShareWriteOutcome<T>> {
  if (opts.latch.current) return { status: "busy" };
  opts.latch.current = true;
  opts.onBusyChange?.(true);
  try {
    const value = await opts.write();
    if (!shouldPublishShareResult(opts.startSeq, opts.currentSeq())) {
      return { status: "stale" };
    }
    opts.onSuccess?.(value);
    return { status: "ok", value };
  } catch (error) {
    if (!shouldPublishShareResult(opts.startSeq, opts.currentSeq())) {
      return { status: "stale" };
    }
    opts.onError?.(error);
    return { status: "failed", error };
  } finally {
    opts.latch.current = false;
    opts.onBusyChange?.(false);
  }
}

// --- Screen-level state ----------------------------------------------------------

/** The list is inert while a card is up or a pick write is pending (WR-01). */
export function shareListLocked({
  cardMounted,
  writePending,
}: {
  cardMounted: boolean;
  writePending: boolean;
}): boolean {
  return cardMounted || writePending;
}

/**
 * The share screen's state that Undo touches (this plan only as a shape). The
 * mounted card carries the written rows and the names its saved label is
 * built from, so clearing it clears both.
 */
export interface ShareScreenUndoState<TCard, TSnapshot> {
  seq: number;
  snapshot: TSnapshot;
  card: TCard | null;
  noteOpen: boolean;
  noteText: string;
  searchText: string;
}

/**
 * D-120: after a successful Undo the card unmounts (and with it the written
 * rows and the saved label) and the list is live again with the same shared
 * item. The sequence, its snapshot and the search text stay, so a re-pick
 * writes a new share from the same payload.
 */
export function shareScreenAfterUndo<TCard, TSnapshot>(
  state: ShareScreenUndoState<TCard, TSnapshot>,
): ShareScreenUndoState<TCard, TSnapshot> {
  return { ...state, card: null, noteOpen: false, noteText: "" };
}
