import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme";

/**
 * SettingsScreen — the low-traffic host for the two CRUD-05 "separate homes":
 * Custom Fields (relocated off the Phase-3 `HomeScreen` dependency-free route)
 * and Archived contacts (the distinct archive home, no count badge — the
 * Archived screen states its count when opened, CONTEXT Area 1).
 *
 * TWO rows, not three: UI-SPEC:192's "Custom Fields" and "Reachability route"
 * name the SAME `CustomFieldsScreen` (there is no distinct Reachability screen
 * on disk), so a phantom third row would navigate nowhere. See the Plan 04-01
 * Settings-rows reconciliation.
 *
 * Mirrors the `CustomFieldsScreen` chrome (ScrollView root `background`, header
 * with a `goBack` Back control, title 24/700). Every colour resolves through
 * `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsScreen() {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <ScrollView
      testID="settings-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          testID="settings-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          Settings
        </Text>
      </View>

      <Pressable
        testID="settings-custom-fields-row"
        accessibilityRole="button"
        accessibilityLabel="Custom Fields"
        onPress={() => navigation.navigate("CustomFields")}
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
          Custom Fields
        </Text>
      </Pressable>

      <Pressable
        testID="settings-archived-row"
        accessibilityRole="button"
        accessibilityLabel="Archived contacts"
        onPress={() => navigation.navigate("Archived")}
        style={[
          styles.row,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
          Archived contacts
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
});
