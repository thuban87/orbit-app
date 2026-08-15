import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { APP_NAME } from "@/constants/app";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme";

/**
 * The themed home shell — now a native-stack route (Phase 4's real navigation
 * shell). The Phase-1→3 dependency-free `useState<Route>` toggle is gone; the
 * shell reaches other surfaces through `navigation.navigate`. The Custom Fields
 * entry moved into Settings (CRUD-05's low-traffic home), so Home offers a
 * primary "New contact" action and a "Settings" entry.
 *
 * Every colour comes from `useTheme().colors.*`; there is not one hardcoded
 * colour value here (CLAUDE.md). The root view keeps its `testID`
 * `home-shell-root` and the title renders `APP_NAME` so the on-device UAT can
 * assert the rendered shell via `uiautomator dump`.
 */
export function HomeScreen() {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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
        testID="home-new-contact-entry"
        accessibilityRole="button"
        accessibilityLabel="New contact"
        onPress={() => navigation.navigate("Create")}
        style={[
          styles.primaryEntry,
          { backgroundColor: colors.accent, borderColor: colors.accent },
        ]}
      >
        <Text style={[styles.primaryEntryText, { color: colors.background }]}>
          New contact
        </Text>
      </Pressable>

      <Pressable
        testID="home-settings-entry"
        accessibilityRole="button"
        accessibilityLabel="Settings"
        onPress={() => navigation.navigate("Settings")}
        style={[
          styles.entry,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.entryText, { color: colors.textPrimary }]}>
          Settings
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
  primaryEntry: {
    marginTop: 24,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryEntryText: {
    fontSize: 16,
    fontWeight: "600",
  },
  entry: {
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
