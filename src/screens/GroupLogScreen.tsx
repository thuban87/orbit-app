// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button and AppText use a
// domain-specific semantic `role` prop, not a web ARIA role.
/**
 * Group Log (+ → Group Log). Phase 38.10 D-96: the Group Note has the one-section
 * "Also save to" picker. Every participant gets a linked copy in that section,
 * created AI-off by the DAO (D-98, D-102); this screen has no Allow AI switch
 * for the copies and adds none. The picker is enabled only while the Group Note
 * has text, a blanked note resets it to None, and the save passes
 * `effectiveAlsoSaveTo(groupNote, chosen)`, never the raw choice (convergence
 * c10, Codex C-01).
 */
import { useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { AlsoSaveToPicker } from "@/components/AlsoSaveToPicker";
import { ContactPicker } from "@/components/ContactPicker";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  TouchpointRefineForm,
  type TouchpointRefineValue,
} from "@/components/TouchpointRefineForm";
import { AppText, Button } from "@/components/ui";
import { FieldError } from "@/components/ui/FieldError";
import { useFirstErrorReveal } from "@/components/ui/use-first-error-reveal";
import { getExecutor, localDateTime } from "@/db/database";
import { createGroupEvent } from "@/db/group-events-dao";
import type { LinkedSection } from "@/db/linked-entry-dao";
import { newUid } from "@/db/uid";
import {
  alsoSaveChoiceAfterNoteChange,
  canAlsoSave,
  effectiveAlsoSaveTo,
  loggedGroupEventSnackbar,
} from "@/logic/also-save-to-logic";
import { toGroupParticipantInputs } from "@/logic/group-log-participant-inputs";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import type { RootStackScreenProps } from "@/navigation/types";
import { useFocusedBottomInset } from "@/navigation/use-focused-bottom-inset";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { beginInFlight, endInFlight } from "@/utils/single-flight";

const GROUP_FUTURE_DATE_MESSAGE = "Events can't be in the future.";

function newGroupValue(): TouchpointRefineValue {
  return {
    occurredAt: localDateTime(),
    channel: "In Person",
    direction: null,
    connected: 1,
    quality: null,
    note: null,
    duration: null,
    allowAi: 0,
  };
}

