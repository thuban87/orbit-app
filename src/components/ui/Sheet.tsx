/**
 * Sheet (THEME-10 / dossier §O) — the shared bottom-sheet overlay with two
 * heights: `compact` (short pickers / small option lists) and `detail` (detail
 * views / medium forms, ~half height). Both share the `radius.xl` top corners,
 * the themed drag handle, the scrim, spacing and safe-area conventions with
 * `Modal` via `overlay-base`. Non-destructive: dismisses on scrim-tap and
 * Android Back.
 *
 * No colour literal (check:colors).
 */
import type { ReactNode } from "react";
import { type DimensionValue, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { BaseOverlay, type OverlayLifecycle } from "./overlay-base";
import {
  SHEET_BODY_FLEX,
  SHEET_HEIGHT_PERCENT,
  type SheetVariant,
} from "./sheet-contract";

/** Sheet heights (dossier §O): compact list vs. half-height detail. */
export type { SheetVariant } from "./sheet-contract";

export interface SheetProps extends OverlayLifecycle {
  /** Height variant; defaults to `compact`. */
  variant?: SheetVariant;
  children: ReactNode;
}

export function Sheet({
  visible,
  onRequestClose,
  variant = "compact",
  children,
}: SheetProps) {
  const { colors } = useTheme();
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
        <View
          style={[
            styles.body,
            SHEET_BODY_FLEX[variant] === 1 ? styles.expandedBody : null,
          ]}
        >
          {children}
        </View>
      </SafeAreaView>
    </BaseOverlay>
  );
}

const styles = StyleSheet.create({
  // Percent-height variants need a concrete parent height. Without this flex
  // wrapper, a detail sheet can clip its last action at large system fonts.
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
});
