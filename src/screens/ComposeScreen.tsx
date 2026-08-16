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
 *   - Send uses `expo-sms.sendSMSAsync` (native address+body marshalling) — no
 *     hand-rolled `sms:` URI string, and no react-native URL-scheme module.
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
import * as Clipboard from "expo-clipboard";
import * as SMS from "expo-sms";
import { Avatar } from "@/components/Avatar";
import { getContactHeader } from "@/db/contact-read";
import { getExecutor, localDateTime } from "@/db/database";
import { type FuelItem, getRankedFuel } from "@/db/fuel-read";
import type { RootStackScreenProps } from "@/navigation/types";
import {
  type ComposeControls,
  resolveComposeControls,
} from "@/logic/compose-logic";
import { fuelKindLabel } from "@/services/fuel-kind-label";
import { formatFuelAge } from "@/services/fuel-age";
import { useTheme } from "@/theme";
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
  /**
   * Non-null when the contact is archived. Archiving "hides the contact from
   * every live surface" (Phase-4 commitment) — compose is entry-agnostic and
   * reused by Phases 11/12/14, so an archived contact must be treated exactly
   * like a missing one (route Home, render no Send/Copy/fuel surface).
   */
  archived_at: string | null;
  /** The SMS-handoff source — null (or whitespace-only) means no phone (CMP-03). */
  phone: string | null;
};

export function ComposeScreen({ navigation, route }: RootStackScreenProps<"Compose">) {
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
      setScreenState("loading");
      setSmsAvailable(null);

      const exec = getExecutor();
      void (async () => {
        try {
          // Header + fuel only (NOT the SMS probe — that runs separately below so
          // it can neither block nor fail this load).
          const [row, fuelRows] = await Promise.all([
            getContactHeader(exec, contactId),
            getRankedFuel(exec, contactId),
          ]);
          if (cancelled) {
            return;
          }
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
            phone: row.phone,
          });
          setFuel(fuelRows);
          setScreenState("ready");
        } catch (err) {
          Logger.error(LOG_SCOPE, "failed to load contact", err);
          if (!cancelled) {
            Alert.alert("Couldn't load this contact", "Please go back and retry.");
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
      };
    }, [contactId, goHome]),
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

  // Send — in-flight latched (A3). Returns early while a handoff is open AND when
  // there is no phone (C1 — narrows phone to a non-null string for sendSMSAsync and
  // guards a stale handler), then opens the OS SMS composer pre-filled. Resets the
  // latch in `finally` so both a resolved and a thrown handoff release it (a rapid
  // double-tap cannot launch two composers). Writes NOTHING to the DB.
  const onSend = useCallback(async () => {
    if (sending) {
      return;
    }
    const phone = header?.phone?.trim() || null;
    if (phone === null) {
      return;
    }
    setSending(true);
    try {
      await SMS.sendSMSAsync(phone, draft);
      // Android returns { result: 'unknown' } — do NOT render a "sent"
      // confirmation and do NOT write any interaction/log row.
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to open SMS composer", err);
      Alert.alert(
        "Couldn't open your messages app",
        "Your message is ready to copy instead.",
      );
    } finally {
      setSending(false);
    }
  }, [sending, header, draft]);

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
  const phone = header.phone?.trim() || null;
  const hasPhone = phone != null;
  const controls: ComposeControls = resolveComposeControls(hasPhone, smsAvailable);

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
                <Text style={[styles.fuelMeta, { color: colors.textSecondary }]}>
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

      {/* Reserved AI-Suggest slot (Phase 14) — DO NOT build any AI control here;
          this comment marks the layout room so Phase 14 slots in without a
          re-layout. */}

      {/* Draft — opens BLANK, multiline. */}
      <View testID="compose-draft" style={styles.section}>
        <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
          YOUR MESSAGE
        </Text>
        <TextInput
          testID="compose-draft-input"
          value={draft}
          onChangeText={setDraft}
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
              : { backgroundColor: colors.background, borderColor: colors.accent },
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
});
