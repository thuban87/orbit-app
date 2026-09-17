// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography variant.
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/ui/AppText";
import { snackbarStore } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";

/** A single host for commit-truthful feedback above every shell browse surface. */
export function Snackbar() {
  const { colors } = useTheme();
  const snackbar = snackbarStore((state) => state.snackbar);
  const dismiss = snackbarStore((state) => state.dismiss);

  if (!snackbar) return null;

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <View
        accessibilityLiveRegion="polite"
        style={[
          styles.surface,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <AppText role="caption" style={styles.label}>
          {snackbar.label}
        </AppText>
        {snackbar.action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={snackbar.action.accessibilityLabel}
            onPress={() => {
              const action = snackbar.action;
              dismiss();
              action?.onPress();
            }}
            style={styles.action}
          >
            <AppText role="label" style={{ color: colors.accent }}>
              {snackbar.action.label}
            </AppText>
          </Pressable>
        ) : null}
        {snackbar.secondaryAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={snackbar.secondaryAction.accessibilityLabel}
            onPress={() => {
              dismiss();
              snackbar.secondaryAction?.onPress();
            }}
            style={styles.action}
          >
            <AppText role="label" style={{ color: colors.accent }}>
              {snackbar.secondaryAction.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 112,
    paddingHorizontal: SPACING.base,
  },
  surface: {
    alignItems: "center",
    borderRadius: RADII.pill,
    borderWidth: 1,
    flexDirection: "row",
    maxWidth: "100%",
    minHeight: 48,
    paddingLeft: SPACING.base,
  },
  label: {
    flexShrink: 1,
  },
  action: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 56,
    paddingHorizontal: SPACING.md,
  },
});
