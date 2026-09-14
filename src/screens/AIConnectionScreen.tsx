// biome-ignore-all lint/a11y/useValidAriaRole: `role` is Orbit's visual/typography domain prop.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { connectOpenRouter } from "@/ai/openrouter-oauth";
import { AppText, Button, ConfirmDialog, GlassSurface } from "@/components/ui";
import {
  type AiConnection,
  activateAiConnection,
  listAiConnections,
  upsertAiConnection,
} from "@/db/ai-connections-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { aiKeyStore } from "@/services/ai-key-store";
import type { AiCloudProviderId } from "@/services/ai-types";
import { useAiConfigStore } from "@/stores/ai-config-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import {
  connectionCardState,
  removeLaneCredential,
  saveCustomConnection,
  saveDirectCredential,
} from "./ai-connection-logic";
import { CUSTOM_RETENTION_CAVEAT } from "./settings-ai-logic";

const LOG_SCOPE = "ai-connections";
const DIRECT_LANES = ["openai", "anthropic", "google"] as const;
const LANE_NAMES: Record<AiCloudProviderId, string> = {
  openrouter: "OpenRouter",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google Gemini",
  custom: "Custom Endpoint",
};

export interface AIConnectionScreenProps {
  onBack: () => void;
  onChooseModel?: (lane: AiCloudProviderId) => void;
}

