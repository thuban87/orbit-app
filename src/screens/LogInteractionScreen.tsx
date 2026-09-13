// biome-ignore-all lint/a11y/useValidAriaRole: `role` is the Button domain prop
// (visual role: primary/tertiary/…), NOT an ARIA role — the a11y lint false-fires
// on the prop name (same precedent as ContactPicker.tsx / Button.tsx).
/**
 * LogInteractionScreen (CAPT-07/08/09/10/11/13/14) — the canonical ordinary
 * detailed Log Interaction form filling the `LogContact` route (D-11: user-facing
 * copy "Log Interaction"; the internal route id / `'log-contact'` enum are
 * unchanged, renaming them is owner-scope).
 *
 * COMPOSES the shipped `TouchpointRefineForm` (controlled) — it does NOT clone it.
 * The genuinely-new logic — channel-sensitive Direction/Connected defaulting
 * (CAPT-08), the Default Interaction Channel preference resolution and the
 * remembered-on-success-only gate (CAPT-11, D-09), and the recordTouchpoint input
 * assembly with Tone-null (D-08) + Allow-AI-OFF (D-04) — lives in the node-tested
 * `log-interaction-logic.ts`. This shell owns only React state, navigation, and
 * the DAO calls.
 *
 * PRIVACY-CRITICAL SURFACE: the Allow AI toggle ships default OFF
 * (`resolveInitialAllowAi()` → 0); the note egress reader is NOT widened here
 * (ADR-078). All interaction writes route through `recordTouchpoint` — the SOLE
 * recency writer (ADR-010/024/071); the screen builds no SQL.
 *
 * NON-ATOMIC REMEMBERED-CHANNEL WRITE (CAPT-11 recovery, Review MEDIUM 34-04): the
 * interaction is the source of truth. The remembered-channel `updateAppSettings`
 * is a SEPARATE transaction attempted only AFTER a confirmed interaction save; a
 * failure there is caught + logged, never rolls back the saved interaction, never
 * surfaces as a save error, and never blocks navigation (the next successful save
 * refreshes it).
 *
 * FAILURE-SAFETY (CAPT-14): an interaction-save failure preserves the full form
 * state, shows "Couldn't save / Please try again." with Retry, and never navigates
 * / never shows completion.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { ContactPicker } from "@/components/ContactPicker";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  type TouchpointRefineField,
  TouchpointRefineForm,
  type TouchpointRefineValue,
} from "@/components/TouchpointRefineForm";
import { AppText, Button } from "@/components/ui";
import {
  getAppSettings,
  REMEMBERED_INTERACTION_CHANNELS,
  type RememberedInteractionChannel,
  updateAppSettings,
} from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { recordTouchpoint } from "@/db/recency-dao";
import { newUid } from "@/db/uid";
import type { RootStackScreenProps } from "@/navigation/types";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import { beginInFlight, endInFlight } from "@/utils/single-flight";
import {
  applyChannelChange,
  buildLogInteractionInput,
  defaultsForChannel,
  ORDINARY_LOG_CHANNEL_OPTIONS,
  resolveInitialAllowAi,
  resolveInitialChannel,
  shouldUpdateRemembered,
} from "./log-interaction-logic";

const LOG_SCOPE = "log-interaction";

const SAVE_FAILED_MESSAGE = "Couldn't save. Please try again.";
const ALLOW_AI_CAPTION = "Let AI use this note's text. Off by default.";
/** Duration lives under the collapsed "More Options" disclosure (CAPT-07). */
const MORE_OPTIONS_FIELDS: ReadonlyArray<TouchpointRefineField> = ["duration"];

/** The occurred_at seed: a History-originated prefillDate day, else local now. */
function seedOccurredAt(prefillDate: string | undefined, now: string): string {
  // A History empty-date "Log interaction" prefills exactly that local day at
  // midnight (matches create-contact-logic's `${date} 00:00:00`); otherwise the
  // interaction defaults to now (freely backdateable, no age warnings).
  return prefillDate ? `${prefillDate} 00:00:00` : now;
}

