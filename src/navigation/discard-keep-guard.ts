import { useNavigation } from "@react-navigation/native";
import { type RefObject, useEffect, useRef } from "react";
import { type ConfirmRequest, confirmStore } from "@/stores/confirm-store";

/**
 * An in-screen sub-editor (D-14): a draft form, row editor or nested editor
 * that lives inside the route. `dirty` describes the innermost open level.
 */
export type GuardSubEditor = {
  open: boolean;
  dirty: boolean;
  close: () => void;
};

type DiscardKeepGuardOptions = {
  hasUnsavedChanges: boolean;
  bypassRef: RefObject<boolean>;
  /** In-screen sub-editor variant (D-14). Absent for plain route guards. */
  subEditor?: GuardSubEditor;
  /**
   * Set while the screen's save is in flight (38.9 fix-pass WR-02): every
   * removal is held, with no prompt, because the save owns the exit. Its
   * success leaves through the bypass; its failure keeps the user here. Read
   * at removal time, so pass the screen's synchronous single-flight ref.
   */
  busyRef?: RefObject<boolean>;
};

export type DiscardKeepGuard = {
  /**
   * The one dirty-aware close (D-61): clean → `close()` at once; dirty → the
   * "Discard changes?" prompt, then `close()` only on "Discard changes". Shares
   * the guard's pending-prompt ref, so no second prompt is queued.
   */
  requestClose: (close: () => void, dirty: boolean) => void;
};

export type GuardDecision =
  | "allow"
  | "hold"
  | "prompt-leave"
  | "close-sub-editor"
  | "prompt-close-sub-editor";

/**
 * The shared unsaved-work prompt (38.9 D-13, D-52): themed, non-dismissable
 * (destructive, ADR-086), no warning glyph above the title, the ⚠ only on the
 * "Discard changes" button.
 */
const DISCARD_PROMPT: ConfirmRequest = {
  title: "Discard changes?",
  message: "Your unsaved changes will be lost.",
  cancelLabel: "Keep editing",
  confirmLabel: "Discard changes",
  destructive: true,
  headingGlyph: false,
};

/** The actions a Back (header, system key, system gesture) dispatches. */
const BACK_ACTION_TYPES: ReadonlySet<string> = new Set(["GO_BACK", "POP"]);

/**
 * What a route removal does (D-13, D-14):
 *
 * - bypass (a confirmed save is navigating) → "allow", for every action.
 * - busy (a save is in flight, not yet navigating) → "hold", for every action:
 *   stay, with no prompt. Offering "Discard changes?" now would let the user
 *   discard and leave while the save still commits and navigates (fix-pass
 *   WR-02). The save's own navigation sets bypass first, so it still leaves.
 * - Back (`GO_BACK` / `POP`) with an open sub-editor → close that editor and
 *   stay: "close-sub-editor" when it is clean, "prompt-close-sub-editor" when
 *   it holds typed text. With no sub-editor open, the route rule applies.
 * - any other removal (a `RESET` after a merge or a widget link, `NAVIGATE`,
 *   `POP_TO_TOP` …; review C6-H1) never closes a sub-editor: it proceeds at
 *   once unless typed work would be lost, in which case it prompts and, on
 *   Discard, completes that same action.
 */
export function decideGuardOnRemove({
  bypass,
  busy = false,
  hasUnsavedChanges,
  subEditorOpen = false,
  subEditorDirty = false,
  actionType,
}: {
  bypass: boolean;
  busy?: boolean;
  hasUnsavedChanges: boolean;
  subEditorOpen?: boolean;
  subEditorDirty?: boolean;
  actionType: string;
}): GuardDecision {
  if (bypass) return "allow";
  if (busy) return "hold";
  if (BACK_ACTION_TYPES.has(actionType)) {
    if (subEditorOpen) {
      return subEditorDirty ? "prompt-close-sub-editor" : "close-sub-editor";
    }
    return hasUnsavedChanges ? "prompt-leave" : "allow";
  }
  return hasUnsavedChanges || (subEditorOpen && subEditorDirty)
    ? "prompt-leave"
    : "allow";
}

