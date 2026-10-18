// biome-ignore-all lint/a11y/useValidAriaRole: `role` is Orbit's visual/typography domain prop.
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import type { OpenRouterModel } from "@/ai/openrouter-catalog";
import { readCachedOpenRouterModels } from "@/ai/openrouter-catalog-file";
import { connectOpenRouter } from "@/ai/openrouter-oauth";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  AppText,
  Button,
  ConfirmDialog,
  SettingsSectionCard,
} from "@/components/ui";
import {
  type AiConnection,
  activateAiConnection,
  listAiConnections,
  upsertAiConnection,
} from "@/db/ai-connections-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { aiKeyStore } from "@/services/ai-key-store";
import type { AiCloudProviderId } from "@/services/ai-types";
import { useAiConfigStore } from "@/stores/ai-config-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { Logger } from "@/utils/logger";
import {
  AI_LANE_NAMES,
  type ConnectionCardState,
  type CredentialDraft,
  CustomCredentialCompensationError,
  connectionCardState,
  editDraft,
  readLaneCredentialPresence,
  removeLaneCredential,
  saveCustomConnection,
  saveDirectCredential,
  submitDraft,
  switchLane,
} from "./ai-connection-logic";
import { laneModelName } from "./settings-ai-hub-logic";
import { CUSTOM_RETENTION_CAVEAT } from "./settings-ai-logic";

const LOG_SCOPE = "ai-connections";
const LOAD_ERROR = "Couldn't load saved AI connections.";
const DIRECT_LANES = ["openai", "anthropic", "google"] as const;
const LANE_NAMES = AI_LANE_NAMES;

export interface AIConnectionScreenProps {
  onChooseModel: (lane: AiCloudProviderId) => void;
}

/**
 * Back is the shared header's only (38.9 D-16, D-07).
 *
 * Truthful connection state (38.12 D-84, K-36): the page reloads on every
 * focus, reads each saved lane's credential PRESENCE locally
 * (`readLaneCredentialPresence` → `readCredentialPresence`; no provider call,
 * no OAuth or egress change), and the active lane with a credential reads
 * "Connected" with "Change model" as its primary action; Disconnect /
 * Remove key stays the filled red destructive button (D-157 amends D-84). "Recommended" and the default OpenRouter expansion stay
 * (D-17). Sections draw on the shared Settings section card (D-119).
 */
