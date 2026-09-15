import { ScrollView, StyleSheet } from "react-native";
import { ShellAppBar } from "@/components/ShellAppBar";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";

/**
 * SettingsScreen — the transitional `SettingsMore` monolith (Phase 37, D-09),
 * now EMPTY. Every category group has migrated into a dedicated hub sub-route
 * across Plans 01–07, and the final group — the "Add Orbit widget" utility — moved
 * to the hub as a `kind:"action"` row in Plan 08 Task 2 (§L). No user-facing group
 * remains here. Plan 08 Task 3 removes this screen and its transitional route
 * entirely; this empty shell only bridges Task 2's atomic commit.
 *
 * Migrated OUT of this monolith:
 * - Appearance / Theme + owner-profile + Orbit Appearance → SettingsAppearance (Plans 02–03).
 * - Interaction Assist + interaction defaults → SettingsInteractions (Plan 01).
 * - Contact methods, Contacts Integration, Custom Fields, Archived → SettingsContacts (Plan 04, §E).
 * - Notifications (all 10 controls) → SettingsNotifications (Plan 05, §G).
 * - Orrery Display + Systems row → SettingsOrrery (Plan 06, §H).
 * - AI hub → SettingsAI (Plan 06, §J).
 * - Home screen "Add Orbit widget" → hub `kind:"action"` utility row (Plan 08, §L).
 * - About Orbit → SettingsAbout (Plan 08, §K).
 */
export function SettingsScreen() {
  const bottomClearance = useBottomClearance();

  return (
    <ScrollView
      testID="settings-screen"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomClearance },
      ]}
    >
      <ShellAppBar variant="root" title="Settings" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
  },
});
