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
 * assembly with Tone-null (D-08) + the durable new-item Allow-AI default (OFF
 * until deliberately changed) — lives in the node-tested
 * `log-interaction-logic.ts`. This shell owns only React state, navigation, and
 * the DAO calls.
 *
 * PRIVACY-CRITICAL SURFACE: the Allow AI toggle is seeded from the migration-029
 * default at creation time and remains OFF until deliberately changed; the note
 * egress reader is NOT widened here. All interaction writes route through
 * `recordTouchpoint` — the SOLE recency writer (ADR-010/024/071); the screen
 * builds no SQL.
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
 * ALSO SAVE TO (38.10 D-37, D-38, D-40, D-95): a one-section picker under the
 * form. The save branches on `effectiveAlsoSaveTo(note, chosen)` (convergence
 * c10, Codex C-01): a section with a non-blank note goes through
 * `recordTouchpointWithLinkedEntry` (interaction + linked entry in one
 * transaction); anything else is the plain `recordTouchpoint`. A note cleared
 * to blank resets the choice to None. The success snackbar names the person
 * and the section (38.9 D-39, D-46).
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { AlsoSaveToPicker } from "@/components/AlsoSaveToPicker";
import { ContactPicker } from "@/components/ContactPicker";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  type TouchpointRefineField,
  TouchpointRefineForm,
  type TouchpointRefineValue,
} from "@/components/TouchpointRefineForm";
import { AppText, Button } from "@/components/ui";
import { resolveNewItemAiDefault } from "@/db/ai-permissions-dao";
import {
  getAppSettings,
  REMEMBERED_INTERACTION_CHANNELS,
  type RememberedInteractionChannel,
  updateAppSettings,
} from "@/db/app-settings-dao";
import { getExecutor, localDateTime } from "@/db/database";
import type { LinkedSection } from "@/db/linked-entry-dao";
import {
  recordTouchpoint,
  recordTouchpointWithLinkedEntry,
} from "@/db/recency-dao";
import { newUid } from "@/db/uid";
import { useContactHeader } from "@/hooks/use-contact-header";
import {
  alsoSaveChoiceAfterNoteChange,
  canAlsoSave,
  effectiveAlsoSaveTo,
  loggedInteractionSnackbar,
} from "@/logic/also-save-to-logic";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import type { RootStackScreenProps } from "@/navigation/types";
import { useFocusedBottomInset } from "@/navigation/use-focused-bottom-inset";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import { beginInFlight, endInFlight } from "@/utils/single-flight";
import {
  applyChannelChange,
  buildLogInteractionInput,
  defaultsForChannel,
  isLogInteractionDirty,
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
  // DEF-01: the root clears the system navigation bar (focused workflow).
  const bottomInset = useFocusedBottomInset();
  const params = route.params ?? {};
  const prefillDate = params.prefillDate;

  const [contactId, setContactId] = useState<number | null>(
    params.contactId ?? null,
  );
  const [value, setValue] = useState<TouchpointRefineValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // "Also save to" (D-95): one section or None. Reset to None whenever the note
  // goes blank (convergence c10, Codex C-01).
  const [alsoSaveTo, setAlsoSaveTo] = useState<LinkedSection | null>(null);
  // Once the user explicitly overrides Direction, a channel change must not
  // re-fight it (CAPT-08 §R/§S). A ref so it never triggers a re-render.
  const userOverrodeDirection = useRef(false);
  // Synchronous single-flight guard (review WR-01): `saving` state is async, so a
  // fast double-tap can pass the guard twice and record TWO interactions. This
  // ref flips in the same tick and is the real write-once guarantee; `saving`
  // stays for the disabled/UI affordance.
  const savingRef = useRef(false);
  // Unsaved-work guard (F-01; D-13, D-15): the snapshot of the seeded form, so
  // only a change made after seed() resolved holds Back.
  const seedSnapshotRef = useRef<string | null>(null);
  const bypassRef = useRef(false);
  // D-45: the person line under the fixed title, once a contact is chosen (the
  // picker branch shows no header).
  const person = useContactHeader(contactId);

  // Seed the form Channel from the Default Interaction Channel preference. Pure
  // on-device SQLite read — no network on this read path (local-first). Renders
  // immediately once seeded (no blocking spinner beyond the settings read).
  const seed = useCallback(async () => {
    const now = localDateTime();
    try {
      const exec = getExecutor();
      const [settings, allowAiDefault] = await Promise.all([
        getAppSettings(exec),
        resolveNewItemAiDefault(exec, "interaction-note"),
      ]);
      const channel = resolveInitialChannel(
        settings.defaultInteractionChannel,
        settings.rememberedInteractionChannel,
      );
      const defaults = defaultsForChannel(channel);
      const seeded: TouchpointRefineValue = {
        occurredAt: seedOccurredAt(prefillDate, now),
        channel,
        direction: defaults.direction,
        connected: defaults.connected,
        quality: null,
        note: null,
        duration: null,
        allowAi: resolveInitialAllowAi(allowAiDefault),
      };
      seedSnapshotRef.current = JSON.stringify(seeded);
      setValue(seeded);
    } catch (err) {
      // A settings read failure falls back to the Message default so the form is
      // never left blank (CAPT-08 empty edge); the channel chooser still offers
      // exactly the three canonical options.
      Logger.error(LOG_SCOPE, "failed to read channel preference", err);
      const defaults = defaultsForChannel("Message");
      const seeded: TouchpointRefineValue = {
        occurredAt: seedOccurredAt(prefillDate, now),
        channel: "Message",
        direction: defaults.direction,
        connected: defaults.connected,
        quality: null,
        note: null,
        duration: null,
        allowAi: resolveInitialAllowAi(),
      };
      seedSnapshotRef.current = JSON.stringify(seeded);
      setValue(seeded);
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
    setAlsoSaveTo((chosen) => alsoSaveChoiceAfterNoteChange(next.note, chosen));
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

  // Off while the contact picker shows (contactId null; D-15).
  const { settleHold } = useDiscardKeepGuard({
    hasUnsavedChanges: isLogInteractionDirty({
      contactId,
      seedSnapshot: seedSnapshotRef.current,
      current: JSON.stringify(value),
    }),
    bypassRef,
    // A save in flight holds every exit, with no prompt (fix-pass WR-02).
    busyRef: savingRef,
  });

  async function handleSave() {
    if (!value || contactId === null) return;
    // Claim the in-flight slot synchronously; a second tap in the same tick bails
    // before it can record a duplicate interaction (review WR-01).
    if (!beginInFlight(savingRef)) return;
    setSaving(true);
    setSaveError(null);

    const writeNow = localDateTime();
    // The section actually saved: none for a blank note (c10 C-01).
    const section = effectiveAlsoSaveTo(value.note, alsoSaveTo);
    try {
      try {
        // The SOLE recency writer — one transaction, future-date guard, recompute.
        // The interaction is the source of truth from this point on. With a
        // section, the linked entry is written in the same transaction (D-37).
        const input = buildLogInteractionInput(value, {
          contactId,
          uid: newUid(),
          now: writeNow,
        });
        if (section !== null) {
          await recordTouchpointWithLinkedEntry(getExecutor(), input, section);
        } else {
          await recordTouchpoint(getExecutor(), input);
        }
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
      // 38.9 D-39 / D-46: verb first, then whom, plus the section.
      showSnackbar({
        kind: "success",
        label: loggedInteractionSnackbar({
          channel: value.channel,
          personName: person?.name ?? null,
          section,
        }),
      });
      bypassRef.current = true;
      navigation.goBack();
    } finally {
      endInFlight(savingRef);
      settleHold();
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
      <View style={[styles.root, { paddingBottom: bottomInset }]}>
        <ShellAppBar variant="child" title="Log Interaction" person={person} />
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

  // While a save runs the guard holds Back, so it draws disabled (D-26; WR-02).
  return (
    <View style={[styles.root, { paddingBottom: bottomInset }]}>
      <ShellAppBar
        variant="child"
        title="Log Interaction"
        person={person}
        backDisabled={saving}
      />
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

        <AlsoSaveToPicker
          testID="log-interaction-also-save-to"
          value={alsoSaveTo}
          onChange={setAlsoSaveTo}
          disabled={saving || !canAlsoSave(value.note)}
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
