/**
 * useKeyboardCentering — raise a focused entry field and centre it in the
 * space left above the keyboard (38.10 D-66).
 *
 * Host wiring (plans 13, 14, 15, 17):
 *
 *   const { centering, bottomSpacer } = useKeyboardCentering({ scrollRef, contentRef });
 *   <ScrollView ref={scrollRef} innerViewRef={contentRef}>
 *     <KeyboardCenteringProvider value={centering}>…</KeyboardCenteringProvider>
 *     {bottomSpacer}
 *   </ScrollView>
 *
 * Hosts that already use `useFirstErrorReveal` pass its `scrollRef` /
 * `contentRef`; others create the same pair.
 *
 * How it works:
 * - `EntryTextField` calls `centering.onFieldFocus(ref)` / `onFieldBlur(ref)`
 *   through the provider context. A blur clears the active field only when it
 *   is the active one (`activeAfterBlur`).
 * - The keyboard top is `endCoordinates.screenY` from `keyboardDidShow` (or
 *   `Keyboard.metrics()` on focus when the keyboard is already up). A show
 *   re-centres only while the active field still holds focus
 *   (`fieldToCentreOnShow`; convergence c2 G-U5).
 * - The field is measured with `measureLayout` against the content view (not
 *   `findNodeHandle`; E-X01, see use-first-error-reveal.ts) and the ScrollView
 *   with `measureInWindow`.
 * - The window is edge-to-edge, so a bottom spacer gives the scroll range room
 *   above the keyboard: `keyboardSpacer` (overlap plus centring slack while an
 *   entry field is active; overlap alone otherwise). A ScrollView clamps a
 *   scroll past its current content, so the spacer height is set first and the
 *   one `scrollTo` runs from the spacer's `onLayout` once the new height has
 *   laid out (this plan only: mechanism; convergence c6, Codex C-01).
 *
 * One `scrollTo({ animated: true })` per focus or keyboard event; the spacer
 * height changes once per event. Nothing is driven per frame (CLAUDE.md).
 * No keyboard-avoiding wrapper view and no keyboard package (RESEARCH
 * package audit).
 */
import {
  createElement,
  type ReactElement,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Keyboard,
  type LayoutChangeEvent,
  type ScrollView,
  View,
} from "react-native";
import {
  activeAfterBlur,
  CENTERING_MARGIN,
  centeredScrollY,
  fieldToCentreOnShow,
  keyboardSpacer,
} from "./centered-scroll";
import type {
  CenteringFieldRef,
  KeyboardCentering,
} from "./KeyboardCenteringProvider";

export interface UseKeyboardCenteringArgs {
  scrollRef: RefObject<ScrollView | null>;
  contentRef: RefObject<View | null>;
}

export interface UseKeyboardCenteringResult {
  /** Stable across renders; pass to `KeyboardCenteringProvider`. */
  centering: KeyboardCentering;
  /** Render as the ScrollView's last child. */
  bottomSpacer: ReactElement;
}

/** A spacer height within this many dp of the target counts as laid out. */
const SPACER_TOLERANCE = 1;

/** The keyboard's top edge in window coordinates, or null when it is down. */
function currentKeyboardTop(): number | null {
  if (!Keyboard.isVisible()) return null;
  const metrics = Keyboard.metrics();
  return metrics ? metrics.screenY : null;
}

