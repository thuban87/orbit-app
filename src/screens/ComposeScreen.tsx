/**
 * ComposeScreen (COMP-01/05/07) — the editor-first Text reach-out slice. It opens
 * on a BLANK message editor (no greeting, no AI prose, no remembered context, no
 * auto-started AI — COMP-01), resolves the contact's primary phone, gates
 * Transmit / Copy through the pure capability resolver, hands the composition off
 * to the OS SMS composer via the shared Reach Out handoff, and — on return — shows
 * an ADDITIVE "Did you send it?" panel that logs the canonical Message interaction
 * through the existing assist path (COMP-05).
 *
 * =============================================================================
 * LOAD-BEARING INVARIANTS:
 *   - Transmit NEVER claims Orbit delivered the message; the honest
 *     "Did you send it?" prompt is the only truth source (D-05, T-35-07).
 *   - The confirmation logs at the assist row's `handoff_at`, NEVER at
 *     confirmation time; it reuses `markAssistLogged` UNCHANGED (D-06, ADR-071).
 *   - The panel appears ONLY when performReachOut reports
 *     `handoffStarted === true && assistUid !== null`. A failed native launch
 *     (handoffStarted false — markAssistFailed already ran) or an assists-opted-out
 *     session (assistUid null) shows NO panel and attempts NO fragile re-query
 *     (HIGH-1, T-35-05/T-35-21).
 *   - "Not yet" closes ONLY this local panel and leaves the durable assist row
 *     PENDING — it does NOT call markAssistDismissed. The durable "Don't log"
 *     path stays on the app-global PendingConfirmationsSheet (D-05).
 *   - This is ADDITIVE: the app-global AssistBanner + PendingConfirmationsSheet
 *     (App.tsx) remain mounted and functional (D-04, ESCALATE trip-wire).
 *   - Session draft state lives in `compose-session-store` (survives nav /
 *     background, cleared on Transmit-confirmed, NOT restored across relaunch —
 *     COMP-07 / D-10). Never persisted to any durable store.
 *   - The Transmit channel derives from the session-store `mode` field (default
 *     'text'), never a hardcoded channel literal — Email is an additive branch in
 *     a later plan.
 *   - Every colour resolves through `useTheme().colors.*` — zero hex literals
 *     (CLAUDE.md / check:colors). New/rebuilt UI speaks in `AppText` and `Button`
 *     ROLES, never hand-rolled Pressables or raw font sizes.
 *
 * AI is intentionally ABSENT here: the old single-suggestion AI-lifecycle wiring
 * (its construction, the acknowledgement gate, the replace-confirm state, and the
 * AI render + error-mapping helpers) was removed so plan 35-04 can narrow the
 * reshaped AI exports without a stale consumer failing its `tsc` gate. AI is
 * re-wired against the reshaped lifecycle in plan 35-08; the sanitized
 * error-code to line mapping is RE-CREATED there.
 * =============================================================================
 */
