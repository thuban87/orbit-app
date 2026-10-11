// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button and AppText use a
// domain-specific semantic `role` prop, not a web ARIA role.
import { useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
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
import { newUid } from "@/db/uid";
import { toGroupParticipantInputs } from "@/logic/group-log-participant-inputs";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

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
  const initialValueRef = useRef<TouchpointRefineValue | null>(null);
  if (initialValueRef.current === null)
    initialValueRef.current = newGroupValue();
  const initialValue = initialValueRef.current;
  const [title, setTitle] = useState("");
  const [value, setValue] = useState(initialValue);
  const [groupNote, setGroupNote] = useState("");
  const [participantIds, setParticipantIds] = useState<number[]>(
    () => route.params?.participantIds ?? [],
  );
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  // The operation (save) failure; rendered above Log group, never under a
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
  useDiscardKeepGuard({
    hasUnsavedChanges: snapshot !== seedRef.current,
    bypassRef,
  });

  async function save() {
    if (saving) return;
    if (title.trim().length === 0) {
      // Save stays pressable (CAPT-14): the error shows under Title, which is
      // scrolled into view and focused once the error has laid out (D-19).
      setTitleError("An event needs a title.");
      reveal(titleFieldRef, titleInputRef);
      return;
    }
    setSaving(true);
    setTitleError(null);
    setError(null);
    try {
      const now = localDateTime();
      await createGroupEvent(getExecutor(), {
        uid: newUid(),
        title,
        occurredAt: value.occurredAt,
        now,
        channel: value.channel,
        quality: value.quality,
        duration: value.duration,
        groupNote: groupNote || null,
        participants: toGroupParticipantInputs(participantIds, newUid),
      });
      bypassRef.current = true;
      navigation.goBack();
    } catch {
      setError("Couldn't save this event. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // House header (38.9 D-16, D-44): its Back calls goBack, which the guard
  // above intercepts (D-13). No opaque screen fill: the theme art shows (D-17).
  return (
    <View style={styles.screen}>
      <ShellAppBar variant="child" title="Group Log" />
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
            accessibilityLabel="Group Note"
            value={groupNote}
            onChangeText={setGroupNote}
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
          accessibilityLabel="Log group"
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          onPress={() => void save()}
          style={[
            styles.primary,
            { backgroundColor: colors.accent, opacity: saving ? 0.5 : 1 },
          ]}
        >
          <AppText role="label" style={{ color: colors.onAccent }}>
            Log group
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