export function GroupLogScreen({
  navigation,
  route,
}: RootStackScreenProps<"GroupLog">) {
  const { colors } = useTheme();
  // DEF-01: the root clears the system navigation bar (focused workflow).
  const bottomInset = useFocusedBottomInset();
  const initialValueRef = useRef<TouchpointRefineValue | null>(null);
  if (initialValueRef.current === null)
    initialValueRef.current = newGroupValue();
  const initialValue = initialValueRef.current;
  const [title, setTitle] = useState("");
  const [value, setValue] = useState(initialValue);
  const [groupNote, setGroupNote] = useState("");
  // "Also save to" for the Group Note (D-96): one section or None.
  const [alsoSaveTo, setAlsoSaveTo] = useState<LinkedSection | null>(null);
  const [participantIds, setParticipantIds] = useState<number[]>(
    () => route.params?.participantIds ?? [],
  );
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  // Synchronous in-flight flag: `saving` state lags a render, so the guard
  // reads this ref to hold Back while the save runs (fix-pass WR-02).
  const savingRef = useRef(false);
  // The operation (save) failure; rendered above Log event, never under a
  // field, and not cleared by typing (38.9 D-19, D-27; cycle-5 C5-M4).
  const [error, setError] = useState<string | null>(null);
  // The title validation error, rendered under the Title field and cleared
  // when the title changes (38.9 D-19; F-12).
  const [titleError, setTitleError] = useState<string | null>(null);
  const { scrollRef, contentRef, reveal } = useFirstErrorReveal();
  const titleFieldRef = useRef<View>(null);
  const titleInputRef = useRef<TextInput>(null);
  const seedRef = useRef(
    JSON.stringify({
      title: "",
      value: initialValue,
      groupNote: "",
      participantIds: route.params?.participantIds ?? [],
    }),
  );
  const bypassRef = useRef(false);
  const snapshot = useMemo(
    () => JSON.stringify({ title, value, groupNote, participantIds }),
    [groupNote, participantIds, title, value],
  );
  const { settleHold } = useDiscardKeepGuard({
    hasUnsavedChanges: snapshot !== seedRef.current,
    bypassRef,
    // A save in flight holds every exit, with no prompt (fix-pass WR-02).
    busyRef: savingRef,
  });

  async function save() {
    if (savingRef.current) return;
    if (title.trim().length === 0) {
      // Save stays pressable (CAPT-14): the error shows under Title, which is
      // scrolled into view and focused once the error has laid out (D-19).
      setTitleError("An event needs a title.");
      reveal(titleFieldRef, titleInputRef);
      return;
    }
    if (!beginInFlight(savingRef)) return;
    setSaving(true);
    setTitleError(null);
    setError(null);
    try {
      const now = localDateTime();
      const savedSection = effectiveAlsoSaveTo(groupNote, alsoSaveTo);
      await createGroupEvent(getExecutor(), {
        uid: newUid(),
        title,
        occurredAt: value.occurredAt,
        now,
        channel: value.channel,
        quality: value.quality,
        duration: value.duration,
        groupNote: groupNote || null,
        // The section actually saved: none for a blank Group Note (c10 C-01).
        alsoSaveTo: savedSection,
        participants: toGroupParticipantInputs(participantIds, newUid),
      });
      // 38.9 D-39 / D-46: Group Log was silent; verb first, then whom.
      showSnackbar({
        kind: "success",
        label: loggedGroupEventSnackbar({
          title: title.trim(),
          participantCount: participantIds.length,
          section: savedSection,
        }),
      });
      bypassRef.current = true;
      navigation.goBack();
    } catch {
      setError("Couldn't save this event. Please try again.");
    } finally {
      setSaving(false);
      endInFlight(savingRef);
      settleHold();
    }
  }

  // House header (38.9 D-16, D-44): its Back calls goBack, which the guard
  // above intercepts (D-13). While a save runs the guard holds Back, so it
  // draws disabled (D-26; WR-02). No opaque screen fill: the theme art shows
  // (D-17).
  return (
    <View style={[styles.screen, { paddingBottom: bottomInset }]}>
      <ShellAppBar variant="child" title="Group Log" backDisabled={saving} />
      <ScrollView
        ref={scrollRef}
        innerViewRef={contentRef}
        contentContainerStyle={styles.content}
      >
        <View
          ref={titleFieldRef}
          testID="group-log-title-field"
          style={styles.field}
        >
          <AppText role="label" style={{ color: colors.textSecondary }}>
            Title
          </AppText>
          <TextInput
            ref={titleInputRef}
            testID="group-log-title"
            accessibilityLabel="Event title"
            value={title}
            onChangeText={(next) => {
              setTitle(next);
              setTitleError(null);
            }}
            placeholder="What happened?"
            placeholderTextColor={colors.textPlaceholder}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
          <FieldError testID="group-log-title-error" message={titleError} />
        </View>
        <TouchpointRefineForm
          testID="group-log-form"
          value={value}
          onChange={setValue}
          now={localDateTime()}
          visibleFields={["datetime", "channel", "tone", "duration"]}
          futureDateMessage={GROUP_FUTURE_DATE_MESSAGE}
        />
        <View style={styles.field}>
          <AppText role="label" style={{ color: colors.textSecondary }}>
            Group Note
          </AppText>
          <TextInput
            testID="group-log-group-note"
            accessibilityLabel="Group Note"
            value={groupNote}
            onChangeText={(next) => {
              setGroupNote(next);
              setAlsoSaveTo((chosen) =>
                alsoSaveChoiceAfterNoteChange(next, chosen),
              );
            }}
            multiline
            placeholder="Add shared context"
            placeholderTextColor={colors.textPlaceholder}
            style={[
              styles.note,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
        </View>
        <AlsoSaveToPicker
          testID="group-log-also-save-to"
          value={alsoSaveTo}
          onChange={setAlsoSaveTo}
          disabled={saving || !canAlsoSave(groupNote)}
        />
        <View style={[styles.participants, { borderColor: colors.border }]}>
          <AppText role="label">Participants</AppText>
          {participantIds.length === 0 ? (
            <View style={styles.field}>
              <AppText role="body">No participants yet</AppText>
              <AppText role="caption" style={{ color: colors.textSecondary }}>
                Add the people who were there — or save now and add them later.
              </AppText>
            </View>
          ) : (
            <AppText role="caption" style={{ color: colors.textSecondary }}>
              {participantIds.length} participant
              {participantIds.length === 1 ? "" : "s"} selected
            </AppText>
          )}
          <Button
            role="secondary"
            label="Add participants"
            onPress={() => setPickerVisible(true)}
          />
        </View>
        {error ? (
          <AppText role="caption" style={{ color: colors.danger }}>
            {error}
          </AppText>
        ) : null}
        <Pressable
          testID="group-log-save"
          accessibilityRole="button"
          accessibilityLabel="Log event"
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          onPress={() => void save()}
          style={[
            styles.primary,
            { backgroundColor: colors.accent, opacity: saving ? 0.5 : 1 },
          ]}
        >
          <AppText role="label" style={{ color: colors.onAccent }}>
            Log event
          </AppText>
        </Pressable>
      </ScrollView>
      <ContactPicker
        mode="multi"
        visible={pickerVisible}
        initialSelected={participantIds}
        onDismiss={() => setPickerVisible(false)}
        onConfirm={setParticipantIds}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.base, gap: SPACING.base },
  field: { gap: SPACING.sm },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
  },
  note: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: 8,
    padding: SPACING.md,
    textAlignVertical: "top",
  },
  participants: {
    gap: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: SPACING.base,
  },
  primary: {
    minHeight: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.base,
  },
});
