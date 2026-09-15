import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { File, Paths } from "expo-file-system";
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { requestPinWidget } from "react-native-android-widget";
import { loadCachedOpenRouterCatalog } from "@/ai/openrouter-catalog";
import { AIFirstUseDisclosure } from "@/components/AIFirstUseDisclosure";
import { ShellAppBar } from "@/components/ShellAppBar";
import { resolveActiveAiConnection } from "@/db/ai-connections-dao";
import { getExecutor } from "@/db/database";
import { readCredentialPresence } from "@/logic/ai-availability";
import type { RootStackParamList } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { aiKeyStore } from "@/services/ai-key-store";
import { useAiConfigStore } from "@/stores/ai-config-store";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import { pinResultCopy } from "./settings-add-widget";
import {
  computeAiHubAvailability,
  deriveAiHubState,
} from "./settings-ai-hub-logic";

const LOG_SCOPE = "settings-screen";

/**
 * SettingsScreen — the transitional `SettingsMore` monolith (Phase 37, D-09).
 * Category groups migrate out into dedicated hub sub-routes plan by plan; Plan 08
 * removes this screen once every group has a home. Currently hosts the AI hub
 * and the "Add Orbit widget" utility.
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
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsScreen() {
  const { colors } = useTheme();
  const bottomClearance = useBottomClearance();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // The "Add Orbit widget" fallback copy — null while there is nothing to show,
  // set to the UI-SPEC fallback string when requestPinWidget can't pin (unsupported
  // launcher / API < 26 / a rejected request). Surfaced inline under the row.
  const [addWidgetCopy, setAddWidgetCopy] = useState<string | null>(null);

  const aiEnabled = useAiConfigStore((state) => state.aiEnabled);
  const activeAiConnection = useAiConfigStore(
    (state) => state.activeConnection,
  );
  const aiHydrated = useAiConfigStore((state) => state.hydrated);
  const hydrateAiConfig = useAiConfigStore((state) => state.hydrate);
  const setAiEnabled = useAiConfigStore((state) => state.setAiEnabled);
  const [aiHubError, setAiHubError] = useState<string | null>(null);
  const [aiAvailability, setAiAvailability] = useState<
    "off" | "ready" | "needs-attention"
  >("off");
  const aiHubState = deriveAiHubState(aiEnabled, aiAvailability);

  const reloadAiAvailability = useCallback(async () => {
    const exec = getExecutor();
    await hydrateAiConfig(exec);
    const config = useAiConfigStore.getState();
    const connection = await resolveActiveAiConnection(exec);
    const hasCredential = await readCredentialPresence(
      connection?.lane ?? "none",
      (lane) =>
        aiKeyStore.getKey(
          lane,
          lane === "custom" ? connection?.customEndpoint : undefined,
        ),
    );
    const openRouterCatalog =
      connection?.lane === "openrouter"
        ? await loadCachedOpenRouterCatalog({
            async read() {
              const file = new File(
                Paths.document,
                "ai",
                "openrouter-model-catalog.json",
              );
              return file.exists ? file.text() : null;
            },
            async write() {
              // Settings hub reads the model cache; picker owns refresh writes.
            },
          })
        : null;
    setAiAvailability(
      computeAiHubAvailability({
        aiEnabled: config.aiEnabled,
        activeConnection: connection,
        hasCredential,
        openRouterModels: openRouterCatalog?.models ?? [],
      }),
    );
  }, [hydrateAiConfig]);

  useFocusEffect(
    useCallback(() => {
      void reloadAiAvailability().catch((error) => {
        Logger.error(LOG_SCOPE, "failed to load AI configuration", error);
        setAiHubError("Couldn't load AI settings. Please try again.");
      });
    }, [reloadAiAvailability]),
  );

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

  const onToggleAi = useCallback(
    async (enabled: boolean) => {
      setAiHubError(null);
      try {
        await setAiEnabled(getExecutor(), enabled);
        await reloadAiAvailability();
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to update AI master state", error);
        setAiHubError("Couldn't update AI settings. Please try again.");
      }
    },
    [reloadAiAvailability, setAiEnabled],
  );

  return (
    <ScrollView
      testID="settings-screen"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: bottomClearance },
      ]}
    >
      <ShellAppBar variant="root" title="Settings" />

      {/* AI is an optional capability. The master switch mutates only
          app_settings.ai_enabled; every connection, model, personalization
          section, and permission survives the off state. */}
      <View testID="settings-ai-section" style={styles.section}>
        <Text
          accessibilityRole="header"
          style={[styles.sectionHeading, { color: colors.textSecondary }]}
        >
          AI message suggestions
        </Text>
        <View
          style={[
            styles.row,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
              AI Enabled
            </Text>
            <Switch
              testID="settings-ai-enabled"
              accessibilityRole="switch"
              accessibilityLabel="AI Enabled"
              accessibilityState={{ checked: aiEnabled, disabled: !aiHydrated }}
              disabled={!aiHydrated}
              value={aiEnabled}
              onValueChange={(enabled) => void onToggleAi(enabled)}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.surfaceElevated}
            />
          </View>
        </View>

        {!aiHydrated ? (
          <Text
            testID="settings-ai-loading"
            style={[styles.helper, { color: colors.textSecondary }]}
          >
            Loading AI settings…
          </Text>
        ) : aiHubState.showSimplified ? (
          <View
            testID="settings-ai-off-state"
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.helper, { color: colors.textSecondary }]}>
              AI is off. Your connections, models, personalization, and
              permissions are saved and will return when you turn AI back on.
            </Text>
            <Pressable
              testID="settings-ai-manage-saved"
              accessibilityRole="button"
              accessibilityLabel="Manage saved connections"
              onPress={() => navigation.navigate("AIConnection")}
              style={[styles.aiButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                Manage saved connections
              </Text>
            </Pressable>
          </View>
        ) : (
          <View testID="settings-ai-expanded" style={styles.section}>
            {aiHubState.sections.map((section) => (
              <Pressable
                key={section.label}
                testID={`settings-ai-entry-${section.label
                  .toLowerCase()
                  .replaceAll(" ", "-")}`}
                accessibilityRole="button"
                accessibilityLabel={section.label}
                onPress={() => {
                  switch (section.route) {
                    case "AIConnection":
                      navigation.navigate("AIConnection");
                      break;
                    case "AIModelPicker":
                      if (activeAiConnection === null) {
                        navigation.navigate("AIConnection");
                      } else {
                        navigation.navigate("AIModelPicker", {
                          lane: activeAiConnection,
                        });
                      }
                      break;
                    case "AIPersonalization":
                      navigation.navigate("AIPersonalization", section.params);
                      break;
                    case "AIPermissions":
                      navigation.navigate("AIPermissions");
                      break;
                    case "AIPreview":
                      navigation.navigate("AIPreview");
                      break;
                  }
                }}
                style={[
                  styles.row,
                  styles.aiHubRow,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  numberOfLines={2}
                  style={[
                    styles.rowLabel,
                    styles.aiHubLabel,
                    { color: colors.textPrimary },
                  ]}
                >
                  {section.label}
                </Text>
                <Text
                  accessibilityElementsHidden
                  style={[
                    styles.addWidgetChevron,
                    { color: colors.textSecondary },
                  ]}
                >
                  ›
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {aiHubError ? (
          <Text
            testID="settings-ai-error"
            accessibilityRole="alert"
            style={[styles.helper, { color: colors.danger }]}
          >
            {aiHubError}
          </Text>
        ) : null}

        <AIFirstUseDisclosure />
      </View>

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
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  helper: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
  },
  aiButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "flex-start",
  },
  aiHubRow: {
    alignItems: "center",
    flexDirection: "row",
  },
  aiHubLabel: {
    flex: 1,
  },
});
