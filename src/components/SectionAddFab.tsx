/**
 * The section Add FAB (Phase 38.10 D-131, gap G2).
 *
 * On the section pages the solid Add sits at the top of the content. When it
 * scrolls out of view it animates ("sucked down") into a second FAB at the
 * bottom LEFT, opposite the universal FAB; scrolling back up reverses it. The
 * FAB shows the page's icon with a small + overlaid. Tapping it scrolls the
 * page to the top and opens the add form there (the host's `onPress`).
 *
 * - `useSectionAddMorph()` owns the scroll position, the measured rects and
 *   the morph progress as Reanimated shared values. The scroll handler runs on
 *   the UI thread; React state changes only when the target crosses its
 *   threshold (`fabShown`), never per frame (CLAUDE.md).
 * - The FAB is hidden and out of the accessibility tree while the Add is on
 *   screen, while a form is open, while the keyboard is up (mirrors
 *   UniversalFab's keyboard rule) and before the read has loaded.
 * - Pause convention (CLAUDE.md, D-131): on blur or when the app leaves the
 *   foreground the morph is cancelled and snapped to its target, and while
 *   it stays paused any later target change (the global keyboard listeners,
 *   a save from the screen above) snaps too: duration 0, never a timing on a
 *   hidden screen (review WR-02). Reduced motion snaps it (duration 0).
 * - Presence (D-132): while the FAB is SHOWN on a focused screen it registers
 *   in `section-fab-store`, which the root snackbar reads (plan 23). While it
 *   is mounted on a focused screen it also registers as AVAILABLE, so the
 *   root snackbar holds a position clear of it before it appears (D-151).
 * - Look: the universal FAB's (accent fill, `onAccent` glyphs and ring). No
 *   Android elevation on this layer: it animates opacity, and elevation on a
 *   translucent layer paints an opaque inner rect (owner memory).
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md).
 */
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useId, useState } from "react";
import {
  AppState,
  Keyboard,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  cancelAnimation,
  runOnJS,
  runOnUI,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/ui/AppText";
import { buttonVisual } from "@/components/ui/button-roles";
import { FAB_SIDE_INSET, FAB_SIZE } from "@/navigation/use-bottom-clearance";
import { useSectionFabStore } from "@/stores/section-fab-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { useReducedMotionShared } from "@/theme/use-reduced-motion";
import { Icon } from "./icons/Icon";
import type { IconName } from "./icons/icon-registry";
import {
  FAB_ICON_SIZE,
  FAB_PLUS_SIZE,
  fabA11yProps,
  fabSuppressed,
  fabTargetAfterScroll,
  MORPH_DURATION_MS,
  morphFrame,
  sectionFabBottomOffset,
  sectionFabClearance,
  snapOnPause,
} from "./section-add-fab-logic";
import { FAB_BORDER_COLOR_KEY, FAB_BORDER_WIDTH } from "./universal-fab-logic";

/** A measured frame: the Add bar in scroll-content coordinates, the rest in the screen root's. */
interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const EMPTY_BOX: LayoutBox = { x: 0, y: 0, width: 0, height: 0 };

function boxOf(event: LayoutChangeEvent): LayoutBox {
  const { x, y, width, height } = event.nativeEvent.layout;
  return { x, y, width, height };
}

export interface SectionAddMorph {
  /** 0 = the Add bar at the top, 1 = the bottom-left FAB. */
  progress: SharedValue<number>;
  scrollY: SharedValue<number>;
  /** The Add bar's frame inside the scroll content. */
  bar: SharedValue<LayoutBox>;
  /** The ScrollView's frame inside the screen root. */
  viewport: SharedValue<LayoutBox>;
  /** The screen root's frame. */
  root: SharedValue<LayoutBox>;
  /** The FAB is shown (a threshold crossing, not a per-frame value). */
  fabShown: boolean;
  /** The route is a focused workflow (tab bar hidden; the root reaches the window's bottom). */
  focusedRoute: boolean;
  /** The screen is focused (`useIsFocused`). */
  isFocused: boolean;
  scrollHandler: ReturnType<typeof useAnimatedScrollHandler>;
  onBarLayout: (event: LayoutChangeEvent) => void;
  onViewportLayout: (event: LayoutChangeEvent) => void;
  onRootLayout: (event: LayoutChangeEvent) => void;
}

export function useSectionAddMorph({
  loaded,
  formOpen,
  focusedRoute,
}: {
  /** The page's read has loaded (before it, there is no Add to morph). */
  loaded: boolean;
  /** Any form (add or edit) is open on the page. */
  formOpen: boolean;
  focusedRoute: boolean;
}): SectionAddMorph {
  const isFocused = useIsFocused();
  const reducedMotion = useReducedMotionShared();
  const ownerId = useId();
  const [keyboardUp, setKeyboardUp] = useState(false);
  const [appActive, setAppActive] = useState(
    AppState.currentState === "active",
  );
  const [fabShown, setFabShown] = useState(false);

  const progress = useSharedValue(0);
  const target = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const suppressedShared = useSharedValue(true);
  // Blurred or backgrounded (the pause convention), mirrored for the UI thread.
  const paused = useSharedValue(false);
  const bar = useSharedValue<LayoutBox>(EMPTY_BOX);
  const viewport = useSharedValue<LayoutBox>(EMPTY_BOX);
  const root = useSharedValue<LayoutBox>(EMPTY_BOX);

  const suppressed = fabSuppressed({ loaded, formOpen, keyboardUp });

  // The one worklet that moves the target. Declared ABOVE both of its callers
  // (the scroll handler and the suppression effect): a worklet calling one
  // defined later is undefined on device (memory worklet-forward-ref-hazard).
  const applyTarget = (next: 0 | 1) => {
    "worklet";
    if (next === target.value) return;
    target.value = next;
    // Paused (blurred or backgrounded) or reduced motion: snap, never animate.
    progress.value = withTiming(next, {
      duration: reducedMotion.value || paused.value ? 0 : MORPH_DURATION_MS,
    });
    runOnJS(setFabShown)(next === 1);
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
      const box = bar.value;
      applyTarget(
        fabTargetAfterScroll(
          target.value,
          event.contentOffset.y,
          box.y + box.height,
          suppressedShared.value,
        ),
      );
    },
  });

  // Pause convention: blurred or backgrounded, the morph stops at its target,
  // and `paused` makes every later target change snap until focus and the
  // foreground return (WR-02). Declared ABOVE the suppression effect so a
  // render that both pauses and changes suppression pauses first.
  useEffect(() => {
    runOnUI((next: boolean) => {
      "worklet";
      paused.value = next;
      if (!next) return;
      cancelAnimation(progress);
      progress.value = snapOnPause(target.value);
    })(!(isFocused && appActive));
  }, [isFocused, appActive, paused, progress, target]);

  // Suppression is mirrored into a shared value, and the target is
  // re-evaluated from the last scroll position (a form closing while the page
  // is scrolled down shows the FAB again).
  // biome-ignore lint/correctness/useExhaustiveDependencies: applyTarget is a fresh worklet each render over the same stable shared values; only a suppression change re-evaluates.
  useEffect(() => {
    runOnUI((next: boolean) => {
      "worklet";
      suppressedShared.value = next;
      const box = bar.value;
      applyTarget(
        fabTargetAfterScroll(
          target.value,
          scrollY.value,
          box.y + box.height,
          next,
        ),
      );
    })(suppressed);
  }, [suppressed]);

  // Keyboard up hides the FAB, as UniversalFab does.
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardUp(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardUp(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setAppActive(state === "active"),
    );
    return () => subscription.remove();
  }, []);

  // D-132 presence: registered only while the FAB is shown on a focused
  // screen; a hide, a blur or an unmount unregisters it.
  useEffect(() => {
    if (!(isFocused && fabShown)) return;
    const { register, unregister } = useSectionFabStore.getState();
    register(ownerId);
    return () => unregister(ownerId);
  }, [isFocused, fabShown, ownerId]);

  const onBarLayout = useCallback(
    (event: LayoutChangeEvent) => {
      bar.value = boxOf(event);
    },
    [bar],
  );
  const onViewportLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewport.value = boxOf(event);
    },
    [viewport],
  );
  const onRootLayout = useCallback(
    (event: LayoutChangeEvent) => {
      root.value = boxOf(event);
    },
    [root],
  );

  return {
    progress,
    scrollY,
    bar,
    viewport,
    root,
    fabShown,
    focusedRoute,
    isFocused,
    scrollHandler,
    onBarLayout,
    onViewportLayout,
    onRootLayout,
  };
}