export function AIConnectionScreen({ onChooseModel }: AIConnectionScreenProps) {
  const { colors } = useTheme();
  // The last item scrolls fully above the shell FAB (38.4 D-52, OA-E3).
  const bottomClearance = useBottomClearance();
  const activeLane = useAiConfigStore((state) => state.activeConnection);
  const [connections, setConnections] = useState<AiConnection[]>([]);
  const [credentialPresence, setCredentialPresence] = useState<
    Partial<Record<AiCloudProviderId, boolean>>
  >({});
  const [expanded, setExpanded] = useState<AiCloudProviderId | null>(
    "openrouter",
  );
  const [credentialDraft, setCredentialDraft] = useState<CredentialDraft>(null);
  const [endpoint, setEndpoint] = useState("");
  const [customCredential, setCustomCredential] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [pending, setPending] = useState<AiCloudProviderId | null>(null);
  const [removeLane, setRemoveLane] = useState<AiCloudProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);
  // DEF-03: the cached OpenRouter catalog, so a card shows the model's name
  // (the picker's lookup), not its raw id. A local file read; no network.
  const [openRouterModels, setOpenRouterModels] = useState<
    readonly OpenRouterModel[]
  >([]);
  // The Custom fields prefill from the saved connection (D-88) until the user
  // types in them; a reload never overwrites an edit in progress.
  const customFieldsEdited = useRef(false);

  const load = useCallback(async () => {
    const exec = getExecutor();
    const rows = await listAiConnections(exec);
    const presence = await readLaneCredentialPresence(rows, (lane, endpoint) =>
      aiKeyStore.getKey(lane, endpoint),
    );
    setConnections(rows);
    setCredentialPresence(presence);
    const custom = rows.find((row) => row.lane === "custom");
    if (custom && !customFieldsEdited.current) {
      setEndpoint(custom.customEndpoint);
      setCustomModel(custom.customModel || custom.rememberedModel);
    }
    await useAiConfigStore.getState().hydrate(exec);
    if (rows.some((row) => row.lane === "openrouter")) {
      try {
        setOpenRouterModels(await readCachedOpenRouterModels());
      } catch (caught) {
        // The card falls back to the saved id; never a load failure.
        Logger.error(LOG_SCOPE, "failed to read the model catalog", caught);
      }
    }
  }, []);

  // Reload on every focus (D-84): returning from the model picker or the
  // OpenRouter browser shows the state that is now saved.
  useFocusEffect(
    useCallback(() => {
      void load()
        .then(() =>
          setError((current) => (current === LOAD_ERROR ? null : current)),
        )
        .catch((caught) => {
          Logger.error(LOG_SCOPE, "failed to load connection metadata", caught);
          setError(LOAD_ERROR);
        });
    }, [load]),
  );

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
    const submittedDraft = credentialDraft;
    const submittedValue = submitDraft(submittedDraft, lane);
    setPending(lane);
    setError(null);
    try {
      await saveDirectCredential(aiKeyStore, lane, submittedValue ?? "");
      const previous = byLane.get(lane);
      await upsertAiConnection(getExecutor(), {
        lane,
        rememberedModel: previous?.rememberedModel ?? "",
        now: localDateTime(),
      });
      setCredentialDraft((current) =>
        current === submittedDraft ? null : current,
      );
      await load();
      if (previous?.rememberedModel.trim()) {
        await activateAiConnection(getExecutor(), lane, localDateTime());
        await load();
      } else {
        onChooseModel(lane);
      }
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to configure direct connection");
      setError(
        caught instanceof Error && caught.message === "Enter an API key."
          ? "Enter an API key."
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
      await load();
      if (previous?.rememberedModel.trim()) {
        await activateAiConnection(
          getExecutor(),
          "openrouter",
          localDateTime(),
        );
        await load();
      } else {
        onChooseModel("openrouter");
      }
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
          setKey: (provider, key, customEndpoint) =>
            aiKeyStore.setKey(provider, key, customEndpoint),
          readRawCustomItem: () => aiKeyStore.readRawCustomItem(),
          restoreRawCustomItem: (raw) => aiKeyStore.restoreRawCustomItem(raw),
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
        {
          endpoint,
          previousEndpoint: byLane.get("custom")?.customEndpoint ?? "",
          credential: customCredential,
          model: customModel,
        },
      );
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      await activateAiConnection(getExecutor(), "custom", localDateTime());
      setCustomCredential("");
      customFieldsEdited.current = false;
      await load();
    } catch (caught) {
      Logger.error(LOG_SCOPE, "failed to configure custom connection");
      setError(
        caught instanceof CustomCredentialCompensationError
          ? caught.message
          : "Couldn't save that endpoint. Your previous connection is still active.",
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

  function card(
    lane: AiCloudProviderId,
    body: (state: ConnectionCardState) => React.ReactNode,
  ) {
    const connection = byLane.get(lane);
    const state = connectionCardState({
      lane,
      activeLane,
      rememberedModel: connection?.rememberedModel,
      hasCredential: credentialPresence[lane] === true,
    });
    const connected = state.status === "connected";
    const isExpanded = expanded === lane;
    const removeLabel = lane === "openrouter" ? "Disconnect" : "Remove key";
    const modelName = laneModelName(
      lane,
      state.rememberedModel,
      openRouterModels,
    );
    return (
      <View key={lane} testID={`ai-connection-card-${lane}`}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{
            expanded: isExpanded,
            selected: state.active,
          }}
          accessibilityLabel={`${LANE_NAMES[lane]} connection`}
          onPress={() => {
            setCredentialDraft(switchLane(lane));
            setExpanded(isExpanded ? null : lane);
          }}
          style={styles.cardHeader}
        >
          <View style={styles.copy}>
            <AppText role="label">{LANE_NAMES[lane]}</AppText>
            {modelName ? (
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                {modelName}
              </AppText>
            ) : null}
          </View>
          <AppText
            role="caption"
            testID={`ai-connection-status-${lane}`}
            style={{
              color: state.active ? colors.accentText : colors.textSecondary,
            }}
          >
            {connected
              ? "Connected"
              : state.active
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
              {
                borderTopColor: state.active ? colors.accent : colors.border,
              },
            ]}
          >
            {connected ? (
              // Connected: Change model leads (D-84).
              <Button
                role="primary"
                label="Change model"
                disabled={pending !== null}
                onPress={() => onChooseModel(lane)}
              />
            ) : null}
            {body(state)}
            {state.saved ? (
              <Button
                role="secondary"
                label="Use saved connection"
                disabled={pending !== null}
                onPress={() => void activateSaved(lane)}
              />
            ) : null}
            {connection ? (
              connected ? (
                // D-157: the same filled red button as a saved card's Remove
                // key; Change model above stays the primary action.
                <View style={styles.actions}>
                  <Button
                    role="destructive"
                    label={removeLabel}
                    onPress={() => setRemoveLane(lane)}
                  />
                </View>
              ) : (
                <View style={styles.actions}>
                  <Button
                    role="tertiary"
                    label="Choose model"
                    onPress={() => onChooseModel(lane)}
                  />
                  <Button
                    role="destructive"
                    label={removeLabel}
                    onPress={() => setRemoveLane(lane)}
                  />
                </View>
              )
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="AI Connections" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomClearance },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <SettingsSectionCard
          title="Recommended"
          testID="ai-connection-section-recommended"
        >
          {card("openrouter", (state) => (
            <>
              <AppText role="body">
                One connection for a broad, current model catalog with live
                pricing.
              </AppText>
              <Button
                role={state.status === "connected" ? "secondary" : "primary"}
                label={
                  pending === "openrouter"
                    ? "Connecting…"
                    : state.status === "connected"
                      ? "Reconnect"
                      : "Connect with OpenRouter"
                }
                disabled={pending !== null}
                onPress={() => void configureOpenRouter()}
              />
            </>
          ))}
        </SettingsSectionCard>
        <SettingsSectionCard
          title="Advanced Setup"
          testID="ai-connection-section-advanced"
        >
          {DIRECT_LANES.map((lane) =>
            card(lane, (state) => (
              <>
                <TextInput
                  accessibilityLabel={`${LANE_NAMES[lane]} API key`}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Paste API key"
                  placeholderTextColor={colors.textPlaceholder}
                  secureTextEntry
                  value={
                    credentialDraft?.lane === lane ? credentialDraft.value : ""
                  }
                  onChangeText={(value) =>
                    setCredentialDraft(editDraft(lane, value))
                  }
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
                  role={state.status === "connected" ? "secondary" : "primary"}
                  label={
                    pending === lane
                      ? "Saving…"
                      : state.status === "connected"
                        ? "Replace key"
                        : "Save key"
                  }
                  disabled={pending !== null}
                  onPress={() => void configureDirect(lane)}
                />
              </>
            )),
          )}
          {card("custom", (state) => (
            <>
              <AppText role="body">
                Advanced · OpenAI-compatible HTTPS only
              </AppText>
              <TextInput
                accessibilityLabel="Custom endpoint base URL"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="https://api.example.com/v1"
                placeholderTextColor={colors.textPlaceholder}
                value={endpoint}
                onChangeText={(value) => {
                  customFieldsEdited.current = true;
                  setEndpoint(value);
                }}
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
                placeholderTextColor={colors.textPlaceholder}
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
                placeholderTextColor={colors.textPlaceholder}
                value={customModel}
                onChangeText={(value) => {
                  customFieldsEdited.current = true;
                  setCustomModel(value);
                }}
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
                role={state.status === "connected" ? "secondary" : "primary"}
                label={
                  pending === "custom"
                    ? "Saving…"
                    : state.status === "connected"
                      ? "Save changes"
                      : "Connect"
                }
                disabled={pending !== null}
                onPress={() => void configureCustom()}
              />
            </>
          ))}
        </SettingsSectionCard>
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
  input: {
    borderRadius: RADII.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    paddingHorizontal: SPACING.md,
  },
  root: { flex: 1 },
});