/**
 * Shows the "Discard changes?" prompt and resolves true on "Discard changes",
 * false on "Keep editing". Usable by any caller that guards typed work (route
 * guards, BackHandlers, sheet closes, sub-editors).
 *
 * Single-flight (D-13/D-14; review C2-L3, C3-L2): while a discard prompt is
 * already queued, a second call resolves false (stay) at once and enqueues
 * nothing, so no removal or close is dispatched twice. "Pending" is read from
 * the confirm queue itself (entries carry the internal `discard` marker), not
 * a module flag, so resetting the queue resets single-flight too. The pending
 * prompt's promise is never shared with the second caller.
 */
export function confirmDiscard(): Promise<boolean> {
  const store = confirmStore.getState();
  if (store.queue.some((entry) => entry.kind === "confirm" && entry.discard)) {
    return Promise.resolve(false);
  }
  return new Promise<boolean>((resolve) => {
    store.enqueue({
      kind: "confirm",
      request: DISCARD_PROMPT,
      discard: true,
      resolve,
    });
  });
}

/**
 * Blocks route removal only while a focused workflow has meaningful unsaved
 * changes. Callers set the bypass immediately before a confirmed-save route
 * transition so the completed save can leave without a second confirmation.
 *
 * A guarded route shows at most one prompt at a time (D-13/D-14): a second
 * Back (or a gesture plus a header tap) while the prompt is open is still
 * prevented, so the route stays, but queues no second prompt. The same holds
 * for a `requestClose` prompt.
 *
 * Sub-editor variant (D-14): with `subEditor`, Back first closes the open
 * editor and keeps the route, prompting only when it holds typed text.
 *
 * Busy hold (fix-pass WR-02): with `busyRef` set, every removal is prevented
 * with no prompt until the save settles (see `decideGuardOnRemove`).
 *
 * Android native-stack note (review M5): every stack here is a native stack
 * with `headerShown: false`; on Android `nativeBackButtonDismissalEnabled` is
 * false, predictive back is off and `gestureEnabled` is iOS-only, so the
 * header Back, the system Back key and the system Back gesture all reach JS
 * and fire `beforeRemove`. No `usePreventRemove` / `gestureEnabled: false` is
 * needed. An iOS port must revisit this: a native swipe-dismiss would bypass
 * this listener.
 */
export function useDiscardKeepGuard({
  hasUnsavedChanges,
  bypassRef,
  subEditor,
  busyRef,
}: DiscardKeepGuardOptions): DiscardKeepGuard {
  const navigation = useNavigation();
  const promptPendingRef = useRef(false);
  // The close callback is a fresh closure every render; read it through a ref
  // so the listener does not resubscribe on every render.
  const subEditorCloseRef = useRef<(() => void) | undefined>(undefined);
  subEditorCloseRef.current = subEditor?.close;
  const subEditorOpen = subEditor?.open ?? false;
  const subEditorDirty = subEditor?.dirty ?? false;

  const requestClose = (close: () => void, dirty: boolean): void => {
    if (promptPendingRef.current) return;
    if (!dirty) {
      close();
      return;
    }
    promptPendingRef.current = true;
    void confirmDiscard().then((discard) => {
      promptPendingRef.current = false;
      if (discard) close();
    });
  };
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (bypassRef.current) return;
        if (promptPendingRef.current) {
          // A prompt is open: hold every further removal, queue nothing.
          event.preventDefault();
          return;
        }
        const decision = decideGuardOnRemove({
          bypass: false,
          busy: busyRef?.current === true,
          hasUnsavedChanges,
          subEditorOpen,
          subEditorDirty,
          actionType: event.data.action.type,
        });
        if (decision === "allow") return;

        event.preventDefault();
        if (decision === "hold") return; // the in-flight save owns the exit
        if (decision === "close-sub-editor") {
          subEditorCloseRef.current?.();
          return;
        }
        if (decision === "prompt-close-sub-editor") {
          requestCloseRef.current(() => subEditorCloseRef.current?.(), true);
          return;
        }
        promptPendingRef.current = true;
        void confirmDiscard().then((discard) => {
          promptPendingRef.current = false;
          if (discard) navigation.dispatch(event.data.action);
        });
      }),
    [
      busyRef,
      bypassRef,
      hasUnsavedChanges,
      navigation,
      subEditorDirty,
      subEditorOpen,
    ],
  );

  return { requestClose };
}
