import { Pressable, StyleSheet, Text, View } from "react-native";
import { snackbarStore } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";

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
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {snackbar.label}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={snackbar.action.accessibilityLabel}
          onPress={() => {
            dismiss();
            snackbar.action.onPress();
          }}
          style={styles.action}
        >
          <Text style={[styles.actionLabel, { color: colors.accent }]}>
            {snackbar.action.label}
          </Text>
        </Pressable>
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
            <Text style={[styles.actionLabel, { color: colors.accent }]}>
              {snackbar.secondaryAction.label}
            </Text>
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
    paddingHorizontal: 16,
  },
  surface: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    maxWidth: "100%",
    minHeight: 48,
    paddingLeft: 16,
  },
  label: {
    flexShrink: 1,
    fontSize: 15,
  },
  action: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 56,
    paddingHorizontal: 12,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
});
