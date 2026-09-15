import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import type { RootStackParamList } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { useTheme } from "@/theme";
import {
  type SettingsHubRow,
  SETTINGS_HUB_ROWS,
} from "./settings-hub-model";

/**
 * SettingsHubScreen — the navigation-first Settings directory (§A/D-09). Mounts
 * at the preserved `Settings` route name (§M) in place of the monolith. Rows
 * carry a title + subtitle only (NO live setting values, §A); tapping a
 * `kind:"route"` row navigates to the registered category route, a
 * `kind:"action"` row invokes its handler in place (none this plan).
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsHubScreen() {
  const { colors } = useTheme();
  const bottomClearance = useBottomClearance();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const onPressRow = (row: SettingsHubRow) => {
    switch (row.kind) {
      case "route":
        navigation.navigate(row.route);
        break;
      case "action":
        // No action rows this plan; Plan 08 adds the "Add Orbit widget" utility
        // row and wires its handler here.
        break;
    }
  };

  return (
    <View style={styles.root}>
      <ShellAppBar variant="root" title="Settings" />
      <ScrollView
        testID="settings-hub-screen"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomClearance },
        ]}
      >
        {__DEV__ ? (
          <Pressable
            testID="settings-dev-theme-preview-row"
            accessibilityRole="button"
            accessibilityLabel="Open background failure test harness"
            onPress={() => navigation.navigate("__ThemePreview")}
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
              Background failure test harness
            </Text>
          </Pressable>
        ) : null}

        {SETTINGS_HUB_ROWS.map((row) => (
          <Pressable
            key={row.key}
            testID={`settings-hub-row-${row.key}`}
            accessibilityRole="button"
            accessibilityLabel={row.title}
            onPress={() => onPressRow(row)}
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
              {row.title}
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              {row.subtitle}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: 16,
    gap: 12,
  },
  row: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  rowSubtitle: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
  },
});
