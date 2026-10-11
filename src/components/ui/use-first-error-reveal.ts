/**
 * useFirstErrorReveal — scroll a blocked form to its first problem and focus
 * it (38.9 D-19).
 *
 * Wiring: pass `ref={scrollRef}` AND `innerViewRef={contentRef}` to the
 * form's ScrollView. `reveal(node, focus?)` waits one frame (so an error that
 * was just set, or a section that was just expanded, has laid out), measures
 * `node` against the ScrollView's inner content view and scrolls there with a
 * 16 dp margin, then focuses `focus`.
 *
 * Why the content view (E-X01): under the new architecture `measureLayout`
 * needs a host instance. A numeric `findNodeHandle` result makes it log a
 * dev-only error and return without scrolling or calling its failure
 * callback. The inner content view is a non-collapsable host view, and a y
 * measured against it is a content offset, which is what `scrollTo` takes.
 *
 * `node` and `focus` may be a ref object or the instance itself; a ref is read
 * when the frame runs, so a target that mounts in the same commit still
 * resolves. A failed measure leaves the scroll where it is; focus still runs.
 */
import { type RefObject, useCallback, useRef } from "react";
import type { ScrollView, View } from "react-native";

interface Measurable {
  measureLayout: View["measureLayout"];
}

interface Focusable {
  focus(): void;
}

type RefLike<T> = { readonly current: T | null | undefined };

export type RevealTarget<T> = T | RefLike<T> | null | undefined;

/** Scroll margin above the revealed field, in dp. */
export const REVEAL_TOP_MARGIN = 16;

function resolveTarget<T extends object>(target: RevealTarget<T>): T | null {
  if (target == null) return null;
  if ("current" in target) return (target as RefLike<T>).current ?? null;
  return target as T;
}

export function useFirstErrorReveal() {
  const scrollRef = useRef<ScrollView>(null);
  // ScrollView.d.ts types `innerViewRef` as `RefObject<View>` (non-null)
  // while the runtime takes any ref setter (ScrollView.js `innerViewRef?:
  // RefSetter<InnerViewInstance>`), so the null-initialised ref is widened
  // here once. `current` is still null until the content view mounts.
  const contentRef = useRef<View>(null) as RefObject<View>;

  const reveal = useCallback(
    (node: RevealTarget<Measurable>, focus?: RevealTarget<Focusable>) => {
      requestAnimationFrame(() => {
        const target = resolveTarget(node);
        const content: View | null = contentRef.current;
        if (target && content) {
          target.measureLayout(
            content,
            (_x, y) =>
              scrollRef.current?.scrollTo({
                y: Math.max(0, y - REVEAL_TOP_MARGIN),
                animated: true,
              }),
            () => {},
          );
        }
        resolveTarget(focus)?.focus();
      });
    },
    [],
  );

  return { scrollRef, contentRef, reveal };
}
