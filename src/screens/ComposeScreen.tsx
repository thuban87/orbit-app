/**
 * ComposeScreen (CMP-01/02/03) — the single, entry-agnostic compose surface. It
 * shows a contact's conversational fuel as read-only reference cards, a blank
 * editable draft, and capability-gated Send / Copy / add-number controls, then
 * hands the draft off to the OS SMS app (best-effort) or the clipboard
 * (guaranteed). Built ONCE here so Phases 11 (notification), 12 (widget), and 14
 * (AI) open it with just `{ contactId }` — no callbacks, no wiring.
 *
 * =============================================================================
 * LOAD-BEARING INVARIANTS (this file is a TRANSMITTABLE surface):
 *   - Fuel is read ONLY through `getRankedFuel` — its in-query
 *     `RANKED_FUEL_EXCLUSIONS` drop off_limits + unconfirmed source='ai' + blank
 *     rows. NEVER the editor-only fuel read (the one that surfaces
 *     off_limits), NEVER a component-side `.filter()`. The never-transmitted
 *     guarantee is structural, in SQL, and parity-tested (fuel-read.test.ts).
 *   - Send/Copy write NOTHING to the DB — no interaction/touchpoint row, no
 *     `contacts.last_contact` touch. Compose is NOT a touchpoint; the DATA-04
 *     single-writer invariant stays intact. Logging stays a separate, explicit
 *     profile action.
 *   - Send delegates native address+body marshalling to the shared Reach Out
 *     handoff — no hand-rolled `sms:` URI string or URL-scheme module.
 *   - No AI-Suggest control is built here (Phase 14 owns it) — only a comment
 *     slot is reserved.
 *   - Every colour resolves through `useTheme().colors.*` — zero hex literals
 *     (CLAUDE.md / check:colors), INCLUDING the Send disabled styling.
 * =============================================================================
 *
 * STATE MACHINE (A1 + B1): a discriminated `screenState`
 * (loading|ready|missing|error) drives what renders, and `smsAvailable`
 * (boolean|null) is the device SMS capability — `null` means UNKNOWN (probe
 * pending), NOT false. While the probe is pending NEITHER Send NOR the
 * SMS-unavailable helper renders and Copy stays the sole primary, so there is no
 * wrong-state flash. The focus effect resets BOTH at its START on EVERY focus and
 * guards every post-await setter with a `cancelled` flag flipped in cleanup, so a
 * re-focus (Edit-cancel Back, app foreground, a Phase-11/12/14 re-entry) can never
 * render a stale SMS result against a fresh pending probe, nor let a superseded
 * focus's load/probe overwrite the latest focused state.
 */
import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import * as SMS from "expo-sms";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { loadCachedCatalog } from "@/ai/model-catalog-cache";
import type { ModelCatalog } from "@/ai/model-catalog-filter";
import { createFileCatalogStorage } from "@/ai/model-catalog-storage";
import { resolveActiveCatalog, SEED_CATALOG } from "@/ai/model-registry";
import { resolvePrompt } from "@/ai/prompt-template";
import type { ResolvedPrompt } from "@/ai/prompt-types";
import { resolveMaxOutputTokens } from "@/ai/token-budget";
import { Avatar } from "@/components/Avatar";
import { readPromptContext } from "@/db/ai-context-read";
import {
  type AppSettings,
  getAppSettings,
  acknowledgeProvider as persistProviderAck,
} from "@/db/app-settings-dao";
import { listActionablePrimaryMethods } from "@/db/contact-methods-read";
import { getContactHeader } from "@/db/contact-read";
import { getExecutor, localDateTime } from "@/db/database";
import { type FuelItem, getRankedFuel } from "@/db/fuel-read";
import {
  AI_REQUEST_TIMEOUT_MS,
  AiSuggestionLifecycle,
  type AiSuggestionState,
  type RequestConfig,
} from "@/logic/ai-suggestion-logic";
import {
  actionablePrimaryPhoneDestination,
  type ComposeControls,
  resolveComposeControls,
} from "@/logic/compose-logic";
import { consumeAiSuggestionIntent } from "@/navigation/ai-suggestion-navigation";
import type { RootStackScreenProps } from "@/navigation/types";
import {
  buildInspectorViewState,
  buildProviderAckViewState,
} from "@/screens/settings-ai-logic";
import { AiError, AiService } from "@/services/AiService";
import type { AiCloudProviderId } from "@/services/ai-types";
import { formatFuelAge } from "@/services/fuel-age";
import { fuelKindLabel } from "@/services/fuel-kind-label";
import { performReachOut } from "@/services/reach-out/handoff";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

