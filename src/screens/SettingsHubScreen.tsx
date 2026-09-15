import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { requestPinWidget } from "react-native-android-widget";
import { ShellAppBar } from "@/components/ShellAppBar";
import type { RootStackParamList } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import { ADD_WIDGET_ACTION, pinResultCopy } from "./settings-add-widget";
import {
  type SettingsHubRow,
  SETTINGS_HUB_ROWS,
} from "./settings-hub-model";

const LOG_SCOPE = "settings-hub-screen";

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

  // The "Add Orbit widget" fallback copy (§L) — null while there is nothing to
  // show, set to the UI-SPEC fallback string when requestPinWidget can't pin
  // (unsupported launcher / API < 26 / a rejected request). Carried verbatim
  // from the retired monolith so no widget-access behaviour is lost.
  const [addWidgetCopy, setAddWidgetCopy] = useState<string | null>(null);

  // "Add Orbit widget": open the launcher's native pin prompt. requestPinWidget
  // resolves false on an unsupported launcher / API < 26; a REJECTED promise is
  // caught and mapped to false so it is treated identically (no crash, no dead
  // button, no unhandled rejection). The pure pinResultCopy decides the copy.
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

  const onPressRow = (row: SettingsHubRow) => {
    switch (row.kind) {
      case "route":
        navigation.navigate(row.route);
        break;
      case "action":
        switch (row.action) {
          case ADD_WIDGET_ACTION:
            void onAddWidget();
            break;
        }
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
          <View key={row.key}>
            <Pressable
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
              <Text
                style={[styles.rowSubtitle, { color: colors.textSecondary }]}
              >
                {row.subtitle}
              </Text>
            </Pressable>
            {row.kind === "action" &&
            row.action === ADD_WIDGET_ACTION &&
            addWidgetCopy !== null ? (
              <Text
                testID="settings-add-widget-fallback"
                style={[
                  styles.rowSubtitle,
                  styles.fallbackCopy,
                  { color: colors.textSecondary },
                ]}
              >
                {addWidgetCopy}
              </Text>
            ) : null}
          </View>
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
  fallbackCopy: {
    marginTop: 6,
    paddingHorizontal: 4,
  },
});
