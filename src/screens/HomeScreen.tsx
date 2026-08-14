import { StyleSheet, Text, View } from "react-native";
import { APP_NAME } from "@/constants/app";
import { useTheme } from "@/theme";

/**
 * The themed home shell — the Walking Skeleton's single real UI interaction.
 *
 * Every colour comes from `useTheme().colors.*`; there is not one hardcoded
 * colour value here (CLAUDE.md). The root view carries `testID`
 * `home-shell-root` and the title renders `APP_NAME` (the single source of the
 * display name — currently "Orbit") so plan 01-05 can assert the rendered
 * shell on the Pixel via `uiautomator dump`.
 */
export function HomeScreen() {
  const { colors } = useTheme();

  return (
    <View
      testID="home-shell-root"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <Text
        accessibilityRole="header"
        accessibilityLabel={APP_NAME}
        style={[styles.title, { color: colors.textPrimary }]}
      >
        {APP_NAME}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Your people, in orbit.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 15,
  },
});