export function LogInteractionScreen({
  navigation,
  route,
}: RootStackScreenProps<"LogContact">) {
  const { colors } = useTheme();
  const params = route.params ?? {};
  const prefillDate = params.prefillDate;

  const [contactId, setContactId] = useState<number | null>(
    params.contactId ?? null,
  );
  const [value, setValue] = useState<TouchpointRefineValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Once the user explicitly overrides Direction, a channel change must not
  // re-fight it (CAPT-08 §R/§S). A ref so it never triggers a re-render.
  const userOverrodeDirection = useRef(false);
  // Synchronous single-flight guard (review WR-01): `saving` state is async, so a
  // fast double-tap can pass the guard twice and record TWO interactions. This
  // ref flips in the same tick and is the real write-once guarantee; `saving`
  // stays for the disabled/UI affordance.
  const savingRef = useRef(false);

  // Seed the form Channel from the Default Interaction Channel preference. Pure
  // on-device SQLite read — no network on this read path (local-first). Renders
  // immediately once seeded (no blocking spinner beyond the settings read).
  const seed = useCallback(async () => {
    const now = localDateTime();
    try {
      const settings = await getAppSettings(getExecutor());
      const channel = resolveInitialChannel(
        settings.defaultInteractionChannel,
        settings.rememberedInteractionChannel,
      );
      const defaults = defaultsForChannel(channel);
      setValue({
        occurredAt: seedOccurredAt(prefillDate, now),
        channel,
        direction: defaults.direction,
        connected: defaults.connected,
        quality: null,
        note: null,
        duration: null,
        allowAi: resolveInitialAllowAi(),
      });
    } catch (err) {
      // A settings read failure falls back to the Message default so the form is
      // never left blank (CAPT-08 empty edge); the channel chooser still offers
      // exactly the three canonical options.
      Logger.error(LOG_SCOPE, "failed to read channel preference", err);
      const defaults = defaultsForChannel("Message");
      setValue({
        occurredAt: seedOccurredAt(prefillDate, now),
        channel: "Message",
        direction: defaults.direction,
        connected: defaults.connected,
        quality: null,
        note: null,
        duration: null,
        allowAi: resolveInitialAllowAi(),
      });
    }
  }, [prefillDate]);

  useEffect(() => {
    void seed();
  }, [seed]);

  // Coordinate channel-sensitive Direction/Connected defaulting (CAPT-08). A
  // channel change re-seeds Direction/Connected (unless the user overrode
  // Direction); a direction change marks the user override so later channel
  // changes stop re-fighting it.
  const handleChange = useCallback((next: TouchpointRefineValue) => {
    setValue((prev) => {
      if (!prev) return next;
      if (next.channel !== prev.channel) {
        return applyChannelChange(
          next,
          next.channel,
          userOverrodeDirection.current,
        );
      }
      if (next.direction !== prev.direction) {
        userOverrodeDirection.current = true;
      }
      return next;
    });
  }, []);

  async function handleSave() {
    if (!value || contactId === null) return;
    // Claim the in-flight slot synchronously; a second tap in the same tick bails
    // before it can record a duplicate interaction (review WR-01).
    if (!beginInFlight(savingRef)) return;
    setSaving(true);
    setSaveError(null);

    const writeNow = localDateTime();
    try {
      try {
        // The SOLE recency writer — one transaction, future-date guard, recompute.
        // The interaction is the source of truth from this point on.
        await recordTouchpoint(
          getExecutor(),
          buildLogInteractionInput(value, {
            contactId,
            uid: newUid(),
            now: writeNow,
          }),
        );
      } catch (err) {
        // Interaction save failed: preserve the full form state, surface the
        // locked error + Retry, never complete / never navigate (CAPT-14).
        Logger.error(LOG_SCOPE, "failed to record interaction", err);
        setSaveError(SAVE_FAILED_MESSAGE);
        setSaving(false);
        return;
      }

      // Interaction is durably saved. Best-effort remembered-channel write — a
      // SEPARATE transaction, only on a successful ordinary save (D-09). A failure
      // here is logged and swallowed: it never rolls back the saved interaction,
      // never becomes a save error, and never blocks navigation (Review MEDIUM 34-04).
      if (
        shouldUpdateRemembered({ saveSucceeded: true, isGroupLog: false }) &&
        (REMEMBERED_INTERACTION_CHANNELS as readonly string[]).includes(
          value.channel,
        )
      ) {
        try {
          await updateAppSettings(
            getExecutor(),
            {
              rememberedInteractionChannel:
                value.channel as RememberedInteractionChannel,
            },
            localDateTime(),
          );
        } catch (err) {
          Logger.error(
            LOG_SCOPE,
            "remembered-channel write failed (ignored)",
            err,
          );
        }
      }

      // Committed: nudge the widget; derived consumers recompute on their next
      // focused read. Return to the origin-aware caller (Profile).
      notifyWidgetDataChanged();
      navigation.goBack();
    } finally {
      endInFlight(savingRef);
    }
  }

  // No preselected contact: the picker resolves one; dismiss returns to caller.
  if (contactId === null) {
    return (
      <ContactPicker
        visible
        onSelect={(id) => setContactId(id)}
        onDismiss={() => navigation.goBack()}
      />
    );
  }

  if (!value) {
    return (
      <View style={styles.root}>
        <ShellAppBar variant="child" title="Log Interaction" />
        <View style={styles.loading}>
          <AppText role="caption">Loading…</AppText>
        </View>
      </View>
    );
  }

  // Connected is hidden for In Person (a face-to-face is connected — §R/§S).
  const { connectedHidden } = defaultsForChannel(value.channel);
  const visibleFields: TouchpointRefineField[] = [
    "datetime",
    "channel",
    "direction",
    ...(connectedHidden ? [] : (["connected"] as TouchpointRefineField[])),
    "tone",
    "note",
    "duration",
    "allowAi",
  ];

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Log Interaction" />
      <ScrollView
        testID="log-interaction-screen"
        contentContainerStyle={styles.content}
      >
        <TouchpointRefineForm
          testID="log-interaction-form"
          value={value}
          onChange={handleChange}
          now={localDateTime()}
          visibleFields={visibleFields}
          channelOptions={ORDINARY_LOG_CHANNEL_OPTIONS}
          moreOptionsFields={MORE_OPTIONS_FIELDS}
          allowAiCaption={ALLOW_AI_CAPTION}
        />

        {saveError ? (
          <AppText
            testID="log-interaction-save-error"
            role="caption"
            accessibilityLabel={saveError}
            style={{ color: colors.danger }}
          >
            {saveError}
          </AppText>
        ) : null}

        <Button
          testID={saveError ? "log-interaction-retry" : "log-interaction-save"}
          role="primary"
          label={saveError ? "Retry" : "Save"}
          disabled={saving}
          onPress={() => void handleSave()}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: 16,
    gap: 16,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
});