import { type NavigationProp, useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import { File, Paths } from "expo-file-system";
import * as SMS from "expo-sms";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import {
  assertPromptFitsContext,
  PromptContextOverflowError,
} from "@/ai/context-estimate";
import { projectMessageFocus } from "@/ai/message-focus";
import { loadCachedCatalog } from "@/ai/model-catalog-cache";
import type { ModelCatalog } from "@/ai/model-catalog-filter";
import { createFileCatalogStorage } from "@/ai/model-catalog-storage";
import { resolveActiveCatalog, SEED_CATALOG } from "@/ai/model-registry";
import {
  loadCachedOpenRouterCatalog,
  type OpenRouterModel,
} from "@/ai/openrouter-catalog";
import { resolvePrompt } from "@/ai/prompt-template";
import type { PromptContext, ResolvedPrompt } from "@/ai/prompt-types";
import { resolveMaxOutputTokens } from "@/ai/token-budget";
import { AIComposeContextReview } from "@/components/AIComposeContextReview";
import { Avatar } from "@/components/Avatar";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { ChromeScrim } from "@/components/ui/ChromeScrim";
import {
  type ResolvedAiConnection,
  resolveActiveAiConnection,
} from "@/db/ai-connections-dao";
import { readPromptContext } from "@/db/ai-context-read";
import {
  type AppSettings,
  getAppSettings,
  updateAppSettings,
} from "@/db/app-settings-dao";
import { readComposeResearch } from "@/db/compose-research-read";
import {
  type ContactMethodRow,
  setContactMethodPrimary,
} from "@/db/contact-methods-dao";
import {
  type ContactMethodGroups,
  listContactMethodGroups,
  selectActionablePrimaryMethods,
} from "@/db/contact-methods-read";
import { getContactHeader } from "@/db/contact-read";
import { getExecutor, localDateTime } from "@/db/database";
import { markAssistLogged } from "@/db/interaction-assist-dao";
import {
  getWritingStyle,
  listPersonalizationSections,
} from "@/db/personalization-dao";
import {
  type AiAvailability,
  computeAiAvailability,
  isCredentialFailure,
  isSelectedConnectionModelAvailable,
  readCredentialPresence,
  selectAiAffordance,
} from "@/logic/ai-availability";
import {
  buildAiDiagnostic,
  classifyAiFailure,
  createAiCorrelationId,
  failureMessage,
} from "@/logic/ai-diagnostics";
import {
  generateVariants,
  variantTemperature,
} from "@/logic/ai-generate-variants";
import {
  AiSuggestionLifecycle,
  type AiSuggestionState,
} from "@/logic/ai-suggestion-logic";
import {
  actionablePrimaryPhoneDestination,
  type ComposeControls,
  type ComposeExit,
  composeExitDisposition,
  effectiveMode,
  nextRememberedMode,
  resolveComposeControls,
  resolveCopyTargets,
  resolveUsableMode,
} from "@/logic/compose-logic";
import type { ContactMethodType } from "@/logic/contact-method-normalization";
import { resetToDashboardRoot } from "@/navigation/reset-intents";
import type { RootStackScreenProps, TabParamList } from "@/navigation/types";
import { AiError, type AiErrorCode, AiService } from "@/services/AiService";
import { aiKeyStore } from "@/services/ai-key-store";
import { performReachOut } from "@/services/reach-out/handoff";
import { useAiConfigStore } from "@/stores/ai-config-store";
import { useComposeSession } from "@/stores/compose-session-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { TYPOGRAPHY } from "@/theme/tokens/typography";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "compose";

/**
 * The BASE generation temperature (AI-SPEC §4 — a single-number tuning surface).
 * 0.7 for a warm-but-focused draft. Unlike the pre-35-01 single fixed value, this
 * is now only the BASE: each of the three fan-out calls derives a DISTINCT
 * per-variant temperature from it via `variantTemperature`, so the three
 * suggestions are meaningfully varied by a deliberate lever (COMP-12 / D-12),
 * not by incidental model nondeterminism.
 */
const AI_TEMPERATURE_BASE = 0.7;

/** The number of suggestions the review surface always shows (ADR-079). */
const AI_VARIANT_COUNT = 3;

/** Minimal session-only Adjust shortcuts (dossier §AA). */
const AI_ADJUST_QUICK_ACTIONS = ["Shorter", "Warmer", "More direct"] as const;

/**
 * Map a SANITIZED AI error code to a short, user-facing recovery line (COMP-13 /
 * T-35-03). RE-CREATED here — plan 35-01 removed the prior `aiErrorText` with the
 * old AI block. The `code` is the ONLY thing that ever leaves the adapter
 * (AiService throws `AiError` whose message IS its code); this never renders raw
 * provider text and never turns Compose into a provider-troubleshooting surface.
 */
function aiErrorText(code: string): string {
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
}

/** The compose surface's explicit state machine (A1). */
type ScreenState = "loading" | "ready" | "missing" | "error";

/** The header fields the compose surface renders + gates on (subset of the read). */
type Header = {
  id: number;
  name: string;
  photo: string | null;
  modified_at: string;
  /** Non-null when the contact is archived — treated exactly like missing. */
  archived_at: string | null;
  /** DAO-selected actionable primary phone destination, or null when none. */
  actionablePhone: string | null;
  /** DAO-selected actionable primary email destination, or null when none. */
  actionableEmail: string | null;
  /**
   * The full ordered per-type method groups (per-row is_primary/is_actionable).
   * Consumed to decide WHEN the establish-primary picker is shown —
   * selectActionablePrimaryMethods returns only the effective primary and CANNOT
   * reveal whether it is an explicit stored primary or a first-actionable
   * fallback (MEDIUM: contact-methods-read.ts:10-19).
   */
  methodGroups: ContactMethodGroups;
};

/** Truncate a long address/number for a display/picker row; full value on select. */
function truncateMethodValue(value: string): string {
  return value.length > 32 ? `${value.slice(0, 31)}…` : value;
}

/** Resolve adapter usability without substituting a different selected model. */
export function ComposeScreen({
  navigation,
  route,
}: RootStackScreenProps<"Compose">) {
  const { colors } = useTheme();
  const { contactId } = route.params;

  const [screenState, setScreenState] = useState<ScreenState>("loading");
  // Device SMS capability — null = UNKNOWN (probe pending), never rendered as
  // "unavailable" until it settles to a concrete boolean (A1, no-flash).
  const [smsAvailable, setSmsAvailable] = useState<boolean | null>(null);
  const [header, setHeader] = useState<Header | null>(null);
  // In-flight latch for Transmit (A3) — a rapid double-tap cannot launch two
  // composers. Copy is NEVER gated by this.
  const [sending, setSending] = useState(false);
  // Transient copy confirmation ("Message copied" / "Subject copied") via a
  // single setState + setTimeout (NOT a per-frame animation, per CLAUDE.md).
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The additive "Did you send it?" panel — non-null (carrying the assist UID to
  // log) ONLY after a started handoff that created an assist. `logging` latches
  // the "Yes" write so a double-tap cannot double-log (T-35-05).
  const [confirm, setConfirm] = useState<{ assistUid: string } | null>(null);
  const [logging, setLogging] = useState(false);
  // The count of populated Things-to-Remember Research items for this contact,
  // driving the compact 'Things to Remember · N' entry (COMP-08). A local SQLite
  // read on focus — never on the render path, never a blocking network call.
  const [researchCount, setResearchCount] = useState(0);

  // ── AI (re-wired against the reshaped lifecycle, plan 35-04; plan 35-01 removed
  // the ENTIRE prior AI wiring so everything here is RE-CREATED, not reused). ──
  // The lifecycle's view-state (idle → resolving/loading → review | error).
  const [aiState, setAiState] = useState<AiSuggestionState>({ status: "idle" });
  const [aiDetailsOpen, setAiDetailsOpen] = useState(false);
  const [aiContextReviewOpen, setAiContextReviewOpen] = useState(false);
  const [resolvedForReview, setResolvedForReview] =
    useState<ResolvedPrompt | null>(null);
  // Ephemeral Adjust state: component/session memory only. It never enters the
  // app-settings DAO, personalization DAO, backup, or any durable store.
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustGuidance, setAdjustGuidance] = useState("");
  // AI availability is SOURCED here (COMP-09 / D-07 / D-12): the durable master
  // switch, resolved active connection, exact selected-model usability, and a
  // credential-PRESENCE boolean (never the key value, never logged) feed the
  // pure computeAiAvailability adapter — the screen computes no availability state
  // itself. `credentialFailed` is a session-local lever flipped by an OBSERVED
  // unauthorized generation error (isCredentialFailure) and cleared on a later
  // success, moving availability to needs-attention WITHOUT exposing key material.
  const aiEnabled = useAiConfigStore((state) => state.aiEnabled);
  const configuredActiveLane = useAiConfigStore(
    (state) => state.activeConnection,
  );
  const [activeConnection, setActiveConnection] =
    useState<ResolvedAiConnection | null>(null);
  const [modelAvailable, setModelAvailable] = useState(false);
  const [credentialPresent, setCredentialPresent] = useState(false);
  const [credentialFailed, setCredentialFailed] = useState(false);
  // Latest loaded prompt-template setting, via ref so the lifecycle dependency
  // always reads the current value without re-creating the lifecycle.
  const settingsRef = useRef<AppSettings | null>(null);
  // Safe COUNTS for diagnostics come from the exact closed context projection
  // used by the current request. No contact value or prompt text enters an event.
  const promptContextRef = useRef<PromptContext | null>(null);
  const promptSizeRef = useRef(0);
  // The generation callback reads the exact resolved connection loaded on focus;
  // it never falls back to the legacy singular settings fields.
  const activeConnectionRef = useRef<ResolvedAiConnection | null>(null);
  // The one AiService instance (holds the four provider adapters; refreshed per
  // request from the live settings).
  const serviceRef = useRef<AiService | null>(null);
  if (serviceRef.current === null) {
    serviceRef.current = new AiService();
  }
  // The active model catalog (cache-overrides-seed) — its per-model `limits`
  // supply Anthropic's REQUIRED `max_tokens` (14-11). Seed is the offline default;
  // the cached catalog (if any) is loaded best-effort on focus below.
  const catalogRef = useRef<ModelCatalog>(SEED_CATALOG);
  const openRouterModelsRef = useRef<readonly OpenRouterModel[]>([]);
  // Live focus + mount facts for the lifecycle's stale-guard (isActive).
  const focusedRef = useRef(false);
  const mountedRef = useRef(true);
  // A ref mirror of the editor body so the lifecycle deps (isEditorEmpty /
  // getEditorBody) never read a stale closure over the store value.
  const bodyRef = useRef("");

  // Session draft state (survives nav/background, not relaunch — COMP-07 / D-10).
  const body = useComposeSession((s) => s.body);
  const subject = useComposeSession((s) => s.subject);
  const mode = useComposeSession((s) => s.mode);
  const setBody = useComposeSession((s) => s.setBody);
  const setSubject = useComposeSession((s) => s.setSubject);
  const setMode = useComposeSession((s) => s.setMode);
  const setDestination = useComposeSession((s) => s.setDestination);
  const startSession = useComposeSession((s) => s.startSession);
  const clearSession = useComposeSession((s) => s.clearSession);
  // The session-only Message Focus selection (≤3, aiEligible + non-off-limits only —
  // the store guarantees Off Limits can never enter it), summarised compactly on
  // the Compose side (COMP-11 / COMP-10 display).
  const messageFocus = useComposeSession((s) => s.messageFocus);

  // The launch origin (COMP-14 / HIGH-8). Only the Profile caller passes
  // `'profile'`; dashboard/widget/notification callers omit it and take the
  // default dashboard-reset return.
  const origin = route.params.origin;

  // Default return → Dashboard root. Resets the parent tab tree so this stays
  // correct when Compose was opened from the Orrery stack as well as Dashboard.
  // Also the return whenever the contact is gone (archived/deleted) — a Profile
  // return is meaningless then.
  const resetToDashboard = useCallback(
    () =>
      navigation
        .getParent<NavigationProp<TabParamList>>()
        ?.reset(resetToDashboardRoot()),
    [navigation],
  );

  // Origin-aware return (COMP-14): a Profile-launched Compose pops back to the
  // Profile within WHICHEVER stack hosted it (stack-agnostic goBack — never a
  // hardcoded stack, since ContactProfileScreen lives in both the Dashboard and
  // Orrery stacks), which also removes the finished Compose route from Back
  // history. Every other origin keeps the dashboard reset. Falls back to the
  // dashboard reset if there is nothing to pop to.
  const returnToOrigin = useCallback(() => {
    if (origin === "profile" && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      resetToDashboard();
    }
  }, [origin, navigation, resetToDashboard]);

  // Consume the pure per-path disposition (COMP-14 / D-10) instead of scattering
  // ad-hoc clear/reset calls: clear the session ONLY on a confirmed log, and
  // navigate toward origin for Back + the confirmed log (the latter removing the
  // finished route). transmit-pending / "Not yet" / Copy are no-ops here (stay).
  const performExit = useCallback(
    (exit: ComposeExit) => {
      const disposition = composeExitDisposition(exit);
      if (disposition.clearSession) {
        clearSession(contactId);
      }
      if (disposition.navigatesToOrigin) {
        returnToOrigin();
      }
    },
    [contactId, clearSession, returnToOrigin],
  );

  // Ordinary Back (Button + hardware): preserve the session, return toward origin.
  const onBack = useCallback(() => performExit("back"), [performExit]);

  // Mirror the editor body into a ref so the lifecycle's isEditorEmpty /
  // getEditorBody deps always read the CURRENT body (never a stale closure).
  useEffect(() => {
    bodyRef.current = body;
  }, [body]);

  // Mount fact for the lifecycle stale-guard (focus fact is set in the focus
  // effect). Mounted true by default; flipped false on unmount so a resolving/
  // loading completion after teardown can never mutate the editor.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Observed-unauthorized availability lever (T-35-25): an unauthorized generation
  // result flips the session-local `credentialFailed` flag → availability moves to
  // needs-attention WITHOUT reading or exposing any key material; a later
  // successful generation (review) clears it. Transient codes (timeout /
  // rate_limited / network / …) never flip it, so a flaky moment can't masquerade
  // as a bad key (isCredentialFailure).
  useEffect(() => {
    if (
      aiState.status === "error" &&
      isCredentialFailure(aiState.code as AiErrorCode)
    ) {
      setCredentialFailed(true);
    } else if (aiState.status === "review") {
      setCredentialFailed(false);
    }
  }, [aiState]);

  // Build the ONE lifecycle instance (its deps read the refs above). Created
  // lazily on first render; every dep is INJECTED so the whole flow is the
  // node-tested lifecycle from plan 35-04 — this screen only supplies effects.
  const lifecycleRef = useRef<AiSuggestionLifecycle | null>(null);
  if (lifecycleRef.current === null) {
    lifecycleRef.current = new AiSuggestionLifecycle({
      // Resolve the ONE immutable prompt for this request. For a Rewrite the
      // lifecycle passes the current editor body as `sourceDraft`, which rides the
      // Task-1 bounded/delimited MESSAGE TO REWRITE path — NEVER raw-concatenated.
      // For a Draft `sourceDraft` is undefined and the prompt is byte-identical to
      // today. The closed PromptContext egress projection (readPromptContext) is
      // unchanged; sourceDraft is a resolvePrompt param, not a context field.
      resolvePrompt: async (
        sourceDraft?: string,
        ephemeralAdjustGuidance?: string,
      ): Promise<ResolvedPrompt> => {
        const exec = getExecutor();
        const contactContext = await readPromptContext(exec, contactId);
        // Message Focus never grants permission. Re-read the normalized Research
        // boundary for this request and intersect by stable identity so a
        // permission withdrawn after selection takes effect before egress. Only
        // fresh label/value data survives; stale session content is never sent.
        const currentResearch = await readComposeResearch(exec, contactId);
        const focusedContext = projectMessageFocus(
          useComposeSession.getState().messageFocus,
          currentResearch,
        );
        const writingStyle = await getWritingStyle(exec);
        const personalizationSections = await listPersonalizationSections(exec);
        const completeContext = {
          ...contactContext,
          writingStyle,
          personalizationSections,
          messageFocus: focusedContext,
        };
        const resolved = resolvePrompt(
          "",
          completeContext,
          sourceDraft,
          ephemeralAdjustGuidance,
        );
        promptContextRef.current = completeContext;
        promptSizeRef.current = Array.from(resolved.payload).length;
        return resolved;
      },
      // The provider fan-out (COMP-12 / HIGH-3). Three independently-cancellable
      // calls under the lifecycle's ONE shared signal via generateVariants. The
      // per-call `generateOne` is an ADAPTER over provider.generate (which takes a
      // GenerationInput, not (prompt, signal)) — it BUILDS the GenerationInput and
      // applies a DISTINCT per-variant temperature (variantTemperature) so the
      // three suggestions are deliberately varied. RE-CREATED here (35-01 deleted
      // the prior adapter): refresh providers from the resolved active connection
      // and resolve the per-provider max_tokens from the catalog (dropping it
      // would silently break Anthropic's required max_tokens).
      generate: (prompt, signal): Promise<readonly string[]> => {
        const connection = activeConnectionRef.current;
        const config = useAiConfigStore.getState();
        const service = serviceRef.current;
        if (
          !config.aiEnabled ||
          !connection ||
          config.activeConnection !== connection.lane ||
          !service
        ) {
          throw new AiError("not_configured");
        }
        service.refreshProviders(connection);
        const provider = service.getActiveProvider(connection);
        if (!provider) throw new AiError("not_configured");
        const model = connection.model;
        const openRouterModel = openRouterModelsRef.current.find(
          (candidate) => candidate.id === model,
        );
        const contextWindowTokens =
          connection.lane === "openai" ||
          connection.lane === "anthropic" ||
          connection.lane === "google"
            ? (catalogRef.current.contextWindows?.[connection.lane]?.[model] ??
              null)
            : null;
        // Validate the exact immutable payload and selected catalog row at the
        // final local boundary before any provider egress.
        assertPromptFitsContext({
          prompt: prompt.payload,
          connection: connection.lane,
          model,
          contextWindowTokens,
          openRouterModel,
        });
        // 14-11: only Anthropic sends max_tokens (its API requires one), set to
        // the selected model's OWN catalog maximum; OpenAI/Gemini omit it so the
        // model default applies. Visible length is bounded by AiService's
        // 1,200-code-point post-parse trim, not here.
        const maxOutputTokens = resolveMaxOutputTokens(
          connection.lane,
          model,
          catalogRef.current,
        );
        const generateOne = (
          p: ResolvedPrompt,
          sig: AbortSignal,
          variantIndex: number,
        ): Promise<string> =>
          provider.generate({
            resolvedPrompt: p,
            model,
            temperature: variantTemperature(
              AI_TEMPERATURE_BASE,
              variantIndex,
              AI_VARIANT_COUNT,
            ),
            maxOutputTokens,
            signal: sig,
          });
        return generateVariants(generateOne, prompt, signal, AI_VARIANT_COUNT);
      },
      // Apply a chosen suggestion to the editor — the ONLY editor mutation the AI
      // flow performs (chooseSuggestion is the sole write; ADR-079 T-35-18).
      applyDraft: (text: string): void => {
        bodyRef.current = text;
        setBody(text);
      },
      // Empty editor → Draft (no sourceDraft); non-empty → Rewrite.
      isEditorEmpty: (): boolean => bodyRef.current.trim().length === 0,
      getEditorBody: (): string => bodyRef.current,
      createController: (): AbortController => new AbortController(),
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (handle) =>
        clearTimeout(handle as ReturnType<typeof setTimeout>),
      isActive: (): boolean => focusedRef.current && mountedRef.current,
      // Sanitized code only — never raw provider detail (T-35-03 / T-14-05).
      sanitizeError: (err): string =>
        err instanceof PromptContextOverflowError
          ? "context_too_large"
          : err instanceof AiError
            ? err.code
            : "unknown",
      getFailureDetails: (err, operation, elapsedMs) => {
        const connection = activeConnectionRef.current;
        // A request cannot legitimately reach egress without a resolved
        // connection. The fallback is used only for an earlier resolution error
        // and remains a sanitized lane identifier.
        const lane = connection?.lane ?? "custom";
        const classified = classifyAiFailure(err, lane);
        const context = promptContextRef.current;
        const itemCount = context
          ? context.rankedFuel.length +
            context.sharedFields.length +
            (context.sharedMemories?.length ?? 0) +
            (context.recentInteractions?.length ?? 0)
          : 0;
        const diagnostic = buildAiDiagnostic({
          operation,
          lane,
          modelId: connection?.model ?? "unresolved",
          status: classified.status,
          category: classified.category,
          correlationId: createAiCorrelationId(),
          appBuildVersion: Constants.expoConfig?.version ?? "unknown",
          osVersion: `${Platform.OS} ${String(Platform.Version)}`,
          approxTokenCount: Math.ceil(promptSizeRef.current / 4),
          itemCount,
          elapsedMs,
        });
        return {
          code:
            err instanceof AiError
              ? err.code
              : classified.status === "unknown"
                ? "unknown"
                : String(classified.status),
          category: classified.category,
          message:
            err instanceof PromptContextOverflowError
              ? err.notice.detail
              : failureMessage(classified.category),
          diagnostic,
        };
      },
      onPromptResolved: (prompt): void => setResolvedForReview(prompt),
      onChange: (next): void => setAiState(next),
    });
  }

  // Self-fetch on EVERY focus (first mount AND every return). B1: reset the state
  // machine at the START so a re-focus can't flash the prior SMS result against
  // the fresh pending probe; a `cancelled` flag stops a superseded focus's
  // load/probe overwriting the latest focused state.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      focusedRef.current = true;
      // Whether THIS focus begins a brand-new session (a different contact than
      // the store currently holds). Captured BEFORE startSession so the mode is
      // seeded from the durable preference on a fresh start ONLY — an in-app
      // return to the SAME contact preserves the in-session mode (COMP-02).
      const freshSession = useComposeSession.getState().contactId !== contactId;
      // Begin (or resume) the session for this contact — a no-op for the same
      // contact, so an in-app return preserves the in-progress draft (COMP-07).
      startSession(contactId);
      setScreenState("loading");
      setSmsAvailable(null);
      setResearchCount(0);

      const exec = getExecutor();
      void (async () => {
        try {
          const [row, methodGroups, settings, connection] = await Promise.all([
            getContactHeader(exec, contactId),
            listContactMethodGroups(exec, contactId),
            getAppSettings(exec),
            resolveActiveAiConnection(exec),
            useAiConfigStore.getState().hydrate(exec),
          ]);
          if (cancelled) {
            return;
          }
          // Publish the prompt template and exact active-connection resolution.
          // The pointer is hydrated into the durable store by the same focus read;
          // a dangling pointer deliberately resolves to null.
          settingsRef.current = settings;
          activeConnectionRef.current = connection;
          setActiveConnection(connection);
          const cachedOpenRouterCatalog =
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
                    // Compose only reads the cache. Catalog refresh remains an
                    // explicit/settings-owned operation.
                  },
                })
              : null;
          openRouterModelsRef.current = cachedOpenRouterCatalog?.models ?? [];
          setModelAvailable(
            isSelectedConnectionModelAvailable(
              connection,
              openRouterModelsRef.current,
            ),
          );
          // Best-effort refresh of the active model catalog (cache-overrides-seed)
          // so Anthropic's required max_tokens uses the freshest per-model max.
          // Non-blocking + failure-tolerant — the seed default already works, and
          // this never sits on the render path.
          void loadCachedCatalog(createFileCatalogStorage())
            .then((cached) => {
              if (!cancelled) {
                catalogRef.current = resolveActiveCatalog(cached);
                setModelAvailable(
                  isSelectedConnectionModelAvailable(
                    connection,
                    openRouterModelsRef.current,
                  ),
                );
              }
            })
            .catch(() => undefined);
          // Source AI availability (COMP-09): reset the session-local observed-
          // unauthorized lever, then read the active lane's
          // credential PRESENCE off the key store (presence only, never the value)
          // concurrently so it never blocks header render. readCredentialPresence
          // narrows 'none' out BEFORE any getKey call (A4). Guarded by `cancelled`.
          setCredentialFailed(false);
          void readCredentialPresence(connection?.lane ?? "none", (p) =>
            aiKeyStore.getKey(
              p,
              p === "custom" ? connection?.customEndpoint : undefined,
            ),
          )
            .then((present) => {
              if (!cancelled) setCredentialPresent(present);
            })
            .catch(() => {
              if (!cancelled) setCredentialPresent(false);
            });
          // Resolve the EFFECTIVE actionable primary for BOTH types from the same
          // loaded groups (one read serves resolution AND the picker decision).
          const primaries = selectActionablePrimaryMethods(methodGroups);
          // Seed the session mode from the durable preference on a FRESH session
          // only (COMP-02). effectiveMode resolves the 'remember' sentinel to the
          // last remembered concrete mode; a fixed default is used verbatim. This
          // is a local SQLite read — the render path never blocks on network.
          if (freshSession) {
            setMode(
              effectiveMode(
                settings.defaultMessageMode,
                settings.rememberedMessageMode,
              ),
            );
          }
          // A stale/deleted OR archived contact — exit to the dashboard, never
          // render a Compose surface. Archiving must hide the contact everywhere,
          // so treat archived exactly like missing.
          if (row === null || row.archived_at !== null) {
            setScreenState("missing");
            resetToDashboard();
            return;
          }
          setHeader({
            id: row.id,
            name: row.name,
            photo: row.photo,
            modified_at: row.modified_at,
            archived_at: row.archived_at,
            actionablePhone: actionablePrimaryPhoneDestination(primaries.phone),
            actionableEmail: actionablePrimaryPhoneDestination(primaries.email),
            methodGroups,
          });
          setScreenState("ready");
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

      // Populated Things-to-Remember Research count (COMP-08) — SEPARATE from the
      // header load and non-blocking, so a slow/failed read never gates the editor.
      // The count reflects the same normalized projection the Research side renders;
      // the cancelled guard prevents a stale focus's read overwriting the current.
      readComposeResearch(exec, contactId)
        .then((rows) => {
          if (!cancelled) {
            setResearchCount(rows.length);
          }
        })
        .catch((err) => {
          Logger.error(LOG_SCOPE, "failed to load research count", err);
          if (!cancelled) {
            setResearchCount(0);
          }
        });

      // SMS capability probe — SEPARATE from the header load so a rejected probe
      // degrades to `false` WITHOUT failing the contact load. The cancelled guard
      // prevents a slow prior-focus probe clobbering the fresh `null`.
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
        // Blur / contactId change / unmount — drop the focus fact and dispose the
        // lifecycle so an in-flight resolving/loading request is aborted and the
        // AI view-state can never be stranded (or mutate the editor after teardown).
        focusedRef.current = false;
        lifecycleRef.current?.dispose();
      };
    }, [contactId, resetToDashboard, startSession, setMode]),
  );

  // Android hardware/system Back → origin-aware return (consume the event so
  // native-stack doesn't do its own uncontrolled pop). Registered while focused.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        onBack();
        return true;
      });
      return () => sub.remove();
    }, [onBack]),
  );

  // Clear a pending "Message copied" timer on unmount (no setState after teardown).
  useEffect(() => {
    return () => {
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
        copyTimer.current = null;
      }
    };
  }, []);

  // Flash a transient copy confirmation for ~2s (single setState + setTimeout;
  // never a per-frame animation, per CLAUDE.md). Shared by the body Copy and the
  // Subject copy affordance.
  const flashCopyFeedback = useCallback((message: string) => {
    if (copyTimer.current) {
      clearTimeout(copyTimer.current);
    }
    setCopyFeedback(message);
    copyTimer.current = setTimeout(() => {
      setCopyFeedback(null);
      copyTimer.current = null;
    }, 2000);
  }, []);

  // Re-read the contact's method groups after a primary swap so the picker
  // condition and resolved destinations reflect the new explicit primary without
  // a full navigation round-trip. Local SQLite read; no network on this path.
  const refreshMethods = useCallback(async () => {
    const exec = getExecutor();
    const methodGroups = await listContactMethodGroups(exec, contactId);
    const primaries = selectActionablePrimaryMethods(methodGroups);
    setHeader((prev) =>
      prev === null
        ? prev
        : {
            ...prev,
            actionablePhone: actionablePrimaryPhoneDestination(primaries.phone),
            actionableEmail: actionablePrimaryPhoneDestination(primaries.email),
            methodGroups,
          },
    );
  }, [contactId]);

  // A DELIBERATE picker selection establishes the canonical primary for the
  // active mode via the single-method writer setContactMethodPrimary (plan
  // 35-03) — NEVER applyContactMethodDiff. Records the chosen endpoint in the
  // session store and refreshes the resolved methods (COMP-03, T-35-17).
  const onChoosePrimary = useCallback(
    async (methodType: ContactMethodType, method: ContactMethodRow) => {
      try {
        const exec = getExecutor();
        await setContactMethodPrimary(exec, {
          contactId,
          methodId: method.id,
          methodType,
          now: localDateTime(),
        });
        setDestination(method.canonical_value);
        await refreshMethods();
      } catch (err) {
        Logger.error(LOG_SCOPE, "failed to set primary method", err);
        Alert.alert("Couldn't set that", "Please try again.");
      }
    },
    [contactId, setDestination, refreshMethods],
  );

  // Advance the durable "remembered" compose mode — persisted ONLY on a commit
  // (a successful Transmit or Copy), NEVER on an ad-hoc in-session switch
  // (COMP-02). nextRememberedMode(current, adHoc, committed=true) returns the
  // ad-hoc (session) mode; we write it only when it actually changed. The local
  // SQLite write is wrapped so a persistence failure never breaks the commit.
  // Declared ABOVE its Transmit/Copy callers so no forward reference exists.
  const persistRememberedMode = useCallback(async () => {
    try {
      const exec = getExecutor();
      const settings = await getAppSettings(exec);
      const next = nextRememberedMode(
        settings.rememberedMessageMode,
        mode,
        true,
      );
      if (next !== settings.rememberedMessageMode) {
        await updateAppSettings(
          exec,
          { rememberedMessageMode: next },
          localDateTime(),
        );
      }
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to persist remembered mode", err);
    }
  }, [mode]);

  // Ad-hoc per-session mode switch (COMP-02). Flips the session mode ONLY — it
  // must NOT write the durable preference (that advances on a commit via
  // persistRememberedMode). 'Make this an email' in Text, 'Make this a text' in
  // Email.
  const onSwitchMode = useCallback(() => {
    setMode(mode === "email" ? "text" : "email");
  }, [mode, setMode]);

  // The single adaptive AI action (COMP-12 / D-09). A DELIBERATE invocation only —
  // begin() is NEVER called from a focus/mount effect, so AI never auto-starts on
  // open and never auto-writes. Empty editor → Draft, non-empty → Rewrite; the
  // lifecycle decides via the injected isEditorEmpty and carries the body as the
  // bounded sourceDraft on Rewrite.
  const onAiAction = useCallback(() => {
    setAiDetailsOpen(false);
    setAiContextReviewOpen(false);
    setResolvedForReview(null);
    void lifecycleRef.current?.begin();
  }, []);

  // Cancel an in-flight generation (Cancel on the pending/review surface) — aborts
  // the lifecycle's sole controller and returns to idle, leaving the manual draft
  // untouched (COMP-13, failure-safe).
  const onAiCancel = useCallback(() => {
    setAiDetailsOpen(false);
    setAiContextReviewOpen(false);
    setResolvedForReview(null);
    lifecycleRef.current?.cancel();
  }, []);

  // Try Again — a fresh begin() that REPLACES the whole suggestion set (never an
  // automatic retry; ADR-079 §S).
  const onAiRetry = useCallback(() => {
    setAiContextReviewOpen(false);
    setResolvedForReview(null);
    void lifecycleRef.current?.retry();
  }, []);

  // Choose this — apply exactly one reviewed suggestion to the editor. This is the
  // ONLY path that mutates the editor from the AI flow (ADR-079 / T-35-18).
  const onAiChoose = useCallback((index: number) => {
    lifecycleRef.current?.chooseSuggestion(index);
  }, []);

  // Adjust is a deliberate, per-generation action. The lifecycle reuses the
  // same three-variant fan-out and the current editor body as continuity source.
  const onAiAdjust = useCallback((guidance: string) => {
    const normalized = guidance.trim();
    if (normalized.length === 0) return;
    setAdjustGuidance(normalized);
    setAdjustOpen(false);
    void lifecycleRef.current?.adjust(normalized);
  }, []);

  // Needs-Attention repair route — send the user to the EXISTING AI settings
  // surface (interim per D-12). Compose is never a provider-troubleshooting screen.
  const onOpenAiSettings = useCallback(() => {
    navigation
      .getParent<NavigationProp<TabParamList>>()
      ?.navigate("SettingsTab", { screen: "AIConnection" });
  }, [navigation]);

  // Transmit — in-flight latched (A3). Returns early while a handoff is open and
  // when no destination resolves. The channel + endpoint derive from the USABLE
  // mode (resolveUsableMode: preferred-then-fallback), never a literal or the raw
  // session mode — so an email-mode draft with no email falls back to the phone
  // handoff. CONSUMES the handoff outcome so the confirmation panel logs the
  // EXACT assist.
  const onTransmit = useCallback(async () => {
    if (sending || header === null) {
      return;
    }
    const usable = resolveUsableMode(
      mode,
      header.actionablePhone != null,
      header.actionableEmail != null,
    );
    const endpoint =
      usable === "email"
        ? header.actionableEmail
        : usable === "text"
          ? header.actionablePhone
          : null;
    if (usable === null || endpoint === null) {
      return;
    }
    setSending(true);
    try {
      const exec = getExecutor();
      const settings = await getAppSettings(exec);
      // Record the destination actually used in the session store (D-10).
      setDestination(endpoint);
      const outcome = await performReachOut(exec, {
        contactId,
        channel: usable,
        endpoint,
        assistEnabled: settings.interactionAssistEnabled === 1,
        now: localDateTime(),
        messageBody: body,
        // Carried into the mailto Subject on the email arm only; the text/call
        // arms ignore it (handoff.ts).
        subject: usable === "email" ? subject : undefined,
      });
      // Show the additive confirmation ONLY for a started handoff that created an
      // assist. A failed launch (handoffStarted false) or opted-out assists
      // (assistUid null) show nothing and attempt no re-query.
      if (outcome.handoffStarted && outcome.assistUid !== null) {
        setConfirm({ assistUid: outcome.assistUid });
      }
      // A started handoff is a commit — advance the remembered mode (COMP-02).
      if (outcome.handoffStarted) {
        await persistRememberedMode();
      }
    } catch (err) {
      // performReachOut runs createPendingAssist OUTSIDE its own try/catch, and
      // getAppSettings/persistRememberedMode can throw too — without this catch a
      // failure here is a silent unhandled rejection with no user feedback (WR-02).
      // Surface it like the sibling onCopy/launchMethod handlers rather than
      // swallowing it; the finally still releases the sending latch.
      Logger.error(LOG_SCOPE, "failed to transmit draft", err);
      Alert.alert("Couldn't send", "Please try again.");
    } finally {
      setSending(false);
    }
  }, [
    sending,
    header,
    contactId,
    mode,
    body,
    subject,
    setDestination,
    persistRememberedMode,
  ]);

  // Copy — the guaranteed handoff, NEVER gated by `sending`, NEVER opens the
  // confirmation panel. Copies the BODY only in any mode (resolveCopyTargets.body,
  // never inlined here); on success shows a transient "Message copied" for ~2s.
  const onCopy = useCallback(async () => {
    try {
      const targets = resolveCopyTargets(mode, body, subject);
      await Clipboard.setStringAsync(targets.body);
      flashCopyFeedback("Message copied");
      // Copy is a commit — advance the remembered mode (COMP-02).
      await persistRememberedMode();
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to copy draft", err);
      Alert.alert("Couldn't copy", "Please try again.");
    }
  }, [mode, body, subject, flashCopyFeedback, persistRememberedMode]);

  // Subject copy — the separate lightweight affordance (Email mode only). Copies
  // the SUBJECT only (resolveCopyTargets.subject, null in Text so it no-ops);
  // shows "Subject copied". It is NOT the main Copy commit, so it does not
  // advance the remembered mode.
  const onCopySubject = useCallback(async () => {
    const targets = resolveCopyTargets(mode, body, subject);
    if (targets.subject === null) {
      return;
    }
    try {
      await Clipboard.setStringAsync(targets.subject);
      flashCopyFeedback("Subject copied");
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to copy subject", err);
      Alert.alert("Couldn't copy", "Please try again.");
    }
  }, [mode, body, subject, flashCopyFeedback]);

  // "Yes, log interaction" — log THIS assist through the sole recency writer at
  // its handoff_at (markAssistLogged reused UNCHANGED, D-06). connected=1 matches
  // the app-global text/email confirmation (its only affirmative is confirm(1)).
  // Latched so a re-tap during the write cannot double-log (T-35-05). On success,
  // this is the ONLY "finished" exit (COMP-14 / D-10): the disposition helper
  // clears the session and returns toward origin, removing the finished Compose
  // route from Back history so the sent draft can't resurrect (T-35-20).
  const onConfirmYes = useCallback(async () => {
    if (logging || confirm === null) {
      return;
    }
    setLogging(true);
    try {
      await markAssistLogged(getExecutor(), {
        assistUid: confirm.assistUid,
        connected: 1,
        now: localDateTime(),
      });
      setConfirm(null);
      performExit("logged");
    } catch (err) {
      // The assist row persists (stamped at handoff_at); the app-global banner +
      // pending sheet still offer logging later — no lost state, no false success.
      // Keep the panel open so the user can retry without a re-query.
      Logger.error(LOG_SCOPE, "failed to log interaction", err);
      Alert.alert(
        "Couldn't log that yet",
        "The reminder is saved — you can log it from the banner.",
      );
    } finally {
      setLogging(false);
    }
  }, [logging, confirm, performExit]);

  // "Not yet" — close ONLY the local panel and leave the durable assist row
  // PENDING (D-05). Do NOT call markAssistDismissed; the durable "Don't log" path
  // stays on the app-global PendingConfirmationsSheet.
  const onConfirmNotYet = useCallback(() => {
    setConfirm(null);
  }, []);

  // ---- Render --------------------------------------------------------------

  const backControl = (
    <ChromeScrim style={styles.backScrim} radius={RADII.sm}>
      <Button
        testID="compose-back"
        role="tertiary"
        label="Back"
        accessibilityLabel="Back"
        onPress={onBack}
      />
    </ChromeScrim>
  );

  // "loading" shows minimal chrome + Back; "error" shows Back after its Alert;
  // "missing" has already navigated home (render nothing meaningful).
  if (screenState !== "ready" || header === null) {
    return (
      <ScrollView
        testID="compose-screen"
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>{backControl}</View>
      </ScrollView>
    );
  }

  // "ready" — derive the controls (A1) through the pure resolver UNCONDITIONALLY.
  // The resolver owns the interim (smsAvailable === null, probe pending) case, so
  // no capability arithmetic is re-derived inline here.
  const hasPhone = header.actionablePhone != null;
  const hasEmail = header.actionableEmail != null;
  const controls: ComposeControls = resolveComposeControls(
    hasPhone,
    smsAvailable,
    mode,
    hasEmail,
  );
  const copyPrimary = controls.copyEmphasis === "primary";

  // Adaptive AI action copy (COMP-12 / D-09): Draft on an empty editor, Rewrite
  // when it holds meaningful text. Emptiness drives the injected isEditorEmpty too.
  const aiActionLabel =
    body.trim().length === 0 ? "Draft with AI" : "Rewrite with AI";
  // A non-empty editor at review time means this was a Rewrite (the editor is
  // untouched until Choose this), so the review surface shows the original + a
  // keep-the-original path.
  const aiIsRewrite = body.trim().length > 0;

  // Three-state AI availability (COMP-09 / D-07 / D-12) — CONSUMED from the pure
  // adapter; the screen computes no availability state itself. Off → no AI
  // affordance; Ready → the actions; Needs-Attention → a restrained repair notice
  // that REPLACES (never hides) the actions. `credentialFailed` folds an observed
  // unauthorized into needs-attention without exposing key material.
  const aiAvailability: AiAvailability = computeAiAvailability({
    aiEnabled,
    activeConnection:
      activeConnection?.lane === configuredActiveLane
        ? activeConnection.lane
        : null,
    hasCredential: credentialPresent && !credentialFailed,
    selectedModel: activeConnection?.model ?? "",
    modelAvailable,
  });
  const aiPosture = selectAiAffordance(aiAvailability);

  // The mode actually usable after preferred-then-fallback drives which type the
  // establish-primary picker targets (COMP-03).
  const usable = resolveUsableMode(mode, hasPhone, hasEmail);
  const pickerType: ContactMethodType | null =
    usable === "email" ? "email" : usable === "text" ? "phone" : null;
  const pickerCandidates =
    pickerType === null
      ? []
      : header.methodGroups[pickerType].filter((m) => m.is_actionable === 1);
  const hasExplicitPrimary =
    pickerType !== null &&
    header.methodGroups[pickerType].some(
      (m) => m.is_primary === 1 && m.is_actionable === 1,
    );
  // Show the picker ONLY with ≥2 actionable candidates AND no explicit stored
  // primary in the active mode (MEDIUM). A single method or an explicit primary
  // resolves without one; Transmit stays usable either way (first-actionable
  // fallback), so the picker is an additive establish affordance, never a gate.
  const showPicker = pickerCandidates.length >= 2 && !hasExplicitPrimary;

  return (
    <ScrollView testID="compose-screen" contentContainerStyle={styles.content}>
      {/* Header row: Back, Avatar, contact name (heading). */}
      <View style={styles.header}>
        {backControl}
        <Avatar
          photo={header.photo}
          name={header.name}
          contactId={contactId}
          cacheBust={header.modified_at}
          size={64}
        />
        <ChromeScrim style={styles.nameScrim} radius={RADII.sm}>
          <AppText
            testID="compose-name"
            role="heading"
            accessibilityRole="header"
          >
            {header.name}
          </AppText>
        </ChromeScrim>
      </View>

      {/* Email Subject field (COMP-04) — rendered only in Email mode, above the
          Body. Bound to the session store `subject`/`setSubject` (owned by plan
          35-01), so it survives nav/background exactly like the body. Its own
          lightweight Copy affordance copies the Subject only. */}
      {mode === "email" ? (
        <View testID="compose-subject" style={styles.section}>
          <ChromeScrim style={styles.labelScrim} radius={RADII.sm}>
            <AppText role="label">Subject</AppText>
          </ChromeScrim>
          <TextInput
            testID="compose-subject-input"
            value={subject}
            onChangeText={setSubject}
            placeholder="Subject"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.subjectInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
                fontSize: TYPOGRAPHY.body.size,
                lineHeight: TYPOGRAPHY.body.lineHeight,
                fontFamily: "Inter-Regular",
              },
            ]}
          />
          <View style={styles.affordance}>
            <Button
              testID="compose-copy-subject"
              role="tertiary"
              label="Copy subject"
              accessibilityLabel="Copy subject"
              onPress={() => void onCopySubject()}
            />
          </View>
        </View>
      ) : null}

      {/* Editor-first: the BLANK multiline body editor is the primary surface. */}
      <View testID="compose-draft" style={styles.section}>
        <ChromeScrim style={styles.labelScrim} radius={RADII.sm}>
          <AppText role="label">Your message</AppText>
        </ChromeScrim>
        <TextInput
          testID="compose-draft-input"
          value={body}
          onChangeText={setBody}
          multiline
          placeholder="Write your message…"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.draftInput,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.textPrimary,
              // Token-driven body typography (16/24) — not a raw literal; AppText
              // cannot wrap a TextInput, so the role's tokens are applied here.
              fontSize: TYPOGRAPHY.body.size,
              lineHeight: TYPOGRAPHY.body.lineHeight,
              fontFamily: "Inter-Regular",
            },
          ]}
        />
      </View>

      {/* Ad-hoc mode switch (COMP-02) — flips the session mode ONLY (never the
          durable preference), tertiary accentText link tone. */}
      <View style={styles.affordance}>
        <Button
          testID="compose-mode-switch"
          role="tertiary"
          label={mode === "email" ? "Make this a text" : "Make this an email"}
          accessibilityLabel={
            mode === "email" ? "Make this a text" : "Make this an email"
          }
          onPress={onSwitchMode}
        />
      </View>

      {/* Things to Remember Research entry (COMP-08) — a tertiary accentText link to
          the sibling full-screen Research side, carrying the populated count. The
          navigate PRESERVES the compose session (no startSession/clear here), so the
          draft, mode, Subject, and Message Focus survive the Compose↔Research
          transition (COMP-07 / D-10). Shown only when there is populated knowledge. */}
      {researchCount > 0 ? (
        <View style={styles.affordance}>
          <Button
            testID="compose-research-entry"
            role="tertiary"
            label={`Things to Remember · ${researchCount}`}
            accessibilityLabel={`Things to Remember, ${researchCount} items`}
            onPress={() =>
              navigation.navigate("ComposeResearch", { contactId })
            }
          />
        </View>
      ) : null}

      {/* Compact Message Focus summary (COMP-11) — reflects the ≤3 session-only
          selection the human toggled Add to AI on the Research side. HIDDEN when
          empty. Off Limits can never appear here: the store only ever holds
          aiEligible, non-off-limits items (COMP-10 display / T-35-16). */}
      {messageFocus.length > 0 ? (
        <ChromeScrim style={styles.labelScrim} radius={RADII.sm}>
          <AppText testID="compose-message-focus" role="label">
            {`Message focus · ${messageFocus.length}`}
          </AppText>
        </ChromeScrim>
      ) : null}

      {/* Adaptive AI action (COMP-12 / D-09) — a single primary action that reads
          'Draft with AI' on an empty editor and 'Rewrite with AI' when it holds
          meaningful text. Rendered only when AI is configured and nothing is in
          flight (idle). It NEVER auto-starts; begin() runs only on this tap. */}
      {aiState.status === "idle" && aiPosture.showAiActions ? (
        <>
          <View style={styles.affordance}>
            <Button
              testID="compose-ai-action"
              role="primary"
              label={aiActionLabel}
              accessibilityLabel={aiActionLabel}
              onPress={onAiAction}
            />
          </View>
          {body.trim().length > 0 ? (
            <View style={styles.affordance}>
              <Button
                testID="compose-ai-adjust-open"
                role="tertiary"
                label="Adjust"
                accessibilityLabel="Adjust this message with AI"
                onPress={() => setAdjustOpen((open) => !open)}
              />
            </View>
          ) : null}
        </>
      ) : null}

      {aiState.status === "idle" && aiPosture.showAiActions && adjustOpen ? (
        <View
          testID="compose-ai-adjust"
          style={[
            styles.panel,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <AppText role="label">Adjust this message</AppText>
          <View style={styles.panelActions}>
            {AI_ADJUST_QUICK_ACTIONS.map((guidance) => (
              <Button
                key={guidance}
                testID={`compose-ai-adjust-${guidance.toLowerCase().replace(/\s+/g, "-")}`}
                role="secondary"
                label={guidance}
                accessibilityLabel={`Adjust: ${guidance}`}
                onPress={() => onAiAdjust(guidance)}
              />
            ))}
          </View>
          <TextInput
            testID="compose-ai-adjust-input"
            value={adjustGuidance}
            onChangeText={setAdjustGuidance}
            placeholder="Tell Orbit what to change…"
            placeholderTextColor={colors.textSecondary}
            multiline
            style={[
              styles.adjustInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
                fontSize: TYPOGRAPHY.body.size,
                lineHeight: TYPOGRAPHY.body.lineHeight,
                fontFamily: "Inter-Regular",
              },
            ]}
          />
          <View style={styles.panelActions}>
            <Button
              testID="compose-ai-adjust-cancel"
              role="secondary"
              label="Cancel"
              accessibilityLabel="Cancel adjustment"
              onPress={() => setAdjustOpen(false)}
            />
            <Button
              testID="compose-ai-adjust-apply"
              role="primary"
              label="Generate alternatives"
              accessibilityLabel="Generate adjusted alternatives"
              disabled={adjustGuidance.trim().length === 0}
              onPress={() => onAiAdjust(adjustGuidance)}
            />
          </View>
        </View>
      ) : null}

      {/* AI Needs Attention (COMP-09 / D-07 / D-12) — a restrained repair notice
          that REPLACES the AI actions (never silently hides them, never restores
          Draft/Rewrite). Caption/label tone on `surface`, no accent CTA styling;
          routes to the EXISTING AI settings surface as an interim. Manual
          composition + Research stay fully usable (rendered unconditionally). */}
      {aiState.status === "idle" && aiPosture.repairNotice ? (
        <View
          testID="compose-ai-needs-attention"
          style={[
            styles.panel,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <AppText role="label">AI needs attention</AppText>
          <AppText role="caption">
            Your AI provider needs attention before Draft or Rewrite can run.
            Open AI settings to sort it out.
          </AppText>
          <View style={styles.affordance}>
            <Button
              testID="compose-ai-open-settings"
              role="tertiary"
              label="Open AI settings"
              accessibilityLabel="Open AI settings"
              onPress={onOpenAiSettings}
            />
          </View>
        </View>
      ) : null}

      {/* Non-destructive pending placeholder (COMP-13) — while the three
          suggestions generate, the editor is UNTOUCHED and Cancel is available.
          Exact skeleton styling is device-tuning (backstop); this is the failure-
          safe backstop that never mutates the manual draft. */}
      {aiState.status === "resolving" || aiState.status === "loading" ? (
        <View
          testID="compose-ai-pending"
          style={[
            styles.panel,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <AppText role="body">Drafting a few options…</AppText>
          <View style={styles.panelActions}>
            <Button
              testID="compose-ai-pending-cancel"
              role="secondary"
              label="Cancel"
              accessibilityLabel="Cancel"
              onPress={onAiCancel}
            />
          </View>
        </View>
      ) : null}

      {/* Non-destructive three-suggestion review surface (ADR-079 / COMP-12).
          Exactly three unlabeled suggestions at body size (16/24, no shrink); each
          has a 'Choose this' primary — the ONLY editor mutation. 'Try Again'
          replaces the whole set; 'Cancel' dismisses without mutating. For a
          Rewrite (the editor held text at invocation, still untouched here) the
          original is shown with a clear keep-the-original path. */}
      {aiState.status === "review" ? (
        <View
          testID="compose-ai-review"
          style={[
            styles.panel,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <AppText role="heading">
            {aiIsRewrite ? "Rewrite suggestions" : "Draft suggestions"}
          </AppText>

          {aiIsRewrite ? (
            <View testID="compose-ai-original" style={styles.section}>
              <ChromeScrim style={styles.labelScrim} radius={RADII.sm}>
                <AppText role="label">Your original</AppText>
              </ChromeScrim>
              <ScrollView
                style={[styles.aiSuggestionBox, { borderColor: colors.border }]}
                nestedScrollEnabled
              >
                <AppText role="body">{body}</AppText>
              </ScrollView>
              <View style={styles.affordance}>
                <Button
                  testID="compose-ai-keep-original"
                  role="secondary"
                  label="Keep the original"
                  accessibilityLabel="Keep the original"
                  onPress={onAiCancel}
                />
              </View>
            </View>
          ) : null}

          {aiState.suggestions.map((suggestion, index) => (
            <View
              // Suggestions are unlabeled and may repeat text; index is the stable
              // identity within this immutable set (replaced wholesale on retry).
              // biome-ignore lint/suspicious/noArrayIndexKey: stable within the set
              key={index}
              testID={`compose-ai-suggestion-${index}`}
              style={styles.section}
            >
              <ScrollView
                style={[styles.aiSuggestionBox, { borderColor: colors.border }]}
                nestedScrollEnabled
              >
                <AppText role="body">{suggestion}</AppText>
              </ScrollView>
              <View style={styles.affordance}>
                <Button
                  testID={`compose-ai-choose-${index}`}
                  role="primary"
                  label="Choose this"
                  accessibilityLabel="Choose this suggestion"
                  onPress={() => onAiChoose(index)}
                />
              </View>
            </View>
          ))}

          <View style={styles.panelActions}>
            <Button
              testID="compose-ai-cancel"
              role="secondary"
              label="Cancel"
              accessibilityLabel="Cancel"
              onPress={onAiCancel}
            />
            <Button
              testID="compose-ai-try-again"
              role="tertiary"
              label="Try Again"
              accessibilityLabel="Try Again"
              onPress={onAiRetry}
            />
          </View>
        </View>
      ) : null}

      {/* Failure-safe AI error surface (COMP-13) — the manual draft is preserved
          (this never touches the editor); a SANITIZED code maps to a short line
          (never raw provider text), with Try Again / Cancel. Never a provider-
          troubleshooting screen. */}
      {aiState.status === "error" ? (
        <View
          testID="compose-ai-error"
          style={[
            styles.panel,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <AppText testID="compose-ai-error-text" role="body">
            {aiState.message ?? aiErrorText(aiState.code)}
          </AppText>
          {aiState.diagnostic ? (
            <View style={styles.affordance}>
              <Button
                testID="compose-ai-error-details-toggle"
                role="tertiary"
                label={aiDetailsOpen ? "Hide details" : "Details"}
                accessibilityLabel={
                  aiDetailsOpen
                    ? "Hide AI failure details"
                    : "Show AI failure details"
                }
                onPress={() => setAiDetailsOpen((open) => !open)}
              />
            </View>
          ) : null}
          {aiDetailsOpen && aiState.diagnostic ? (
            <View testID="compose-ai-error-details" style={styles.section}>
              <AppText role="caption">
                {[
                  `Operation: ${aiState.diagnostic.operation}`,
                  `Lane: ${aiState.diagnostic.lane}`,
                  `Model: ${aiState.diagnostic.modelId}`,
                  `Status: ${String(aiState.diagnostic.status)}`,
                  `Category: ${aiState.diagnostic.category}`,
                  `Correlation: ${aiState.diagnostic.correlationId}`,
                  `Build: ${aiState.diagnostic.appBuildVersion}`,
                  `OS: ${aiState.diagnostic.osVersion}`,
                  `Approx. tokens: ${aiState.diagnostic.approxTokenCount}`,
                  `Shared items: ${aiState.diagnostic.itemCount}`,
                  `Elapsed: ${aiState.diagnostic.elapsedMs} ms`,
                ].join("\n")}
              </AppText>
            </View>
          ) : null}
          <View style={styles.panelActions}>
            <Button
              testID="compose-ai-error-cancel"
              role="secondary"
              label="Cancel"
              accessibilityLabel="Cancel"
              onPress={onAiCancel}
            />
            <Button
              testID="compose-ai-error-try-again"
              role="tertiary"
              label="Try Again"
              accessibilityLabel="Try Again"
              onPress={onAiRetry}
            />
          </View>
        </View>
      ) : null}

      {aiState.status !== "idle" &&
      resolvedForReview !== null &&
      promptContextRef.current !== null ? (
        <View style={styles.affordance}>
          <Button
            testID="compose-ai-context-review-open"
            role="tertiary"
            label="Review what is shared"
            accessibilityLabel="Review contact information shared with AI"
            onPress={() => setAiContextReviewOpen(true)}
          />
          <AIComposeContextReview
            visible={aiContextReviewOpen}
            resolved={resolvedForReview}
            context={promptContextRef.current}
            onDismiss={() => setAiContextReviewOpen(false)}
          />
        </View>
      ) : null}

      {/* SMS-unavailable helper (phone present, device can't text). */}
      {controls.smsUnavailableHelper ? (
        <ChromeScrim style={styles.labelScrim} radius={RADII.sm}>
          <AppText testID="compose-sms-helper" role="caption">
            This device can't send texts — copy your message instead.
          </AppText>
        </ChromeScrim>
      ) : null}

      {/* No-destination state (COMP-03): NEITHER phone nor email actionable.
          Transmit is unavailable but this is a usable degraded state — Copy stays
          the sole primary and an accessible explanation + establish-a-primary
          route are offered. Never a blocking error (T-35-11). */}
      {controls.addNumber ? (
        <>
          <ChromeScrim style={styles.labelScrim} radius={RADII.sm}>
            <AppText testID="compose-no-destination" role="caption">
              No phone number or email — copy your message instead.
            </AppText>
          </ChromeScrim>
          <View style={styles.affordance}>
            <Button
              testID="compose-add-number"
              role="tertiary"
              label="Add a phone number or email"
              accessibilityLabel="Add a phone number or email"
              onPress={() => navigation.navigate("Edit", { contactId })}
            />
          </View>
        </>
      ) : null}

      {/* Establish-primary picker (COMP-03): multiple actionable destinations for
          the active mode with no explicit stored primary — ask which becomes the
          canonical one. The pick calls setContactMethodPrimary. Long values
          truncate in the row; the FULL value is applied on selection. */}
      {showPicker && pickerType !== null ? (
        <View testID="compose-primary-picker" style={styles.section}>
          <ChromeScrim style={styles.labelScrim} radius={RADII.sm}>
            <AppText role="label">
              {pickerType === "email"
                ? "Which email should Orbit use?"
                : "Which number should Orbit use?"}
            </AppText>
          </ChromeScrim>
          {pickerCandidates.map((method) => (
            <View key={method.id} style={styles.affordance}>
              <Button
                testID={`compose-primary-option-${method.id}`}
                role="tertiary"
                label={truncateMethodValue(method.display_value)}
                accessibilityLabel={`Use ${method.display_value}`}
                onPress={() => void onChoosePrimary(pickerType, method)}
              />
            </View>
          ))}
        </View>
      ) : null}

      {/* Additive "Did you send it?" panel — shown ONLY for a started handoff that
          created an assist. Yes logs THIS assist at handoff_at; Not yet closes the
          panel and leaves the assist PENDING (the app-global banner keeps it). */}
      {confirm !== null ? (
        <View
          testID="compose-confirm"
          style={[
            styles.panel,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <AppText role="heading">Did you send it?</AppText>
          <View style={styles.panelActions}>
            <Button
              testID="compose-confirm-not-yet"
              role="secondary"
              label="Not yet"
              accessibilityLabel="Not yet"
              onPress={onConfirmNotYet}
            />
            <Button
              testID="compose-confirm-yes"
              role="primary"
              label="Yes, log interaction"
              accessibilityLabel="Yes, log interaction"
              disabled={logging}
              onPress={() => void onConfirmYes()}
            />
          </View>
        </View>
      ) : null}

      {/* Action row. */}
      <View style={styles.actions}>
        {copyFeedback !== null ? (
          <AppText testID="compose-copied" role="caption">
            {copyFeedback}
          </AppText>
        ) : null}

        {/* Copy — always present; primary (accent fill) when it is the sole
            primary, else secondary. NEVER gated by `sending`. */}
        <Button
          testID="compose-copy"
          role={copyPrimary ? "primary" : "secondary"}
          label="Copy"
          accessibilityLabel="Copy"
          onPress={() => void onCopy()}
        />

        {/* Transmit — only when a phone + SMS capability exist. In-flight latched. */}
        {controls.send === "shown" ? (
          <Button
            testID="compose-transmit"
            role="primary"
            label="Transmit"
            accessibilityLabel="Transmit"
            disabled={sending}
            onPress={() => void onTransmit()}
          />
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
  backScrim: {
    alignSelf: "flex-start",
    overflow: "hidden",
  },
  nameScrim: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  section: {
    gap: 8,
  },
  labelScrim: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
  draftInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 120,
    textAlignVertical: "top",
  },
  subjectInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  adjustInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 88,
    textAlignVertical: "top",
  },
  // A bounded box so a long suggestion (or the original) scrolls WITHIN the
  // review surface while staying individually selectable (no shrink — body 16/24).
  aiSuggestionBox: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxHeight: 160,
  },
  affordance: {
    alignSelf: "flex-start",
  },
  panel: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  panelActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
    alignItems: "center",
    flexWrap: "wrap",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
    alignItems: "center",
    flexWrap: "wrap",
  },
});