export function AIConnectionScreen({
  onBack,
  onChooseModel,
}: AIConnectionScreenProps) {
  const { colors } = useTheme();
  const activeLane = useAiConfigStore((state) => state.activeConnection);
  const [connections, setConnections] = useState<AiConnection[]>([]);
  const [expanded, setExpanded] = useState<AiCloudProviderId | null>(
    "openrouter",
  );
  const [keyInput, setKeyInput] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [customCredential, setCustomCredential] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [pending, setPending] = useState<AiCloudProviderId | null>(null);
  const [removeLane, setRemoveLane] = useState<AiCloudProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const exec = getExecutor();
    const rows = await listAiConnections(exec);
    setConnections(rows);
    await useAiConfigStore.getState().hydrate(exec);
  }, []);

  useEffect(() => {
    void load().catch((caught) => {
      Logger.error(LOG_SCOPE, "failed to load connection metadata", caught);
      setError("Couldn't load saved AI connections.");
    });
  }, [load]);

  const byLane = useMemo(
    () =>
      new Map(connections.map((connection) => [connection.lane, connection])),
    [connections],
  );

  async function activateSaved(lane: AiCloudProviderId) {
    if (!byLane.has(lane) || pending) return;
    setPending(lane);
    setError(null);
    try {
      await activateAiConnection(getExecutor(), lane, localDateTime());
      await load();
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to activate saved connection", caught);
      setError(
        "Couldn't switch connections. Your previous connection is still active.",
      );
    } finally {
      setPending(null);
    }
  }

  async function configureDirect(lane: (typeof DIRECT_LANES)[number]) {
    if (pending) return;
    setPending(lane);
    setError(null);
    try {
      await saveDirectCredential(aiKeyStore, lane, keyInput);
      const previous = byLane.get(lane);
      await upsertAiConnection(getExecutor(), {
        lane,
        rememberedModel: previous?.rememberedModel ?? "",
        now: localDateTime(),
      });
      await activateAiConnection(getExecutor(), lane, localDateTime());
      setKeyInput("");
      await load();
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to configure direct connection", caught);
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't save that connection.",
      );
    } finally {
      setPending(null);
    }
  }

  async function configureOpenRouter() {
    if (pending) return;
    setPending("openrouter");
    setError(null);
    try {
      await connectOpenRouter();
      const previous = byLane.get("openrouter");
      await upsertAiConnection(getExecutor(), {
        lane: "openrouter",
        rememberedModel: previous?.rememberedModel ?? "",
        now: localDateTime(),
      });
      await activateAiConnection(getExecutor(), "openrouter", localDateTime());
      await load();
    } catch (caught) {
      Logger.error(LOG_SCOPE, "OpenRouter setup did not complete", caught);
      setError(
        "OpenRouter wasn't connected. Your previous connection is still active.",
      );
    } finally {
      setPending(null);
    }
  }

  async function configureCustom() {
    if (pending) return;
    setPending("custom");
    setError(null);
    try {
      const result = await saveCustomConnection(
        {
          setKey: (provider, key) => aiKeyStore.setKey(provider, key),
          persistConnection: async (input) => {
            await upsertAiConnection(getExecutor(), {
              lane: "custom",
              rememberedModel: input.model,
              customModel: input.model,
              customEndpoint: input.endpoint,
              now: localDateTime(),
            });
          },
        },
        { endpoint, credential: customCredential, model: customModel },
      );
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      await activateAiConnection(getExecutor(), "custom", localDateTime());
      setCustomCredential("");
      await load();
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to configure custom connection", caught);
      setError(
        "Couldn't save that endpoint. Your previous connection is still active.",
      );
    } finally {
      setPending(null);
    }
  }

  async function confirmRemoval() {
    const lane = removeLane;
    if (!lane) return;
    try {
      await removeLaneCredential(aiKeyStore, lane);
      setRemoveLane(null);
      await load();
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to remove lane credential", caught);
      setError("Couldn't remove that credential.");
    }
  }

  function card(lane: AiCloudProviderId, body: React.ReactNode) {
    const connection = byLane.get(lane);
    const state = connectionCardState(
      lane,
      activeLane,
      connection?.rememberedModel,
    );
    const isExpanded = expanded === lane;
    return (
      <GlassSurface key={lane} density="dense" style={styles.card}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded, selected: state.active }}
          accessibilityLabel={`${LANE_NAMES[lane]} connection`}
          onPress={() => setExpanded(isExpanded ? null : lane)}
          style={styles.cardHeader}
        >
          <View style={styles.copy}>
            <AppText role="label">{LANE_NAMES[lane]}</AppText>
            {state.rememberedModel ? (
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                {state.rememberedModel}
              </AppText>
            ) : null}
          </View>
          <AppText
            role="caption"
            style={{
              color: state.active ? colors.accentText : colors.textSecondary,
            }}
          >
            {state.active
              ? "Active"
              : state.saved
                ? "Saved"
                : isExpanded
                  ? "−"
                  : "+"}
          </AppText>
        </Pressable>
        {isExpanded ? (
          <View
            style={[
              styles.cardBody,
              { borderTopColor: state.active ? colors.accent : colors.border },
            ]}
          >
            {body}
            {state.saved ? (
              <Button
                role="secondary"
                label="Use saved connection"
                disabled={pending !== null}
                onPress={() => void activateSaved(lane)}
              />
            ) : null}
            {connection ? (
              <View style={styles.actions}>
                <Button
                  role="tertiary"
                  label="Choose model"
                  onPress={() => onChooseModel?.(lane)}
                />
                <Button
                  role="destructive"
                  label={lane === "openrouter" ? "Disconnect" : "Remove key"}
                  onPress={() => setRemoveLane(lane)}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </GlassSurface>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Button role="tertiary" label="Back" onPress={onBack} />
        <AppText accessibilityRole="header" role="display">
          AI Connections
        </AppText>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <AppText role="heading">Recommended</AppText>
          {card(
            "openrouter",
            <>
              <AppText role="body">
                One connection for a broad, current model catalog with live
                pricing.
              </AppText>
              <Button
                role="primary"
                label={
                  pending === "openrouter"
                    ? "Connecting…"
                    : "Connect with OpenRouter"
                }
                disabled={pending !== null}
                onPress={() => void configureOpenRouter()}
              />
            </>,
          )}
        </View>
        <View style={styles.section}>
          <AppText role="heading">Advanced Setup</AppText>
          {DIRECT_LANES.map((lane) =>
            card(
              lane,
              <>
                <TextInput
                  accessibilityLabel={`${LANE_NAMES[lane]} API key`}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Paste API key"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  value={expanded === lane ? keyInput : ""}
                  onChangeText={setKeyInput}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.textPrimary,
                    },
                  ]}
                />
                <Button
                  role="primary"
                  label={pending === lane ? "Saving…" : "Save key"}
                  disabled={pending !== null}
                  onPress={() => void configureDirect(lane)}
                />
              </>,
            ),
          )}
          {card(
            "custom",
            <>
              <AppText role="body">
                Advanced · OpenAI-compatible HTTPS only
              </AppText>
              <TextInput
                accessibilityLabel="Custom endpoint base URL"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="https://api.example.com/v1"
                placeholderTextColor={colors.textSecondary}
                value={endpoint}
                onChangeText={setEndpoint}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
              />
              <TextInput
                accessibilityLabel="Custom endpoint optional credential"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Optional credential"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry
                value={customCredential}
                onChangeText={setCustomCredential}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
              />
              <TextInput
                accessibilityLabel="Custom endpoint model id"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Model id"
                placeholderTextColor={colors.textSecondary}
                value={customModel}
                onChangeText={setCustomModel}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.textPrimary,
                  },
                ]}
              />
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                {CUSTOM_RETENTION_CAVEAT}
              </AppText>
              <Button
                role="primary"
                label={pending === "custom" ? "Saving…" : "Connect"}
                disabled={pending !== null}
                onPress={() => void configureCustom()}
              />
            </>,
          )}
        </View>
        {error ? (
          <AppText role="caption" style={{ color: colors.danger }}>
            {error}
          </AppText>
        ) : null}
      </ScrollView>
      <ConfirmDialog
        visible={removeLane !== null}
        onRequestClose={() => setRemoveLane(null)}
        title={
          removeLane === "openrouter"
            ? "Disconnect OpenRouter?"
            : `Remove ${removeLane ? LANE_NAMES[removeLane] : "provider"} key?`
        }
        message={
          removeLane === "openrouter"
            ? "The OpenRouter credential is removed from this device. Your model selection and personalization are kept."
            : "The saved API key is deleted from this device. Other connections are unaffected."
        }
        confirmLabel={removeLane === "openrouter" ? "Disconnect" : "Remove key"}
        destructive
        onConfirm={() => void confirmRemoval()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  card: { overflow: "hidden" },
  cardBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: SPACING.md,
    padding: SPACING.base,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    minHeight: 44,
    padding: SPACING.base,
  },
  content: { gap: SPACING.xl, padding: SPACING.base },
  copy: { flex: 1, gap: SPACING.xs },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.md,
    padding: SPACING.base,
  },
  input: {
    borderRadius: RADII.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    paddingHorizontal: SPACING.md,
  },
  root: { flex: 1 },
  section: { gap: SPACING.md },
});
