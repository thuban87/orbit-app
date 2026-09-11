import { StyleSheet, Text, View } from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import { useTheme } from "@/theme";

/** A calm, deep-link-ready seam until the Group Events workflow lands. */
export function GroupEventsScreen() {
  const { colors } = useTheme();

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Group Events" />
      <View style={styles.content}>
        <Text accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary }]}>
          Coming soon
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Group logging arrives with Group Events.
        </Text>
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
    gap: 8,
    paddingHorizontal: 32,
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