/**
 * Scroll-content bottom padding so the last entry scrolls fully above the
 * section FAB (on a focused route: the safe-area inset + gap + FAB + gap).
 * Named apart from `useBottomClearance` on purpose: focused screens must not
 * call that one (`fab-clearance-contract.test.ts`).
 */
export function useSectionFabClearance(focused = true): number {
  const insets = useSafeAreaInsets();
  return sectionFabClearance({ focused, insetBottom: insets.bottom });
}

export interface SectionAddFabProps {
  morph: SectionAddMorph;
  /** The page's icon (`sectionFabIcon`); null (Imported, D-35) renders nothing. */
  icon: IconName | null;
  /** The Add bar's label, shown while the overlay is still the bar. */
  label: string;
  hint: string;
  onPress: () => void;
}

/**
 * The bottom-left morph overlay. Render it LAST in the screen root (the View
 * whose `onLayout` is `morph.onRootLayout`).
 */
export function SectionAddFab({
  morph,
  icon,
  label,
  hint,
  onPress,
}: SectionAddFabProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const availableId = useId();
  // D-151 availability: while this screen is focused and the FAB can show, the
  // root snackbar must sit clear of it even before the scroll morph brings it
  // up, so it never has to hop. Hosts render this component only when the page
  // can add, and a null icon (Imported) renders nothing, so it never registers.
  const available = morph.isFocused && icon !== null;
  useEffect(() => {
    if (!available) return;
    const { registerAvailable, unregisterAvailable } =
      useSectionFabStore.getState();
    registerAvailable(availableId);
    return () => unregisterAvailable(availableId);
  }, [available, availableId]);
  const fabBottom = sectionFabBottomOffset({
    focused: morph.focusedRoute,
    insetBottom: insets.bottom,
  });
  // The bar is a primary Button: its corner radius is the morph's start.
  const barRadius = RADII[buttonVisual("primary").radiusToken];
  const { progress, scrollY, bar, viewport, root } = morph;

  const frame = useDerivedValue(() => {
    const port = viewport.value;
    const box = bar.value;
    // The bar's rect, clamped to the viewport's top edge it left through.
    const barTop = Math.max(port.y, port.y + box.y - scrollY.value);
    return morphFrame(
      progress.value,
      {
        x: port.x + box.x,
        y: barTop,
        width: box.width,
        height: box.height,
        radius: barRadius,
      },
      {
        x: FAB_SIDE_INSET,
        y: root.value.height - fabBottom - FAB_SIZE,
        width: FAB_SIZE,
        height: FAB_SIZE,
        radius: FAB_SIZE / 2,
      },
    );
  });
  const frameStyle = useAnimatedStyle(() => {
    const current = frame.value;
    return {
      left: current.x,
      top: current.y,
      width: current.width,
      height: current.height,
      borderRadius: current.radius,
      opacity: current.overlayOpacity,
    };
  });
  const labelStyle = useAnimatedStyle(() => ({
    opacity: frame.value.labelOpacity,
  }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: frame.value.iconOpacity,
  }));

  if (icon === null) return null;

  const shown = morph.fabShown;
  const a11y = fabA11yProps(shown);
  return (
    <Animated.View
      pointerEvents={shown ? "box-none" : "none"}
      style={[
        styles.overlay,
        {
          backgroundColor: colors.accent,
          borderColor: colors[FAB_BORDER_COLOR_KEY],
          borderWidth: FAB_BORDER_WIDTH,
        },
        frameStyle,
      ]}
    >
      <Pressable
        testID="section-add-fab"
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessible={a11y.accessible}
        importantForAccessibility={a11y.importantForAccessibility}
        accessibilityElementsHidden={a11y.accessibilityElementsHidden}
        pointerEvents={a11y.pointerEvents}
        onPress={onPress}
        style={StyleSheet.absoluteFill}
      >
        <Animated.View style={[styles.layer, labelStyle]}>
          {/* biome-ignore lint/a11y/useValidAriaRole: AppText role is a typography role. */}
          <AppText
            role="label"
            numberOfLines={1}
            style={{ color: colors.onAccent }}
          >
            {label}
          </AppText>
        </Animated.View>
        <Animated.View style={[styles.layer, iconStyle]}>
          <View>
            <Icon name={icon} size={FAB_ICON_SIZE} tone="onAccent" />
            <View style={styles.plus}>
              <Icon name="add" size={FAB_PLUS_SIZE} tone="onAccent" />
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", overflow: "hidden" },
  layer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  plus: { position: "absolute", right: -9, top: -7 },
});
