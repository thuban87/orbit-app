import { StyleSheet, Text, View } from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import { ChromeScrim } from "@/components/ui/ChromeScrim";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";

/** A calm, deep-link-ready seam until the Group Events workflow lands. */
export function GroupEventsScreen() {
  const { colors } = useTheme();

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Group Events" />
      <View style={styles.content}>
        <ChromeScrim style={styles.panel} radius={RADII.lg}>
          <Text accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary }]}>
            Coming soon
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Group logging arrives with Group Events.
          </Text>
        </ChromeScrim>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  panel: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 20,
    overflow: "hidden",
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
});
