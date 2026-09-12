// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button and AppText use a
// domain-specific semantic `role` prop, not a web ARIA role.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { ContactPicker } from "@/components/ContactPicker";
import {
  type ParticipantEditDraft,
  ParticipantOverrideEditor,
  participantDraft,
} from "@/components/group/ParticipantOverrideEditor";
import { RemoveParticipantSheet } from "@/components/group/RemoveParticipantSheet";
import {
  TouchpointRefineForm,
  type TouchpointRefineValue,
} from "@/components/TouchpointRefineForm";
import { AppText, Button, Sheet } from "@/components/ui";
import { getExecutor, localDateTime } from "@/db/database";
import {
  addParticipant,
  deleteGroupChild,
  detachParticipant,
  saveParticipantEdits,
  updateGroupEvent,
} from "@/db/group-events-dao";
import {
  type GroupEventDetail,
  type GroupEventParticipant,
  readGroupEventDetail,
} from "@/db/group-events-read";
import { newUid } from "@/db/uid";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

const GROUP_FUTURE_DATE_MESSAGE = "Group events can't be in the future.";

interface EventDraft {
  value: TouchpointRefineValue;
  groupNote: string;
}

function eventDraft(event: GroupEventDetail): EventDraft {
  return {
    value: {
      occurredAt: event.occurredAt,
      channel: event.channel ?? "In Person",
      quality: event.quality,
      duration: event.duration,
      direction: null,
      connected: 1,
      note: null,
      allowAi: 0,
    },
    groupNote: event.groupNote ?? "",
  };
}

