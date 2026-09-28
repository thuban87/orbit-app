/**
 * Sheet (THEME-10 / dossier §O) — the shared bottom-sheet overlay with two
 * heights: `compact` (short pickers / small option lists) and `detail` (detail
 * views / medium forms, ~half height). Both share the `radius.xl` top corners,
 * the themed drag handle, the scrim, spacing and safe-area conventions with
 * `Modal` via `overlay-base`. Non-destructive: dismisses on scrim-tap and
 * Android Back.
 *
 * Body (38.4 D-32, RG-034 follow-on, device-found): `compact` and `detail`
 * cap their height with a percent `maxHeight`, so at large system text their
 * body is a bounded ScrollView (`flexGrow: 0`, `flexShrink: 1`) — content that
 * fits renders at its own height, content taller than the cap scrolls instead
 * of clipping its actions below the sheet edge. A consumer that renders its own
 * ScrollView inside a compact/detail sheet sets `scrollBody` to false; its body
 * is then a shrinkable View, so its own ScrollView is the single bounded scroll.
 * `expanded` is a fixed 92% sheet with a `flex: 1` body; its consumers own their
 * workspace scroll. `sheet-consumers-contract.test.ts` pins every consumer.
 *
 * Keyboard (38.4 D-72, Plan 17 G1-f): the Modal window is edge-to-edge, so
 * Android does not resize it for the soft keyboard. While the keyboard is up
 * the sheet is lifted above it and bounded by the room left
 * (`sheetKeyboardLayout`); its body scrolls as above.
 *
 * No colour literal (check:colors).
 */
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  type DimensionValue,
  Keyboard,
  type LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { BaseOverlay, type OverlayLifecycle } from "./overlay-base";
import {
  SHEET_BODY_FLEX,
  SHEET_BODY_SCROLLS,
  SHEET_HEIGHT_PERCENT,
  type SheetVariant,
  sheetKeyboardLayout,
} from "./sheet-contract";

/** Sheet heights (dossier §O): compact list vs. half-height detail. */
export type { SheetVariant } from "./sheet-contract";

export interface SheetProps extends OverlayLifecycle {
  /** Height variant; defaults to `compact`. */
  variant?: SheetVariant;
  /**
   * Whether a compact/detail body scrolls inside the sheet (default `true`,
   * D-32). Pass `false` when the consumer renders its own ScrollView inside a
   * compact/detail sheet, so no two vertical ScrollViews nest. Ignored by
   * `expanded`.
   */
  scrollBody?: boolean;
  children: ReactNode;
}

export function Sheet({
  visible,
  onRequestClose,
  variant = "compact",
  scrollBody = true,
  children,
}: SheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(() =>
    Keyboard.isVisible() ? (Keyboard.metrics()?.height ?? 0) : 0,
  );
  const [frameHeight, setFrameHeight] = useState(0);
  const restingFrameHeight = useRef(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (event) =>
      setKeyboardHeight(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const onFrameLayout = (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    restingFrameHeight.current = Math.max(restingFrameHeight.current, height);
    setFrameHeight(height);
  };
  const keyboardLayout = sheetKeyboardLayout({
    variant,
    frameHeight,
    restingFrameHeight: restingFrameHeight.current,
    keyboardHeight,
    topClearance: insets.top + SPACING.lg,
  });
  const body =
    variant === "expanded" ? (
      <View
        style={[
          styles.body,
          SHEET_BODY_FLEX[variant] === 1 ? styles.expandedBody : null,
        ]}
      >
        {children}
      </View>
    ) : SHEET_BODY_SCROLLS[variant] && scrollBody ? (
      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      >
        {children}
      </ScrollView>
    ) : (
      <View style={[styles.body, styles.boundedBody]}>{children}</View>
    );
  return (
    <BaseOverlay
      visible={visible}
      onRequestClose={onRequestClose}
      justify="flex-end"
      dismissable
      scrimAccessibilityLabel="Dismiss"
      contentStyle={styles.overlayContent}
    >
      <View
        pointerEvents="box-none"
        onLayout={onFrameLayout}
        style={[styles.keyboardFrame, { paddingBottom: keyboardLayout.lift }]}
      >
        <SafeAreaView
          edges={["bottom"]}
          style={[
            styles.sheet,
            variant === "expanded"
              ? { height: SHEET_HEIGHT_PERCENT.expanded as DimensionValue }
              : { maxHeight: SHEET_HEIGHT_PERCENT[variant] as DimensionValue },
            keyboardLayout.size === null
              ? null
              : variant === "expanded"
                ? { height: keyboardLayout.size }
                : { maxHeight: keyboardLayout.size },
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>
          {body}
        </SafeAreaView>
      </View>
    </BaseOverlay>
  );
}

const styles = StyleSheet.create({
  // Percent-height variants need a concrete parent height to resolve against;
  // this flex wrapper provides it. Content taller than the percent cap then
  // scrolls in the bounded body below instead of clipping (D-32).
  overlayContent: { flex: 1, justifyContent: "flex-end" },
  // Fills the overlay; its bottom padding lifts the sheet above the keyboard
  // (D-72). box-none: the empty area above the sheet still reaches the scrim.
  keyboardFrame: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    flexDirection: "column",
    borderTopLeftRadius: RADII.xl,
    borderTopRightRadius: RADII.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: RADII.pill,
  },
  body: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  expandedBody: { flex: 1 },
  // Content-sized until the percent cap, then shrinks and scrolls (D-32).
  scrollBody: { flexGrow: 0, flexShrink: 1 },
  // Opted-out body: shrinks under the cap so the consumer's ScrollView bounds.
  boundedBody: { flexShrink: 1, minHeight: 0 },
});
