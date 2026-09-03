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

/** Sheet heights (dossier §O): compact list vs. half-height detail. */
export type SheetVariant = "compact" | "detail";

export interface SheetProps extends OverlayLifecycle {
  /** Height variant; defaults to `compact`. */
  variant?: SheetVariant;
  children: ReactNode;
}

const MAX_HEIGHT: Record<SheetVariant, DimensionValue> = {
  compact: "40%",
  detail: "60%",
};

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
    >
      <SafeAreaView
        edges={["bottom"]}
        style={[
          styles.sheet,
          { maxHeight: MAX_HEIGHT[variant] },
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>
        <View style={styles.body}>{children}</View>
      </SafeAreaView>
    </BaseOverlay>
  );
}

const styles = StyleSheet.create({
  sheet: {
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
});