export function EditGroupEventScreen({
  navigation,
  route,
}: RootStackScreenProps<"EditGroupEvent">) {
  const { colors } = useTheme();
  const { groupEventId } = route.params;
  const [event, setEvent] = useState<GroupEventDetail | null>(null);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [editing, setEditing] = useState<GroupEventParticipant | null>(null);
  const [participantDraftState, setParticipantDraftState] =
    useState<ParticipantEditDraft | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [removing, setRemoving] = useState<GroupEventParticipant | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const baselineRef = useRef<string | null>(null);
  const bypassRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const loaded = await readGroupEventDetail(getExecutor(), {
        groupEventId,
      });
      if (!loaded) {
        setError("This group event is no longer available.");
        return;
      }
      const nextDraft = eventDraft(loaded);
      baselineRef.current = JSON.stringify(nextDraft);
      setEvent(loaded);
      setDraft(nextDraft);
    } catch {
      setError("Couldn't load this group event. Please go back and retry.");
    }
  }, [groupEventId]);

  useEffect(() => {
    void load();
  }, [load]);
  const hasUnsavedChanges =
    draft !== null && JSON.stringify(draft) !== baselineRef.current;
  useDiscardKeepGuard({ hasUnsavedChanges, bypassRef });

  async function saveEvent() {
    if (!event || !draft || saving) return;
    setSaving(true);
    setError(null);
    const initial = eventDraft(event);
    const patch = {
      ...(draft.value.channel !== initial.value.channel
        ? { channel: { value: draft.value.channel } }
        : {}),
      ...(draft.value.quality !== initial.value.quality
        ? { quality: { value: draft.value.quality } }
        : {}),
      ...(draft.value.duration !== initial.value.duration
        ? { duration: { value: draft.value.duration } }
        : {}),
      ...(draft.groupNote !== initial.groupNote
        ? { groupNote: { value: draft.groupNote || null } }
        : {}),
    };
    try {
      await updateGroupEvent(getExecutor(), {
        groupEventId,
        now: localDateTime(),
        ...(draft.value.occurredAt !== initial.value.occurredAt
          ? { occurredAt: draft.value.occurredAt }
          : {}),
        patch,
      });
      bypassRef.current = true;
      navigation.goBack();
    } catch {
      setError("Couldn't update the group event. Your changes weren't saved.");
    } finally {
      setSaving(false);
    }
  }

  async function addSelected(contactIds: number[]) {
    setPickerVisible(false);
    try {
      await Promise.all(
        contactIds.map((contactId) =>
          addParticipant(getExecutor(), {
            groupEventId,
            contactId,
            uid: newUid(),
            now: localDateTime(),
          }),
        ),
      );
      await load();
    } catch {
      setError("Couldn't update the group event. Your changes weren't saved.");
    }
  }

  async function removeParticipant(keep: boolean) {
    if (!removing) return;
    try {
      if (keep) {
        await detachParticipant(getExecutor(), {
          groupEventId,
          interactionId: removing.interactionId,
          now: localDateTime(),
        });
      } else {
        await deleteGroupChild(getExecutor(), {
          groupEventId,
          interactionId: removing.interactionId,
          contactId: removing.contactId,
          now: localDateTime(),
        });
      }
      setRemoving(null);
      await load();
    } catch {
      setError("Couldn't update the group event. Your changes weren't saved.");
    }
  }

  async function saveParticipant() {
    if (!editing || !participantDraftState || !event) return;
    const initial = participantDraft(editing, event);
    const draftParticipant = participantDraftState;
    try {
      await saveParticipantEdits(getExecutor(), {
        interactionId: editing.interactionId,
        contactId: editing.contactId,
        groupEventId,
        now: localDateTime(),
        follow: {
          ...(draftParticipant.follow.channel !== initial.follow.channel
            ? {
                channel: draftParticipant.follow.channel
                  ? { follow: true as const }
                  : {
                      follow: false as const,
                      value: draftParticipant.value.channel,
                    },
              }
            : {}),
          ...(draftParticipant.follow.quality !== initial.follow.quality
            ? {
                quality: draftParticipant.follow.quality
                  ? { follow: true as const }
                  : {
                      follow: false as const,
                      value: draftParticipant.value.quality,
                    },
              }
            : {}),
          ...(draftParticipant.follow.duration !== initial.follow.duration
            ? {
                duration: draftParticipant.follow.duration
                  ? { follow: true as const }
                  : {
                      follow: false as const,
                      value: draftParticipant.value.duration,
                    },
              }
            : {}),
        },
        fields: {
          ...(draftParticipant.value.direction !== initial.value.direction
            ? { direction: draftParticipant.value.direction }
            : {}),
          ...(draftParticipant.value.connected !== initial.value.connected
            ? { connected: draftParticipant.value.connected }
            : {}),
          ...(draftParticipant.value.note !== initial.value.note
            ? { note: draftParticipant.value.note }
            : {}),
        },
      });
      setEditing(null);
      setParticipantDraftState(null);
      await load();
    } catch {
      setError("Couldn't save this participant. Please try again.");
    }
  }

  if (!event || !draft) {
    return (
      <View style={styles.loading}>
        {error ? (
          <AppText role="body" style={{ color: colors.danger }}>
            {error}
          </AppText>
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </View>
    );
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
          <AppText role="heading">Edit Group Event</AppText>
        </View>
        <AppText role="body">{event.title}</AppText>
        <TouchpointRefineForm
          testID="edit-group-event-form"
          value={draft.value}
          onChange={(value) =>
            setDraft((current) => (current ? { ...current, value } : current))
          }
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
            value={draft.groupNote}
            onChangeText={(groupNote) =>
              setDraft((current) =>
                current ? { ...current, groupNote } : current,
              )
            }
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
          <FlatList
            data={event.participants}
            keyExtractor={(participant) => String(participant.interactionId)}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.participantRow}>
                <AppText role="body">{item.contactName}</AppText>
                <View style={styles.rowActions}>
                  <Button
                    role="tertiary"
                    label="Edit"
                    onPress={() => {
                      setEditing(item);
                      setParticipantDraftState(participantDraft(item, event));
                    }}
                  />
                  <Button
                    role="tertiary"
                    label="Remove"
                    onPress={() => setRemoving(item)}
                  />
                </View>
              </View>
            )}
          />
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
        <Button
          role="primary"
          label="Save changes"
          disabled={saving}
          onPress={() => void saveEvent()}
        />
      </ScrollView>
      <ContactPicker
        mode="multi"
        visible={pickerVisible}
        excludeContactIds={event.participants.map(
          (participant) => participant.contactId,
        )}
        onDismiss={() => setPickerVisible(false)}
        onConfirm={addSelected}
      />
      <RemoveParticipantSheet
        visible={removing !== null}
        participant={removing}
        onRequestClose={() => setRemoving(null)}
        onDelete={() => void removeParticipant(false)}
        onKeep={() => void removeParticipant(true)}
      />
      <Sheet
        visible={editing !== null}
        onRequestClose={() => setEditing(null)}
        variant="expanded"
      >
        {editing && participantDraftState ? (
          <View style={styles.inlineEditor}>
            <ParticipantOverrideEditor
              event={event}
              participant={editing}
              draft={participantDraftState}
              onChange={setParticipantDraftState}
            />
            <Button
              role="primary"
              label="Save participant"
              onPress={() => void saveParticipant()}
            />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  content: { padding: SPACING.base, gap: SPACING.base },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  field: { gap: SPACING.sm },
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
  participantRow: { gap: SPACING.xs, paddingVertical: SPACING.xs },
  rowActions: { flexDirection: "row", gap: SPACING.sm },
  inlineEditor: { gap: SPACING.base },
});
