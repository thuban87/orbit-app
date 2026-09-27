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
 * ScrollView inside a compact/detail sheet passes `scrollBody={false}`; its body
 * is then a shrinkable View, so its own ScrollView is the single bounded scroll.
 * `expanded` is a fixed 92% sheet with a `flex: 1` body; its consumers own their
 * workspace scroll. `sheet-consumers-contract.test.ts` pins every consumer.
 *
 * No colour literal (check:colors).
 */
import type { ReactNode } from "react";
import {
  type DimensionValue,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { BaseOverlay, type OverlayLifecycle } from "./overlay-base";
import {
  SHEET_BODY_FLEX,
  SHEET_BODY_SCROLLS,
  SHEET_HEIGHT_PERCENT,
  type SheetVariant,
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
      <SafeAreaView
        edges={["bottom"]}
        style={[
          styles.sheet,
          variant === "expanded"
            ? { height: SHEET_HEIGHT_PERCENT.expanded as DimensionValue }
            : { maxHeight: SHEET_HEIGHT_PERCENT[variant] as DimensionValue },
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        accessibilityViewIsModal
      >
        <View style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>
        {body}
      </SafeAreaView>
    </BaseOverlay>
  );
}

const styles = StyleSheet.create({
  // Percent-height variants need a concrete parent height to resolve against;
  // this flex wrapper provides it. Content taller than the percent cap then
  // scrolls in the bounded body below instead of clipping (D-32).
  overlayContent: { flex: 1, justifyContent: "flex-end" },
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