export function useKeyboardCentering({
  scrollRef,
  contentRef,
}: UseKeyboardCenteringArgs): UseKeyboardCenteringResult {
  const [spacerHeight, setSpacerHeight] = useState(0);
  const activeRef = useRef<CenteringFieldRef | null>(null);
  const keyboardTopRef = useRef<number | null>(null);
  // The spacer's laid-out height, so `contentH` can exclude it.
  const spacerLaidOutRef = useRef(0);
  // A scroll waiting for the spacer to reach `pendingSpacer`.
  const pendingScrollRef = useRef<number | null>(null);
  const pendingSpacerRef = useRef<number | null>(null);

  const scrollTo = useCallback(
    (y: number) => {
      scrollRef.current?.scrollTo({ y, animated: true });
    },
    [scrollRef],
  );

  /**
   * Set the spacer first; scroll now if it is already at that height, else
   * from the spacer's onLayout once it has laid out.
   */
  const applySpacerThenScroll = useCallback(
    (spacer: number, y: number | null) => {
      if (Math.abs(spacer - spacerLaidOutRef.current) < SPACER_TOLERANCE) {
        pendingScrollRef.current = null;
        pendingSpacerRef.current = null;
        if (y !== null) scrollTo(y);
        return;
      }
      pendingScrollRef.current = y;
      pendingSpacerRef.current = spacer;
      setSpacerHeight(spacer);
    },
    [scrollTo],
  );

  /** Keyboard clearance only (no active entry field): the overlap. */
  const clearOnly = useCallback(() => {
    const scroll = scrollRef.current?.getNativeScrollRef() ?? null;
    const keyboardTop = keyboardTopRef.current;
    if (!scroll || keyboardTop === null) {
      applySpacerThenScroll(0, null);
      return;
    }
    scroll.measureInWindow((_x, viewportTop, _w, viewportHeight) => {
      // A newer entry field took focus meanwhile: its centring owns the spacer.
      if (fieldToCentreOnShow(activeRef.current) !== null) return;
      applySpacerThenScroll(
        keyboardSpacer({
          viewportTop,
          viewportBottom: viewportTop + viewportHeight,
          keyboardTop,
          fieldH: 0,
          active: false,
        }),
        null,
      );
    });
  }, [scrollRef, applySpacerThenScroll]);

  /** Centre the active field above the keyboard: one scroll at most. */
  const centre = useCallback(() => {
    const field = activeRef.current?.current ?? null;
    // The ScrollView's host view; `measureInWindow` lives there.
    const scroll = scrollRef.current?.getNativeScrollRef() ?? null;
    const content = contentRef.current;
    const keyboardTop = keyboardTopRef.current;
    if (!field || !scroll || !content || keyboardTop === null) return;
    scroll.measureInWindow((_sx, viewportTop, _sw, viewportHeight) => {
      field.measureLayout(
        content,
        (_fx, fieldY, _fw, fieldH) => {
          field.measureInWindow((_wx, fieldWindowY) => {
            content.measure((_cx, _cy, _cw, contentFullH) => {
              const viewportBottom = viewportTop + viewportHeight;
              const spacer = keyboardSpacer({
                viewportTop,
                viewportBottom,
                keyboardTop,
                fieldH,
                active: true,
              });
              // The content view sits at the scroll origin, so the field's
              // window y gives the current scroll offset.
              const scrollY = viewportTop + fieldY - fieldWindowY;
              const y = centeredScrollY({
                fieldY,
                fieldH,
                viewportTop,
                viewportBottom,
                keyboardTop,
                scrollY,
                contentH: Math.max(0, contentFullH - spacerLaidOutRef.current),
                margin: CENTERING_MARGIN,
              });
              applySpacerThenScroll(spacer, y === scrollY ? null : y);
            });
          });
        },
        () => {},
      );
    });
  }, [scrollRef, contentRef, applySpacerThenScroll]);

  const onFieldFocus = useCallback(
    (fieldRef: CenteringFieldRef) => {
      activeRef.current = fieldRef;
      // The keyboard may already be up (moving between fields).
      keyboardTopRef.current = currentKeyboardTop();
      if (keyboardTopRef.current !== null) centre();
    },
    [centre],
  );

  const onFieldBlur = useCallback(
    (fieldRef: CenteringFieldRef) => {
      const before = activeRef.current;
      activeRef.current = activeAfterBlur(before, fieldRef);
      // The centring slack goes once no entry field is active.
      if (before !== null && activeRef.current === null) clearOnly();
    },
    [clearOnly],
  );

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (event) => {
      keyboardTopRef.current = event.endCoordinates.screenY;
      if (fieldToCentreOnShow(activeRef.current) !== null) centre();
      else clearOnly();
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      keyboardTopRef.current = null;
      pendingScrollRef.current = null;
      pendingSpacerRef.current = null;
      setSpacerHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [centre, clearOnly]);

  const onSpacerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const height = event.nativeEvent.layout.height;
      spacerLaidOutRef.current = height;
      const target = pendingSpacerRef.current;
      const y = pendingScrollRef.current;
      if (target === null || Math.abs(height - target) >= SPACER_TOLERANCE) {
        return;
      }
      pendingSpacerRef.current = null;
      pendingScrollRef.current = null;
      if (y !== null) scrollTo(y);
    },
    [scrollTo],
  );

  const centering = useMemo<KeyboardCentering>(
    () => ({ onFieldFocus, onFieldBlur }),
    [onFieldFocus, onFieldBlur],
  );

  const bottomSpacer = createElement(View, {
    accessible: false,
    importantForAccessibility: "no-hide-descendants",
    onLayout: onSpacerLayout,
    style: { height: spacerHeight },
  });

  return { centering, bottomSpacer };
}
