import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { requestPinWidget } from "react-native-android-widget";
import { ShellAppBar } from "@/components/ShellAppBar";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import { pinResultCopy } from "./settings-add-widget";

const LOG_SCOPE = "settings-screen";

/**
 * SettingsScreen — the transitional `SettingsMore` monolith (Phase 37, D-09).
 * Category groups migrate out into dedicated hub sub-routes plan by plan; Plan 08
 * removes this screen once every group has a home. Currently hosts only the
 * "Add Orbit widget" utility (§L, Plan 08's home).
 *
 * Migrated OUT of this monolith:
 * - Appearance / Theme + owner-profile + Orbit Appearance → SettingsAppearance (Plans 02–03).
 * - Interaction Assist + interaction defaults → SettingsInteractions (Plan 01).
 * - Contact methods (phone region, reconcile, review-flagged), Contacts Integration
 *   (import), Custom Fields, and Archived → SettingsContacts (Plan 04, §E).
 * - Notifications (master, degraded note, Decay, Birthday, Birthday-unbound,
 *   Weekly digest, Lock-screen, Reminder time, Quiet start/end) → SettingsNotifications
 *   (Plan 05, §G) — carrying the shared reconcile-on-write path.
 * - Orrery Display (density, satellites) bound to the shared preference store +
 *   the Systems row → SettingsOrrery (Plan 06, §H).
 * - AI hub (master toggle + hub rows + first-use disclosure) and the fresh-on-focus
 *   availability hydration pipeline → SettingsAI (Plan 06, §J).
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsScreen() {
  const { colors } = useTheme();
  const bottomClearance = useBottomClearance();

  // The "Add Orbit widget" fallback copy — null while there is nothing to show,
  // set to the UI-SPEC fallback string when requestPinWidget can't pin (unsupported
  // launcher / API < 26 / a rejected request). Surfaced inline under the row.
  const [addWidgetCopy, setAddWidgetCopy] = useState<string | null>(null);

  // "Add Orbit widget": open the launcher's native pin prompt. requestPinWidget
  // resolves false on an unsupported launcher / API < 26; a REJECTED promise is
  // caught and mapped to false so it is treated identically (no crash, no dead
  // button, no unhandled rejection — Codex MED). The pure pinResultCopy decides
  // the copy: null (accepted → nothing to show) or the verbatim fallback string.
  // The live pin prompt is a device-UAT (12-08); the provider must be prebuilt for
  // the name to resolve (Assumption A5).
  const onAddWidget = useCallback(async () => {
    let accepted = false;
    try {
      accepted = await requestPinWidget({ widgetName: "OrbitFavourites" });
    } catch (err) {
      Logger.error(LOG_SCOPE, "requestPinWidget rejected", err);
      accepted = false;
    }
    setAddWidgetCopy(pinResultCopy(accepted));
  }, []);

  return (
    <ScrollView
      testID="settings-screen"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomClearance },
      ]}
    >
      <ShellAppBar variant="root" title="Settings" />

      <View testID="settings-home-screen-section" style={styles.section}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionHeading, { color: colors.textSecondary }]}
        >
          Home screen
        </Text>

        {/* "Add Orbit widget" — opens the launcher's native pin prompt via
            requestPinWidget, degrading to the fallback copy on an unsupported
            launcher / API < 26 / a rejected request (WDG-03). Leading widget
            glyph + trailing chevron, consistent with the other rows. */}
        <Pressable
          testID="settings-add-widget"
          accessibilityRole="button"
          accessibilityLabel="Add Orbit widget"
          onPress={() => void onAddWidget()}
          style={[
            styles.row,
            styles.addWidgetRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text
            style={[styles.addWidgetGlyph, { color: colors.textSecondary }]}
          >
            ▦
          </Text>
          <Text
            style={[
              styles.rowLabel,
              styles.addWidgetLabel,
              { color: colors.textPrimary },
            ]}
          >
            Add Orbit widget
          </Text>
          <Text
            style={[styles.addWidgetChevron, { color: colors.textSecondary }]}
          >
            ›
          </Text>
        </Pressable>

        {addWidgetCopy !== null ? (
          <Text
            testID="settings-add-widget-fallback"
            style={[styles.helper, { color: colors.textSecondary }]}
          >
            {addWidgetCopy}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
  },
  section: {
    gap: 12,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
  addWidgetRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  addWidgetGlyph: {
    fontSize: 18,
  },
  addWidgetLabel: {
    flex: 1,
  },
  addWidgetChevron: {
    fontSize: 20,
    fontWeight: "600",
  },
  helper: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
  },
});
