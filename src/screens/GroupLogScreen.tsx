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
import {
  TouchpointRefineForm,
  type TouchpointRefineValue,
} from "@/components/TouchpointRefineForm";
import { AppText, Button } from "@/components/ui";
import { getExecutor, localDateTime } from "@/db/database";
import { createGroupEvent } from "@/db/group-events-dao";
import { newUid } from "@/db/uid";
import { toGroupParticipantInputs } from "@/logic/group-log-participant-inputs";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

const GROUP_FUTURE_DATE_MESSAGE = "Group events can't be in the future.";

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
  const [title, setTitle] = useState("");
  const [value, setValue] = useState(newGroupValue);
  const [groupNote, setGroupNote] = useState("");
  const [participantIds, setParticipantIds] = useState<number[]>(
    () => route.params?.participantIds ?? [],
  );
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seedRef = useRef(
    JSON.stringify({
      title: "",
      value: newGroupValue(),
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
      setError("A group event needs a title.");
      return;
    }
    setSaving(true);
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
      setError("Couldn't save this group event. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Button
            role="secondary"
            label="Back"
            onPress={() => navigation.goBack()}
          />
          <AppText role="heading">Group Log</AppText>
        </View>
        <View style={styles.field}>
          <AppText role="label" style={{ color: colors.textSecondary }}>
            Title
          </AppText>
          <TextInput
            accessibilityLabel="Group event title"
            value={title}
            onChangeText={setTitle}
            placeholder="What happened?"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
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
            placeholderTextColor={colors.textSecondary}
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
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
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
