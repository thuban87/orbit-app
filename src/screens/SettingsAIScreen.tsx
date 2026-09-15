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
import { loadCachedOpenRouterCatalog } from "@/ai/openrouter-catalog";
import { AIFirstUseDisclosure } from "@/components/AIFirstUseDisclosure";
import { ShellAppBar } from "@/components/ShellAppBar";
import { resolveActiveAiConnection } from "@/db/ai-connections-dao";
import { updateAppSettings } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import {
  type AiAvailability,
  readCredentialPresence,
} from "@/logic/ai-availability";
import type { RootStackParamList } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { aiKeyStore } from "@/services/ai-key-store";
import { useAiConfigStore } from "@/stores/ai-config-store";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import {
  buildAiEnabledPatch,
  deriveAiHubState,
  loadAiHubAvailability,
} from "./settings-ai-hub-logic";

const LOG_SCOPE = "settings-ai-screen";

interface SettingsAIScreenProps {
  onBack: () => void;
}

/**
 * AI category screen (§J / D-09). A top-level Settings category that routes into
 * the CANONICAL Phase 36 AI hierarchy (the existing `AIConnection` /
 * `AIModelPicker` / `AIPersonalization` / `AIPermissions` / `AIPreview` leaf
 * routes) via `settings-ai-hub-logic.ts` — including the AI-Off
 * credential-management escape hatch. The master toggle flips `ai_enabled` ONLY
 * (`buildAiEnabledPatch`) and does NOT widen AI egress: `AiService.ts` is
 * untouched and the master control cannot mutate saved AI config.
 *
 * The hub derives from a POPULATED availability, not a default: on focus it runs
 * the migrated availability HYDRATION pipeline (`loadAiHubAvailability`) — hydrate
 * config → resolve the active connection → read credential presence → read the
 * cached OpenRouter catalog from disk → `computeAiHubAvailability` — feeds the
 * result to `deriveAiHubState`, and carries the focus-load error path. This is
 * read-path hydration of already-stored config; the catalog read is the LOCAL
 * cache file — NO real AI provider network call (local-first; no new egress).
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsAIScreen({ onBack }: SettingsAIScreenProps) {
  const { colors } = useTheme();
  const bottomClearance = useBottomClearance();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const aiEnabled = useAiConfigStore((state) => state.aiEnabled);
  const activeAiConnection = useAiConfigStore(
    (state) => state.activeConnection,
  );
  const aiHydrated = useAiConfigStore((state) => state.hydrated);
  const hydrateAiConfig = useAiConfigStore((state) => state.hydrate);
  const [aiHubError, setAiHubError] = useState<string | null>(null);
  const [aiAvailability, setAiAvailability] = useState<AiAvailability>("off");
  const aiHubState = deriveAiHubState(aiEnabled, aiAvailability);

  // Fresh-on-focus availability hydration (migrated `reloadAiAvailability`),
  // routed through the injectable `loadAiHubAvailability` producer. The catalog
  // step reads ONLY the local on-disk cache file; the picker owns refresh writes.
  const loadAvailability = useCallback(async () => {
    setAiAvailability(
      await loadAiHubAvailability(getExecutor(), {
        hydrateAiConfig,
        getAiConfig: () => ({
          aiEnabled: useAiConfigStore.getState().aiEnabled,
        }),
        resolveActiveAiConnection,
        readCredentialPresence,
        loadCachedOpenRouterCatalog: () =>
          loadCachedOpenRouterCatalog({
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
          }),
        getKey: (provider, customEndpoint) =>
          aiKeyStore.getKey(provider, customEndpoint),
      }),
    );
  }, [hydrateAiConfig]);

  useFocusEffect(
    useCallback(() => {
      void loadAvailability().catch((error) => {
        Logger.error(LOG_SCOPE, "failed to load AI configuration", error);
        setAiHubError("Couldn't load AI settings. Please try again.");
      });
    }, [loadAvailability]),
  );

  // The master toggle persists `ai_enabled` ONLY (buildAiEnabledPatch) and never
  // mutates saved AI config or widens egress. After the durable write it re-runs
  // the hydration pipeline, which re-syncs the store's reactive `aiEnabled`.
  const onToggleAi = useCallback(
    async (enabled: boolean) => {
      setAiHubError(null);
      try {
        await updateAppSettings(
          getExecutor(),
          buildAiEnabledPatch(enabled),
          localDateTime(),
        );
        await loadAvailability();
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to update AI master state", error);
        setAiHubError("Couldn't update AI settings. Please try again.");
      }
    },
    [loadAvailability],
  );

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="AI" />
      <ScrollView
        testID="settings-ai-screen"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomClearance },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={styles.backLink}
        >
          <Text style={[styles.backLinkText, { color: colors.accent }]}>
            Back
          </Text>
        </Pressable>

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
                accessibilityState={{
                  checked: aiEnabled,
                  disabled: !aiHydrated,
                }}
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
                        navigation.navigate(
                          "AIPersonalization",
                          section.params,
                        );
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
                    style={[styles.chevron, { color: colors.textSecondary }]}
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
  backLink: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  backLinkText: {
    fontSize: 13,
    fontWeight: "400",
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
  chevron: {
    fontSize: 20,
    fontWeight: "600",
  },
});
