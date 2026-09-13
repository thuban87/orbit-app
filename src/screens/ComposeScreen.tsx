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
import * as SMS from "expo-sms";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Avatar } from "@/components/Avatar";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { ChromeScrim } from "@/components/ui/ChromeScrim";
import { getAppSettings } from "@/db/app-settings-dao";
import { listActionablePrimaryMethods } from "@/db/contact-methods-read";
import { getContactHeader } from "@/db/contact-read";
import { getExecutor, localDateTime } from "@/db/database";
import { markAssistLogged } from "@/db/interaction-assist-dao";
import {
  actionablePrimaryPhoneDestination,
  type ComposeControls,
  resolveComposeControls,
} from "@/logic/compose-logic";
import { resetToDashboardRoot } from "@/navigation/reset-intents";
import type { RootStackScreenProps, TabParamList } from "@/navigation/types";
import { performReachOut } from "@/services/reach-out/handoff";
import { useComposeSession } from "@/stores/compose-session-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { TYPOGRAPHY } from "@/theme/tokens/typography";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "compose";

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
  /** DAO-selected actionable primary destination, or null when none is actionable. */
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
  // "unavailable" until it settles to a concrete boolean (A1, no-flash).
  const [smsAvailable, setSmsAvailable] = useState<boolean | null>(null);
  const [header, setHeader] = useState<Header | null>(null);
  // In-flight latch for Transmit (A3) — a rapid double-tap cannot launch two
  // composers. Copy is NEVER gated by this.
  const [sending, setSending] = useState(false);
  // Transient "Message copied" confirmation via a single setState + setTimeout
  // (NOT a per-frame animation, per CLAUDE.md).
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The additive "Did you send it?" panel — non-null (carrying the assist UID to
  // log) ONLY after a started handoff that created an assist. `logging` latches
  // the "Yes" write so a double-tap cannot double-log (T-35-05).
  const [confirm, setConfirm] = useState<{ assistUid: string } | null>(null);
  const [logging, setLogging] = useState(false);

  // Session draft state (survives nav/background, not relaunch — COMP-07 / D-10).
  const body = useComposeSession((s) => s.body);
  const mode = useComposeSession((s) => s.mode);
  const setBody = useComposeSession((s) => s.setBody);
  const startSession = useComposeSession((s) => s.startSession);
  const clearSession = useComposeSession((s) => s.clearSession);

  // Back → Dashboard root. Reset the parent tab tree so this stays correct when
  // Compose was opened from the Orrery stack as well as Dashboard.
  const goHome = useCallback(
    () =>
      navigation
        .getParent<NavigationProp<TabParamList>>()
        ?.reset(resetToDashboardRoot()),
    [navigation],
  );

  // Self-fetch on EVERY focus (first mount AND every return). B1: reset the state
  // machine at the START so a re-focus can't flash the prior SMS result against
  // the fresh pending probe; a `cancelled` flag stops a superseded focus's
  // load/probe overwriting the latest focused state.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // Begin (or resume) the session for this contact — a no-op for the same
      // contact, so an in-app return preserves the in-progress draft (COMP-07).
      startSession(contactId);
      setScreenState("loading");
      setSmsAvailable(null);

      const exec = getExecutor();
      void (async () => {
        try {
          const [row, actionableMethods] = await Promise.all([
            getContactHeader(exec, contactId),
            listActionablePrimaryMethods(exec, contactId),
          ]);
          if (cancelled) {
            return;
          }
          // A stale/deleted OR archived contact — exit to the dashboard, never
          // render a Compose surface. Archiving must hide the contact everywhere,
          // so treat archived exactly like missing.
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
      };
    }, [contactId, goHome, startSession]),
  );

  // Android hardware/system Back → dashboard too (consume the event so
  // native-stack doesn't pop to the profile). Registered while focused.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goHome();
        return true;
      });
      return () => sub.remove();
    }, [goHome]),
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

  // Transmit — in-flight latched (A3). Returns early while a handoff is open and
  // when there is no phone, then opens the OS SMS composer pre-filled. The channel
  // derives from the session-store `mode` (currently 'text'), never a literal.
  // CONSUMES the handoff outcome so the confirmation panel logs the EXACT assist.
  const onTransmit = useCallback(async () => {
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
      const outcome = await performReachOut(exec, {
        contactId,
        channel: mode,
        endpoint: phone,
        assistEnabled: settings.interactionAssistEnabled === 1,
        now: localDateTime(),
        messageBody: body,
      });
      // Show the additive confirmation ONLY for a started handoff that created an
      // assist. A failed launch (handoffStarted false) or opted-out assists
      // (assistUid null) show nothing and attempt no re-query.
      if (outcome.handoffStarted && outcome.assistUid !== null) {
        setConfirm({ assistUid: outcome.assistUid });
      }
    } finally {
      setSending(false);
    }
  }, [sending, header?.actionablePhone, contactId, mode, body]);

  // Copy — the guaranteed handoff, NEVER gated by `sending`, NEVER opens the
  // confirmation panel. On success show a transient "Message copied" for ~2s.
  const onCopy = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(body);
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
  }, [body]);

  // "Yes, log interaction" — log THIS assist through the sole recency writer at
  // its handoff_at (markAssistLogged reused UNCHANGED, D-06). connected=1 matches
  // the app-global text/email confirmation (its only affirmative is confirm(1)).
  // Latched so a re-tap during the write cannot double-log (T-35-05). On success,
  // clear the session (Transmit-confirmed — COMP-07 / D-10).
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
      clearSession(contactId);
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
  }, [logging, confirm, contactId, clearSession]);

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
        onPress={goHome}
      />
    </ChromeScrim>
  );

  // "loading" shows minimal chrome + Back; "error" shows Back after its Alert;
  // "missing" has already navigated home (render nothing meaningful).
  if (screenState !== "ready" || header === null) {
    return (
      <ScrollView testID="compose-screen" contentContainerStyle={styles.content}>
        <View style={styles.header}>{backControl}</View>
      </ScrollView>
    );
  }

  // "ready" — derive the controls (A1) through the pure resolver UNCONDITIONALLY.
  // The resolver owns the interim (smsAvailable === null, probe pending) case, so
  // no capability arithmetic is re-derived inline here.
  const phone = header.actionablePhone;
  const hasPhone = phone != null;
  const controls: ComposeControls = resolveComposeControls(
    hasPhone,
    smsAvailable,
  );
  const copyPrimary = controls.copyEmphasis === "primary";

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

      {/* SMS-unavailable helper (phone present, device can't text). */}
      {controls.smsUnavailableHelper ? (
        <ChromeScrim style={styles.labelScrim} radius={RADII.sm}>
          <AppText testID="compose-sms-helper" role="caption">
            This device can't send texts — copy your message instead.
          </AppText>
        </ChromeScrim>
      ) : null}

      {/* Add-a-phone-number affordance (no-phone only) → Edit. */}
      {controls.addNumber ? (
        <View style={styles.affordance}>
          <Button
            testID="compose-add-number"
            role="tertiary"
            label="Add a phone number"
            accessibilityLabel="Add a phone number"
            onPress={() => navigation.navigate("Edit", { contactId })}
          />
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
        {copied ? (
          <AppText testID="compose-copied" role="caption">
            Message copied
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
