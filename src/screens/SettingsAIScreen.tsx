// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { File, Paths } from "expo-file-system";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { loadCachedOpenRouterCatalog } from "@/ai/openrouter-catalog";
import { AIFirstUseDisclosure } from "@/components/AIFirstUseDisclosure";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  AppText,
  OrbitSwitch,
  SettingsRow,
  SettingsSectionCard,
} from "@/components/ui";
import { USE_AI_SUGGESTIONS } from "@/constants/glossary";
import { resolveActiveAiConnection } from "@/db/ai-connections-dao";
import { updateAppSettings } from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { readCredentialPresence } from "@/logic/ai-availability";
import type { RootStackParamList } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { aiKeyStore } from "@/services/ai-key-store";
import { useAiConfigStore } from "@/stores/ai-config-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import {
  type AiHubSection,
  type AiHubSnapshot,
  aiHubRowDisplay,
  buildAiEnabledPatch,
  deriveAiHubState,
  loadAiHubSnapshot,
} from "./settings-ai-hub-logic";

const LOG_SCOPE = "settings-ai-screen";
const LOAD_ERROR = "Couldn't load AI settings. Please try again.";

function hubRowTestID(section: AiHubSection): string {
  return `settings-ai-entry-${section.label.toLowerCase().replaceAll(" ", "-")}`;
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
 * The hub derives from a POPULATED snapshot, not a default: on focus it runs
 * the migrated HYDRATION pipeline (`loadAiHubSnapshot`) — hydrate config →
 * resolve the active connection → read credential presence → read the cached
 * OpenRouter catalog from disk → `computeAiHubAvailability` — feeds the result
 * to `deriveAiHubState` and the row values (`aiHubRowDisplay`: provider · model
 * and readiness, 38.12 D-85), and carries the focus-load error path, which a
 * good reload clears (D-88). This is read-path hydration of already-stored
 * config; the catalog read is the LOCAL cache file — NO real AI provider
 * network call (local-first; no new egress).
 *
 * The master switch reads "Use AI suggestions" (D-130). One "Style and
 * Context" row opens the personalization page at the top (D-126). Rows are the
 * shared `SettingsRow` inside `SettingsSectionCard` (D-119).
 *
 * Back is the `ShellAppBar` header Back only (RG-037 ui-accessibility/
 * AUD-UIA-016, D-15): no duplicate in-body Back.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
export function SettingsAIScreen() {
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
  const [aiHubSnapshot, setAiHubSnapshot] = useState<AiHubSnapshot | null>(
    null,
  );
  const aiHubState = deriveAiHubState(
    aiEnabled,
    aiHubSnapshot?.availability ?? "off",
  );

  // Fresh-on-focus hydration (migrated `reloadAiAvailability`), routed through
  // the injectable `loadAiHubSnapshot` producer. The catalog step reads ONLY
  // the local on-disk cache file; the picker owns refresh writes.
  const loadAvailability = useCallback(async () => {
    setAiHubSnapshot(
      await loadAiHubSnapshot(getExecutor(), {
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

  // Each focus reload starts clean and a good one leaves no error behind
  // (D-88): a stale "Couldn't load" never outlives the load that fixed it.
  useFocusEffect(
    useCallback(() => {
      setAiHubError(null);
      void loadAvailability()
        .then(() => setAiHubError(null))
        .catch((error) => {
          Logger.error(LOG_SCOPE, "failed to load AI configuration", error);
          setAiHubError(LOAD_ERROR);
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

  function openSection(section: AiHubSection) {
    switch (section.route) {
      case "AIConnection":
        navigation.navigate("AIConnection");
        break;
      case "AIModelPicker":
        if (activeAiConnection === null) {
          navigation.navigate("AIConnection");
        } else {
          navigation.navigate("AIModelPicker", { lane: activeAiConnection });
        }
        break;
      case "AIPersonalization":
        // Style and Context opens the page at the top: no section target.
        navigation.navigate("AIPersonalization");
        break;
      case "AIPermissions":
        navigation.navigate("AIPermissions");
        break;
      case "AIPreview":
        navigation.navigate("AIPreview");
        break;
    }
  }

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
        {/* AI is an optional capability. The master switch mutates only
            app_settings.ai_enabled; every connection, model, personalization
            section, and permission survives the off state. */}
        <View testID="settings-ai-section" style={styles.section}>
          <SettingsSectionCard title="AI message suggestions">
            <SettingsRow
              title={USE_AI_SUGGESTIONS}
              trailing={
                <OrbitSwitch
                  testID="settings-ai-enabled"
                  accessibilityLabel={USE_AI_SUGGESTIONS}
                  disabled={!aiHydrated}
                  value={aiEnabled}
                  onValueChange={(enabled) => void onToggleAi(enabled)}
                />
              }
            />
          </SettingsSectionCard>

          {!aiHydrated ? (
            <AppText
              role="caption"
              testID="settings-ai-loading"
              style={{ color: colors.textSecondary }}
            >
              Loading AI settings…
            </AppText>
          ) : aiHubState.showSimplified ? (
            <SettingsSectionCard testID="settings-ai-off-state">
              <SettingsRow
                title="Manage saved connections"
                subtitle="AI is off. Your connections, models, personalization, and permissions are saved and will return when you turn AI back on."
                testID="settings-ai-manage-saved"
                accessibilityLabel="Manage saved connections"
                onPress={() => navigation.navigate("AIConnection")}
              />
            </SettingsSectionCard>
          ) : (
            <SettingsSectionCard testID="settings-ai-expanded">
              {aiHubState.sections.map((section) => {
                const display = aiHubRowDisplay(section, aiHubSnapshot);
                return (
                  <SettingsRow
                    key={section.label}
                    testID={hubRowTestID(section)}
                    title={section.label}
                    value={display.value}
                    subtitle={display.subtitle}
                    onPress={() => openSection(section)}
                  />
                );
              })}
            </SettingsSectionCard>
          )}

          {aiHubError ? (
            <AppText
              role="caption"
              testID="settings-ai-error"
              accessibilityRole="alert"
              style={{ color: colors.danger }}
            >
              {aiHubError}
            </AppText>
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
    padding: SPACING.base,
    gap: SPACING.md,
  },
  section: {
    gap: SPACING.md,
  },
});
