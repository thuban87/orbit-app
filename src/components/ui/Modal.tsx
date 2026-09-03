/**
 * Modal (THEME-10 / dossier §O) — the shared FULL-SCREEN overlay variant for
 * full workflows / editors. Bottom-anchored, near-full-height, with `radius.xl`
 * TOP corners revealing the scrim above, a themed drag handle, and safe-area
 * insets. Non-destructive: dismisses on scrim-tap and Android Back (via the
 * shared `BaseOverlay` lifecycle contract).
 *
 * Shares radius/scrim/spacing/typography with `Sheet` and `ConfirmDialog` through
 * `overlay-base` + the pure tokens. No colour literal (check:colors).
 */
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { BaseOverlay, type OverlayLifecycle } from "./overlay-base";

export interface ModalProps extends OverlayLifecycle {
  children: ReactNode;
}

export function Modal({ visible, onRequestClose, children }: ModalProps) {
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
    height: "94%",
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
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
});
