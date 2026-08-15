import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { APP_NAME } from "@/constants/app";
import { CustomFieldsScreen } from "@/screens/CustomFieldsScreen";
import { useTheme } from "@/theme";

/**
 * The themed home shell — the Walking Skeleton's single real UI interaction.
 *
 * Every colour comes from `useTheme().colors.*`; there is not one hardcoded
 * colour value here (CLAUDE.md). The root view carries `testID`
 * `home-shell-root` and the title renders `APP_NAME` (the single source of the
 * display name — currently "Orbit") so plan 01-05 can assert the rendered
 * shell on the Pixel via `uiautomator dump`.
 *
 * REACHABILITY (Plan 08): a dependency-free screen-state toggle routes to the
 * Custom Fields management surface — no navigation library is installed and the
 * phase stays dependency-free. Phase 4 introduces the real navigation shell and
 * relocates this entry into a Settings surface; until then the `route` state
 * selects between the home shell and `CustomFieldsScreen`, which returns here
 * via its `onBack`.
 */
type Route = "home" | "custom-fields";

export function HomeScreen() {
  const { colors } = useTheme();
  const [route, setRoute] = useState<Route>("home");

  if (route === "custom-fields") {
    return <CustomFieldsScreen onBack={() => setRoute("home")} />;
  }

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

      <Pressable
        testID="home-custom-fields-entry"
        accessibilityRole="button"
        accessibilityLabel="Custom Fields"
        onPress={() => setRoute("custom-fields")}
        style={[
          styles.entry,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.entryText, { color: colors.textPrimary }]}>
          Custom Fields
        </Text>
      </Pressable>
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
  entry: {
    marginTop: 24,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  entryText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
