/**
 * EditInteractionScreen (HIST-12, HIST-14) — the ONE canonical Edit Interaction
 * route. A focused shell that loads a single interaction, renders the extended
 * `TouchpointRefineForm` as a controlled value, and on Save persists EVERY
 * editable field (date/time, channel, direction, connected, Tone, note, optional
 * duration, Allow-AI) through `editTouchpointFull` — the SOLE recency writer.
 *
 * WHY ONE ROUTE (ADR-010 / ADR-024, D-05): every interaction edit must flow
 * through the single recency spine so `last_contact`, tombstones, and the
 * future-date guard stay at one chokepoint. This screen builds NO SQL and issues
 * no set-based write to the interactions table; the correctness rules live in the
 * node-tested `edit-interaction-logic.ts` and the recency DAO. `editTouchpointFull`
 * rejects a future `occurred_at` (the authority) and recomputes recency inside one
 * transaction — the inline `FUTURE_DATETIME_MESSAGE` the embedded form shows is
 * UX-only feedback, not a second source of truth.
 *
 * On a successful save the route returns to the caller; derived consumers (heatmap
 * buckets, Intensity, Last Interaction, Status, Gravity) recompute from the moved
 * recency on their next focused read, and the widget is nudged. A failed save
 * preserves the full form state and never navigates away (the CAPT/refine idiom).
 *
 * Modeled on `EditContactScreen`: headerShown:false + own Back chrome, a primary
 * `Save changes` action, and a discard-keep guard for unsaved edits.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  TouchpointRefineForm,
  type TouchpointRefineValue,
} from "@/components/TouchpointRefineForm";
import { getExecutor, localDateTime } from "@/db/database";
import { readInteractionForEdit } from "@/db/interaction-edit-read";
import { editTouchpointFull } from "@/db/recency-dao";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import type { RootStackScreenProps } from "@/navigation/types";
import { notifyWidgetDataChanged } from "@/services/widget/widget-refresh";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";
import {
  buildEditInput,
  canSave,
  resolveSave,
  seedRefineValue,
} from "./edit-interaction-logic";

const LOG_SCOPE = "edit-interaction";

export function EditInteractionScreen({
  navigation,
  route,
}: RootStackScreenProps<"EditInteraction">) {
  const { colors } = useTheme();
  const { contactId, interactionId } = route.params;

  const [value, setValue] = useState<TouchpointRefineValue | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // The seeded snapshot — the dirty-check baseline for the discard-keep guard.
  const seedRef = useRef<string | null>(null);
  const bypassRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const loaded = await readInteractionForEdit(
        getExecutor(),
        contactId,
        interactionId,
      );
      if (!loaded) {
        setNotFound(true);
        Alert.alert(
          "Couldn't load this interaction",
          "Please go back and retry.",
        );
        return;
      }
      const seeded = seedRefineValue(loaded);
      seedRef.current = JSON.stringify(seeded);
      setValue(seeded);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load interaction for edit", err);
      Alert.alert("Couldn't load the form", "Please reopen this screen.");
    }
  }, [contactId, interactionId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Fresh local now for the form's future bound + the Save gate; the write uses
  // its own fresh now inside handleSave (the authoritative stamp).
  const now = localDateTime();
  const savable = useMemo(
    () => value !== null && canSave(value, now, saving),
    [value, now, saving],
  );

  const hasUnsavedChanges =
    value !== null && seedRef.current !== JSON.stringify(value);
  useDiscardKeepGuard({ hasUnsavedChanges, bypassRef });

  async function handleSave() {
    if (!value || !canSave(value, localDateTime(), saving)) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const writeNow = localDateTime();
      // The SOLE recency writer — one transaction, future-date guard, recompute.
      await editTouchpointFull(
        getExecutor(),
        buildEditInput(value, { interactionId, contactId, now: writeNow }),
      );
      // Committed: nudge the widget; in-app derived consumers recompute on their
      // next focused read (heatmap, Intensity, Last Interaction, Status, Gravity).
      notifyWidgetDataChanged();
      bypassRef.current = true;
      navigation.goBack();
    } catch (err) {
      // Failure preserves the full form state and never completes (never
      // navigates) — the user corrects and retries in place.
      Logger.error(LOG_SCOPE, "failed to save interaction edit", err);
      setSaveError(resolveSave(value, false).error);
    } finally {
      setSaving(false);
    }
  }

  if (notFound) {
    return (
      <View testID="edit-interaction-missing" style={styles.loading}>
        <Text style={{ color: colors.textSecondary }}>
          This interaction is no longer available.
        </Text>
      </View>
    );
  }

  if (!value) {
    return (
      <View testID="edit-interaction-loading" style={styles.loading}>
        <Text style={{ color: colors.textSecondary }}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      testID="edit-interaction-screen"
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          testID="edit-interaction-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          Edit interaction
        </Text>
      </View>

      <TouchpointRefineForm
        testID="edit-interaction-form"
        value={value}
        onChange={setValue}
        now={now}
      />

      {saveError ? (
        <Text
          testID="edit-interaction-save-error"
          accessibilityLabel={saveError}
          style={[styles.error, { color: colors.danger }]}
        >
          {saveError}
        </Text>
      ) : null}

      <Pressable
        testID="edit-interaction-save"
        accessibilityRole="button"
        accessibilityLabel="Save changes"
        accessibilityState={{ disabled: !savable }}
        disabled={!savable}
        onPress={() => void handleSave()}
        style={[
          styles.saveBtn,
          {
            backgroundColor: savable ? colors.accent : colors.surface,
            borderColor: savable ? colors.accent : colors.border,
          },
        ]}
      >
        <Text
          style={{
            color: savable ? colors.onAccent : colors.textSecondary,
            fontWeight: "600",
          }}
        >
          Save changes
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 24,
    fontWeight: "700",
  },
  error: {
    fontSize: 13,
    fontWeight: "600",
  },
  saveBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
});
