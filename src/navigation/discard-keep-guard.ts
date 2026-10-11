import { useNavigation } from "@react-navigation/native";
import { type RefObject, useEffect, useRef } from "react";
import { type ConfirmRequest, confirmStore } from "@/stores/confirm-store";

type DiscardKeepGuardOptions = {
  hasUnsavedChanges: boolean;
  bypassRef: RefObject<boolean>;
};

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

/** Whether a route removal leaves at once or must prompt first (D-13). */
export function decideGuardOnRemove({
  hasUnsavedChanges,
  bypass,
}: {
  hasUnsavedChanges: boolean;
  bypass: boolean;
}): "allow" | "prompt" {
  return bypass || !hasUnsavedChanges ? "allow" : "prompt";
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
 * prevented, so the route stays, but queues no second prompt.
 */
export function useDiscardKeepGuard({
  hasUnsavedChanges,
  bypassRef,
}: DiscardKeepGuardOptions): void {
  const navigation = useNavigation();
  const promptPendingRef = useRef(false);

  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (
          decideGuardOnRemove({
            hasUnsavedChanges,
            bypass: bypassRef.current,
          }) === "allow"
        ) {
          return;
        }

        event.preventDefault();
        if (promptPendingRef.current) return;
        promptPendingRef.current = true;
        void confirmDiscard().then((discard) => {
          promptPendingRef.current = false;
          if (discard) navigation.dispatch(event.data.action);
        });
      }),
    [bypassRef, hasUnsavedChanges, navigation],
  );
}