/**
 * Generation temperature (AI-SPEC §4 — a single-number tuning surface). 0.7 for
 * a warm-but-focused draft. The output/reasoning budget is NOT a flat constant:
 * it is resolved per active provider by `resolveTokenBudget` (`@/ai/token-budget`),
 * which caps a thinking model's reasoning and sizes output accordingly (14-09).
 */
const AI_TEMPERATURE = 0.7;

const LOG_SCOPE = "compose";

/** The compose surface's explicit state machine (A1). */
type ScreenState = "loading" | "ready" | "missing" | "error";

/** The header fields the compose surface renders + gates on (subset of the read). */
type Header = {
  id: number;
  name: string;
  photo: string | null;
  modified_at: string;
  /**
   * Non-null when the contact is archived. Archiving "hides the contact from
   * every live surface" (Phase-4 commitment) — compose is entry-agnostic and
   * reused by Phases 11/12/14, so an archived contact must be treated exactly
   * like a missing one (route Home, render no Send/Copy/fuel surface).
   */
  archived_at: string | null;
  /** DAO-selected actionable primary destination, or null when SMS is unavailable. */
  actionablePhone: string | null;
};

export function ComposeScreen({
  navigation,
  route,
}: RootStackScreenProps<"Compose">) {
  const { colors } = useTheme();
  const { contactId } = route.params;

  const [screenState, setScreenState] = useState<ScreenState>("loading");
  // Device SMS capability — null = UNKNOWN (probe pending), never rendered as
  // "unavailable" until it settles to a concrete boolean (A1).
  const [smsAvailable, setSmsAvailable] = useState<boolean | null>(null);
  const [header, setHeader] = useState<Header | null>(null);
  const [fuel, setFuel] = useState<FuelItem[]>([]);
  // The editable message — opens BLANK (no template/greeting/persistence).
  const [draft, setDraft] = useState("");
  // In-flight latch for Send (A3) — mirrors the profile's `logging` latch. Copy
  // is NEVER gated by this.
  const [sending, setSending] = useState(false);
  // Transient "Copied" confirmation, toggled by a single setState + setTimeout
  // (NOT a per-frame animation, per CLAUDE.md). The timer id is cleared on unmount
  // and before re-arming.
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- AI Suggest (Plan 14-05) ---------------------------------------------
  // The screen owns the SOLE AbortController + 20s timeout via the pure
  // lifecycle; the adapter never creates its own (H4). All state below is read
  // by the lifecycle's injected deps through refs so the single lifecycle
  // instance never closes over stale values.
  const [aiState, setAiState] = useState<AiSuggestionState>({ status: "idle" });
  // Whether a provider is configured (aiProvider !== 'none') — gates the trigger.
  const [aiAvailable, setAiAvailable] = useState(false);
  // Latest loaded AI settings (provider/model/template/ack flags), via ref so the
  // lifecycle deps always read the current values.
  const settingsRef = useRef<AppSettings | null>(null);
  // The one AiService instance (holds the four adapters; refreshed per request).
  const serviceRef = useRef<AiService | null>(null);
  if (serviceRef.current === null) {
    serviceRef.current = new AiService();
  }
  // The active model catalog (cache-overrides-seed) — its per-model `limits`
  // supply Anthropic's REQUIRED `max_tokens` (14-11). Seed is the offline default;
  // the cached catalog (if any) is loaded best-effort on focus below.
  const catalogRef = useRef<ModelCatalog>(SEED_CATALOG);
  // Providers already acknowledged this session (seeded from the ack flags on
  // load, extended after a durable ack write). The H5 gate reads this.
  const acknowledgedRef = useRef<Set<AiCloudProviderId>>(new Set());
  // Live focus + mount facts for the stale guard (C3-H4).
  const focusedRef = useRef(false);
  const mountedRef = useRef(true);
  // A ref mirror of the draft so `isDraftEmpty` never sees a stale closure.
  const draftRef = useRef("");
  // Consume-once latch for the profile→Compose intent (T-14-16).
  const intentConsumedRef = useRef(false);

  // Build the ONE lifecycle instance (its effects read the refs above). Created
  // lazily on first render; refs are already initialised by this point.
  const lifecycleRef = useRef<AiSuggestionLifecycle | null>(null);
  if (lifecycleRef.current === null) {
    lifecycleRef.current = new AiSuggestionLifecycle({
      // Resolve the ONE immutable prompt for this request, exactly once.
      resolvePrompt: async (): Promise<ResolvedPrompt> => {
        const exec = getExecutor();
        const context = await readPromptContext(exec, contactId);
        const template = settingsRef.current?.aiPromptTemplate ?? "";
        return resolvePrompt(template, context);
      },
      isProviderAcknowledged: (): boolean => {
        const s = settingsRef.current;
        if (!s || s.aiProvider === "none") return false;
        return acknowledgedRef.current.has(s.aiProvider);
      },
      // The H5 carve-out: the SOLE ai_ack_* write. Its promise must RESOLVE
      // before the lifecycle creates a controller / calls generate (C2-H3).
      acknowledgeProvider: async (): Promise<void> => {
        const s = settingsRef.current;
        if (!s || s.aiProvider === "none") {
          throw new AiError("not_configured");
        }
        const provider = s.aiProvider;
        const exec = getExecutor();
        await persistProviderAck(exec, provider, localDateTime());
        acknowledgedRef.current.add(provider);
      },
      // Egress: forward the lifecycle's OWN signal (H4); the adapter reads only
      // `resolved.payload` (C3-M1).
      generate: (prompt, signal): Promise<string> => {
        const s = settingsRef.current;
        const service = serviceRef.current;
        if (!s || !service) throw new AiError("not_configured");
        service.refreshProviders(s);
        const provider = service.getActiveProvider(s);
        if (!provider) throw new AiError("not_configured");
        const model = s.aiProvider === "custom" ? s.aiCustomModel : s.aiModel;
        // 14-11: no artificial output cap. Only Anthropic sends `max_tokens` (its
        // API requires one), set to the selected model's OWN maximum from the
        // catalog; OpenAI/Gemini omit it (undefined) so the model default applies
        // (Gemini → dynamic thinking). Visible length is bounded by the
        // 1,200-code-point post-parse trim in AiService, not here.
        const maxOutputTokens = resolveMaxOutputTokens(
          s.aiProvider,
          model,
          catalogRef.current,
        );
        return provider.generate({
          resolvedPrompt: prompt,
          model,
          temperature: AI_TEMPERATURE,
          maxOutputTokens,
          signal,
        });
      },
      applyDraft: (text: string): void => {
        draftRef.current = text;
        setDraft(text);
      },
      isDraftEmpty: (): boolean => draftRef.current.trim().length === 0,
      createController: (): AbortController => new AbortController(),
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (handle) =>
        clearTimeout(handle as ReturnType<typeof setTimeout>),
      isActive: (): boolean => focusedRef.current && mountedRef.current,
      currentConfig: (): RequestConfig => {
        const s = settingsRef.current;
        const provider = s?.aiProvider ?? "none";
        const model =
          provider === "custom" ? (s?.aiCustomModel ?? "") : (s?.aiModel ?? "");
        return { provider, model, contactId };
      },
      sanitizeError: (err): string =>
        err instanceof AiError ? err.code : "unknown",
      onChange: (next): void => setAiState(next),
    });
  }

  // Back → dashboard (the one genuinely new nav behaviour, B2). `reset` is called
  // INSIDE the callback body (never at render — `navigation.reset(...)` returns
  // void, so a bare assignment would fire it during render and bind undefined to
  // onPress). Entry-agnostic: robust when a future notification/widget caller has
  // no Home in the back stack.
  const goHome = useCallback(
    () => navigation.reset({ index: 0, routes: [{ name: "Home" }] }),
    [navigation],
  );

  // Self-fetch on EVERY focus (first mount AND every return — e.g. from Edit after
  // adding a phone). B1: reset the state machine at the START of each run so a
  // re-focus can't flash the prior SMS result/helper against the new pending
  // probe, and carry a `cancelled` flag so a superseded focus's load/probe can't
  // overwrite the latest focused state.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      focusedRef.current = true;
      setScreenState("loading");
      setSmsAvailable(null);

      const exec = getExecutor();
      void (async () => {
        try {
          // Header + fuel + AI settings (NOT the SMS probe — that runs separately
          // below so it can neither block nor fail this load).
          const [row, fuelRows, settings, actionableMethods] =
            await Promise.all([
              getContactHeader(exec, contactId),
              getRankedFuel(exec, contactId),
              getAppSettings(exec),
              listActionablePrimaryMethods(exec, contactId),
            ]);
          if (cancelled) {
            return;
          }
          // Publish AI settings + seed the acknowledged-provider set from the
          // persisted ack flags so a prior session's acknowledgement still counts.
          settingsRef.current = settings;
          // Best-effort refresh of the active catalog (cache-overrides-seed) so
          // Anthropic's required `max_tokens` uses the freshest per-model max.
          // Non-blocking and failure-tolerant — the seed default already works.
          void loadCachedCatalog(createFileCatalogStorage())
            .then((cached) => {
              if (!cancelled) catalogRef.current = resolveActiveCatalog(cached);
            })
            .catch(() => undefined);
          const acked = new Set<AiCloudProviderId>();
          if (settings.aiAckOpenai === 1) acked.add("openai");
          if (settings.aiAckAnthropic === 1) acked.add("anthropic");
          if (settings.aiAckGoogle === 1) acked.add("google");
          if (settings.aiAckCustom === 1) acked.add("custom");
          acknowledgedRef.current = acked;
          setAiAvailable(settings.aiProvider !== "none");
          // A stale/deleted OR archived contact — exit to the dashboard, never
          // render a "no phone" (or any) Send/Copy/fuel surface. `getContactHeader`
          // intentionally does NOT filter `archived_at IS NULL` (it stays loadable
          // by id), so an entry-agnostic re-entry from Phase 11/12/14 could open an
          // archived contact here; archiving must hide the contact from EVERY live
          // surface, so treat archived exactly like missing. Guarded by the same
          // `if (!cancelled)` as the null-header branch above.
          if (row === null || row.archived_at !== null) {
            setScreenState("missing");
            goHome();
            return;
          }
          setHeader({
            id: row.id,
            name: row.name,
            photo: row.photo,
            modified_at: row.modified_at,
            archived_at: row.archived_at,
            actionablePhone: actionablePrimaryPhoneDestination(
              actionableMethods.phone,
            ),
          });
          setFuel(fuelRows);
          setScreenState("ready");

          // Consume-once profile→Compose AI intent (T-14-16): auto-start ONE
          // suggestion, but only when a provider is configured. Clear the param
          // BEFORE dispatch so a focus reload / re-render cannot repeat it.
          if (
            consumeAiSuggestionIntent(
              route.params.requestAiSuggestion,
              intentConsumedRef.current,
            )
          ) {
            // Do NOT navigation.setParams() to clear the intent here: that mutates
            // route.params.requestAiSuggestion — a dependency of THIS focus effect —
            // which re-subscribes the effect and fires its cleanup dispose() on the
            // request we JUST started, stranding it in 'resolving' forever. The
            // one-shot is already guarded by intentConsumedRef; a fresh push/remount
            // carries fresh params, and a re-focus of this mount is ref-guarded.
            intentConsumedRef.current = true;
            if (settings.aiProvider !== "none") {
              void lifecycleRef.current?.begin();
            }
          }
        } catch (err) {
          Logger.error(LOG_SCOPE, "failed to load contact", err);
          if (!cancelled) {
            Alert.alert(
              "Couldn't load this contact",
              "Please go back and retry.",
            );
            setScreenState("error");
          }
        }
      })();

      // SMS capability probe — SEPARATE from the header/fuel load, so a rejected
      // probe degrades to `false` WITHOUT failing the contact/fuel load. The
      // cancelled guard prevents a slow prior-focus probe from clobbering the
      // fresh `null`.
      SMS.isAvailableAsync()
        .then((ok) => {
          if (!cancelled) {
            setSmsAvailable(ok);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSmsAvailable(false);
          }
        });

      return () => {
        cancelled = true;
        // Blur / navigation away / contactId change: the screen is no longer
        // active and any in-flight AI request must abort (stale guard input +
        // H4 controller teardown). dispose() is idempotent.
        focusedRef.current = false;
        lifecycleRef.current?.dispose();
      };
    }, [contactId, goHome, route.params.requestAiSuggestion]),
  );

  // Android hardware/system Back → dashboard too (consume the event so native-stack
  // doesn't pop to the profile). Registered while focused; removed on blur.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goHome();
        return true;
      });
      return () => sub.remove();
    }, [goHome]),
  );

  // Clear a pending "Copied" timer on unmount (no setState after teardown).
  useEffect(() => {
    return () => {
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
        copyTimer.current = null;
      }
    };
  }, []);

  // Track mount and abort any in-flight AI request on unmount (H4 + C3-H4). The
  // focus-effect cleanup handles blur; this guards a hard unmount too.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      lifecycleRef.current?.dispose();
    };
  }, []);

  // Send — in-flight latched (A3). Returns early while a handoff is open AND when
  // there is no phone (C1 — narrows the canonical destination and guards a stale
  // handler), then opens the OS SMS composer pre-filled. Resets the
  // latch in `finally` so both a resolved and a thrown handoff release it (a rapid
  // double-tap cannot launch two composers). Writes NOTHING to the DB.
  const onSend = useCallback(async () => {
    if (sending) {
      return;
    }
    const phone = header?.actionablePhone ?? null;
    if (phone === null) {
      return;
    }
    setSending(true);
    try {
      const exec = getExecutor();
      const settings = await getAppSettings(exec);
      // M2 Phase 12 owns Compose UX, but Send always shares this handoff-to-native
      // plus assist-creation seam and never writes an interaction directly.
      await performReachOut(exec, {
        contactId,
        channel: "text",
        endpoint: phone,
        assistEnabled: settings.interactionAssistEnabled === 1,
        now: localDateTime(),
        messageBody: draft,
      });
    } finally {
      setSending(false);
    }
  }, [sending, header?.actionablePhone, contactId, draft]);

  // Copy — the guaranteed handoff, NEVER gated by `sending`. On success show a
  // transient "Copied" for ~2s via setState + setTimeout (not a per-frame anim).
  const onCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(draft);
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
      setCopied(true);
      copyTimer.current = setTimeout(() => {
        setCopied(false);
        copyTimer.current = null;
      }, 2000);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to copy draft", err);
      Alert.alert("Couldn't copy", "Please try again.");
    }
  }, [draft]);

  // Map a sanitized AI error code to a short, user-facing line (never raw
  // provider detail — the code is all that ever leaves the adapter, T-14-05).
  const aiErrorText = (code: string): string => {
    switch (code) {
      case "timeout":
        return "That took too long. Try again?";
      case "cancelled":
        return "Cancelled.";
      case "not_configured":
        return "Add an AI provider in Settings first.";
      case "unauthorized":
        return "Your API key was rejected. Check it in Settings.";
      case "rate_limited":
        return "The provider is rate-limiting. Try again shortly.";
      case "blocked":
      case "invalid_endpoint":
        return "That endpoint was refused. Check it in Settings.";
      default:
        return "Couldn't draft a message. Try again?";
    }
  };

  // The AI Suggest section — rendered in the reserved slot. Compose owns the sole
  // controller/timeout via the lifecycle; every branch here only dispatches
  // lifecycle actions (no direct network/DB work).
  const renderAi = () => {
    const ai = lifecycleRef.current;
    if (!ai) return null;

    // Trigger: shown only when a provider is configured AND nothing is in flight.
    if (aiState.status === "idle") {
      if (!aiAvailable) return null;
      return (
        <Pressable
          testID="compose-ai-suggest"
          accessibilityRole="button"
          accessibilityLabel="Draft with AI"
          onPress={() => void ai.begin()}
          style={[
            styles.aiTrigger,
            { backgroundColor: colors.background, borderColor: colors.accent },
          ]}
        >
          <Text style={[styles.aiTriggerText, { color: colors.accent }]}>
            Draft with AI
          </Text>
        </Pressable>
      );
    }

    if (aiState.status === "resolving" || aiState.status === "loading") {
      return (
        <View
          testID="compose-ai-loading"
          style={[
            styles.aiPanel,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.aiPanelText, { color: colors.textSecondary }]}>
            Drafting a message…
          </Text>
          <Pressable
            testID="compose-ai-cancel"
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={() => ai.cancel()}
            style={[styles.aiSecondaryBtn, { borderColor: colors.border }]}
          >
            <Text
              style={[styles.aiSecondaryText, { color: colors.textSecondary }]}
            >
              Cancel
            </Text>
          </Pressable>
        </View>
      );
    }

    if (aiState.status === "needs-acknowledgement") {
      // Same immutable ResolvedPrompt reference the lifecycle will hand to the
      // adapter — the inspector + acknowledgement views read it unchanged (M1).
      const ack = buildProviderAckViewState(aiState.provider, aiState.prompt);
      const inspector = buildInspectorViewState(aiState.prompt);
      return (
        <View
          testID="compose-ai-acknowledgement"
          style={[
            styles.aiPanel,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.aiPanelHeading, { color: colors.textPrimary }]}>
            First message to {ack.providerName}
          </Text>
          <Text style={[styles.aiPanelText, { color: colors.textSecondary }]}>
            This exact text will be sent to {ack.providerName}. Nothing else
            leaves your device.
          </Text>
          {ack.retentionCaveat ? (
            <Text style={[styles.aiPanelText, { color: colors.textSecondary }]}>
              {ack.retentionCaveat}
            </Text>
          ) : null}
          <ScrollView
            testID="compose-ai-prompt"
            style={[styles.aiPromptBox, { borderColor: colors.border }]}
          >
            <Text style={[styles.aiPromptText, { color: colors.textPrimary }]}>
              {ack.prompt}
            </Text>
          </ScrollView>
          {inspector.truncations.map((t, i) => (
            <Text
              key={`${t.category}-${i}`}
              style={[styles.aiPanelMeta, { color: colors.textSecondary }]}
            >
              {t.category}: {t.detail}
            </Text>
          ))}
          <View style={styles.aiPanelActions}>
            <Pressable
              testID="compose-ai-decline"
              accessibilityRole="button"
              accessibilityLabel="Not now"
              onPress={() => ai.decline()}
              style={[styles.aiSecondaryBtn, { borderColor: colors.border }]}
            >
              <Text
                style={[
                  styles.aiSecondaryText,
                  { color: colors.textSecondary },
                ]}
              >
                Not now
              </Text>
            </Pressable>
            <Pressable
              testID="compose-ai-acknowledge"
              accessibilityRole="button"
              accessibilityLabel="Send to provider"
              onPress={() => void ai.acknowledge()}
              style={[
                styles.aiPrimaryBtn,
                { backgroundColor: colors.accent, borderColor: colors.accent },
              ]}
            >
              <Text
                style={[styles.aiPrimaryText, { color: colors.background }]}
              >
                Acknowledge & continue
              </Text>
            </Pressable>
          </View>
        </View>
      );
    }

    if (aiState.status === "confirm-replace") {
      return (
        <View
          testID="compose-ai-confirm-replace"
          style={[
            styles.aiPanel,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.aiPanelHeading, { color: colors.textPrimary }]}>
            Replace your draft?
          </Text>
          <Text style={[styles.aiPanelText, { color: colors.textSecondary }]}>
            You already wrote something. Replace it with this suggestion?
          </Text>
          <ScrollView
            testID="compose-ai-suggestion"
            style={[styles.aiPromptBox, { borderColor: colors.border }]}
          >
            <Text style={[styles.aiPromptText, { color: colors.textPrimary }]}>
              {aiState.suggestion}
            </Text>
          </ScrollView>
          <View style={styles.aiPanelActions}>
            <Pressable
              testID="compose-ai-cancel-replace"
              accessibilityRole="button"
              accessibilityLabel="Keep my draft"
              onPress={() => ai.cancelReplace()}
              style={[styles.aiSecondaryBtn, { borderColor: colors.border }]}
            >
              <Text
                style={[
                  styles.aiSecondaryText,
                  { color: colors.textSecondary },
                ]}
              >
                Keep mine
              </Text>
            </Pressable>
            <Pressable
              testID="compose-ai-confirm"
              accessibilityRole="button"
              accessibilityLabel="Replace draft"
              onPress={() => ai.confirmReplace()}
              style={[
                styles.aiPrimaryBtn,
                { backgroundColor: colors.accent, borderColor: colors.accent },
              ]}
            >
              <Text
                style={[styles.aiPrimaryText, { color: colors.background }]}
              >
                Replace
              </Text>
            </Pressable>
          </View>
        </View>
      );
    }

    // status === "error"
    return (
      <View
        testID="compose-ai-error"
        style={[
          styles.aiPanel,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.aiPanelText, { color: colors.danger }]}>
          {aiErrorText(aiState.code)}
        </Text>
        <View style={styles.aiPanelActions}>
          <Pressable
            testID="compose-ai-dismiss"
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            onPress={() => ai.cancel()}
            style={[styles.aiSecondaryBtn, { borderColor: colors.border }]}
          >
            <Text
              style={[styles.aiSecondaryText, { color: colors.textSecondary }]}
            >
              Dismiss
            </Text>
          </Pressable>
          <Pressable
            testID="compose-ai-retry"
            accessibilityRole="button"
            accessibilityLabel="Retry"
            onPress={() => void ai.retry()}
            style={[
              styles.aiPrimaryBtn,
              { backgroundColor: colors.accent, borderColor: colors.accent },
            ]}
          >
            <Text style={[styles.aiPrimaryText, { color: colors.background }]}>
              Try again
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  // ---- Render --------------------------------------------------------------

  const backPill = (
    <Pressable
      testID="compose-back"
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={goHome}
      style={[styles.backBtn, { borderColor: colors.border }]}
    >
      <Text style={{ color: colors.textSecondary }}>Back</Text>
    </Pressable>
  );

  // "loading" shows minimal chrome + Back; "error" shows Back after its Alert;
  // "missing" has already navigated home (render nothing meaningful).
  if (screenState !== "ready" || header === null) {
    return (
      <ScrollView
        testID="compose-screen"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>{backPill}</View>
      </ScrollView>
    );
  }

  // "ready" — derive the controls (A1) through the pure resolver UNCONDITIONALLY.
  // The resolver owns the interim (smsAvailable === null, probe pending) case too,
  // so no capability arithmetic is re-derived inline here (WR-02): while pending it
  // returns Send hidden / Copy sole primary / no helper; once the probe settles to a
  // concrete boolean it decides from the matrix.
  const phone = header.actionablePhone;
  const hasPhone = phone != null;
  const controls: ComposeControls = resolveComposeControls(
    hasPhone,
    smsAvailable,
  );

  const now = localDateTime();
  const copyPrimary = controls.copyEmphasis === "primary";

  return (
    <ScrollView
      testID="compose-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      {/* Header row: Back pill, Avatar, contact name. */}
      <View style={styles.header}>
        {backPill}
        <Avatar
          photo={header.photo}
          name={header.name}
          contactId={contactId}
          cacheBust={header.modified_at}
          size={64}
        />
        <Text
          testID="compose-name"
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          {header.name}
        </Text>
      </View>

      {/* Conversational fuel — read-only reference cards, placed ABOVE the draft
          (talking points visible while composing). Every row is from getRankedFuel
          (off_limits + unconfirmed AI + blank excluded in-query); render ALL rows. */}
      <View testID="compose-fuel" style={styles.section}>
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
          CONVERSATIONAL FUEL
        </Text>
        {fuel.length === 0 ? (
          <Text
            testID="compose-fuel-empty"
            style={[styles.helper, { color: colors.textSecondary }]}
          >
            No fuel yet. Add some on their profile.
          </Text>
        ) : (
          fuel.map((row, index) => (
            <View
              key={row.id}
              testID={`compose-fuel-item-${index}`}
              style={[
                styles.fuelCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.fuelKind, { color: colors.textSecondary }]}>
                {fuelKindLabel(row.kind)}
              </Text>
              <Text style={[styles.fuelText, { color: colors.textPrimary }]}>
                {row.text ?? ""}
              </Text>
              {row.label ? (
                <Text
                  style={[styles.fuelMeta, { color: colors.textSecondary }]}
                >
                  {row.label}
                </Text>
              ) : null}
              <Text style={[styles.fuelMeta, { color: colors.textSecondary }]}>
                {formatFuelAge(row.created_at, now)}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* AI Suggest (Plan 14-05) — the single editable-draft AI flow. Compose
          owns the sole AbortController + 20s timeout via the pure lifecycle; this
          renders the trigger, loading+Cancel, the first-send acknowledgement
          (showing the EXACT ResolvedPrompt), replacement confirmation, and Retry. */}
      {renderAi()}

      {/* Draft — opens BLANK, multiline. */}
      <View testID="compose-draft" style={styles.section}>
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
          YOUR MESSAGE
        </Text>
        <TextInput
          testID="compose-draft-input"
          value={draft}
          onChangeText={(text) => {
            // Keep the ref mirror in lockstep so the AI lifecycle's
            // `isDraftEmpty` never reads a stale value.
            draftRef.current = text;
            setDraft(text);
          }}
          multiline
          placeholder="Write your message…"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.draftInput,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
        />
      </View>

      {/* SMS-unavailable helper (phone present, device can't text). */}
      {controls.smsUnavailableHelper ? (
        <Text style={[styles.helper, { color: colors.textSecondary }]}>
          This device can't send texts — copy your message instead.
        </Text>
      ) : null}

      {/* Add-a-phone-number affordance (no-phone only) → Edit. */}
      {controls.addNumber ? (
        <Pressable
          testID="compose-add-number"
          accessibilityRole="button"
          accessibilityLabel="Add a phone number"
          onPress={() => navigation.navigate("Edit", { contactId })}
          style={styles.addNumber}
        >
          <Text style={[styles.addNumberText, { color: colors.accent }]}>
            Add a phone number
          </Text>
        </Pressable>
      ) : null}

      {/* Action row. */}
      <View style={styles.actions}>
        {copied ? (
          <Text
            testID="compose-copied"
            style={[styles.copied, { color: colors.accent }]}
          >
            Copied
          </Text>
        ) : null}

        {/* Copy — always present; primary (filled-accent) when it is the sole
            primary, else secondary (accent-outline). NEVER gated by `sending`. */}
        <Pressable
          testID="compose-copy"
          accessibilityRole="button"
          accessibilityLabel="Copy"
          onPress={() => void onCopy()}
          style={[
            styles.actionBtn,
            copyPrimary
              ? { backgroundColor: colors.accent, borderColor: colors.accent }
              : {
                  backgroundColor: colors.background,
                  borderColor: colors.accent,
                },
          ]}
        >
          <Text
            style={[
              styles.actionText,
              { color: copyPrimary ? colors.background : colors.accent },
            ]}
          >
            Copy
          </Text>
        </Pressable>

        {/* Send — only when a phone + SMS capability exist. In-flight latched (A3):
            token-based disabled styling, accessibilityState, and a finally reset. */}
        {controls.send === "shown" ? (
          <Pressable
            testID="compose-send"
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: sending }}
            disabled={sending}
            onPress={() => void onSend()}
            style={[
              styles.actionBtn,
              {
                backgroundColor: sending ? colors.surface : colors.accent,
                borderColor: sending ? colors.border : colors.accent,
              },
            ]}
          >
            <Text
              style={[
                styles.actionText,
                { color: sending ? colors.textSecondary : colors.background },
              ]}
            >
              Send
            </Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
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
    flex: 1,
    fontSize: 24,
    fontWeight: "700",
  },
  section: {
    gap: 8,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  helper: {
    fontSize: 13,
    fontWeight: "600",
  },
  fuelCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  fuelKind: {
    fontSize: 13,
    fontWeight: "600",
  },
  fuelText: {
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 21,
  },
  fuelMeta: {
    fontSize: 13,
    fontWeight: "600",
  },
  draftInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 21,
    minHeight: 120,
    textAlignVertical: "top",
  },
  addNumber: {
    minHeight: 44,
    justifyContent: "center",
  },
  addNumberText: {
    fontSize: 16,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  copied: {
    fontSize: 13,
    fontWeight: "600",
  },
  actionBtn: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 20,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: {
    fontSize: 16,
    fontWeight: "700",
  },
  aiTrigger: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 20,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  aiTriggerText: {
    fontSize: 16,
    fontWeight: "700",
  },
  aiPanel: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  aiPanelHeading: {
    fontSize: 16,
    fontWeight: "700",
  },
  aiPanelText: {
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
  },
  aiPanelMeta: {
    fontSize: 12,
    fontWeight: "600",
  },
  aiPromptBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    maxHeight: 220,
  },
  aiPromptText: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 19,
  },
  aiPanelActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  aiPrimaryBtn: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  aiPrimaryText: {
    fontSize: 15,
    fontWeight: "700",
  },
  aiSecondaryBtn: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  aiSecondaryText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
