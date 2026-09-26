// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button and AppText use a
// domain-specific semantic `role` prop, not a web ARIA role.
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
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
import { TouchpointRefineForm } from "@/components/TouchpointRefineForm";
import { AppText, Button, Sheet } from "@/components/ui";
import { getExecutor, localDateTime } from "@/db/database";
import {
  addParticipants,
  deleteGroupChild,
  detachParticipant,
  saveParticipantEdits,
  updateGroupEvent,
} from "@/db/group-events-dao";
import {
  type GroupEventParticipant,
  readGroupEventDetail,
} from "@/db/group-events-read";
import { newUid } from "@/db/uid";
import {
  buildParticipantFieldPatch,
  buildParticipantFollowPatch,
} from "@/logic/group-participant-patch";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { createLatestRequestAuthority } from "@/utils/latest-request";
import {
  createGroupEventRefreshController,
  eventDraft,
  excludedParticipantIds,
  groupEventEditReducer,
  initialGroupEventEditState,
  isGroupEventDraftDirty,
  runParticipantAdd,
} from "./group-event-refresh";

const GROUP_FUTURE_DATE_MESSAGE = "Group events can't be in the future.";

export function EditGroupEventScreen({
  navigation,
  route,
}: RootStackScreenProps<"EditGroupEvent">) {
  const { colors } = useTheme();
  const { groupEventId } = route.params;
  const [state, dispatch] = useReducer(
    groupEventEditReducer,
    initialGroupEventEditState,
  );
  const { event, draft } = state;
  const [editing, setEditing] = useState<GroupEventParticipant | null>(null);
  const [participantDraftState, setParticipantDraftState] =
    useState<ParticipantEditDraft | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [removing, setRemoving] = useState<GroupEventParticipant | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bypassRef = useRef(false);

  // Mount-only seed: the ONE path that sets the draft and its baseline (D-17).
  useEffect(() => {
    const authority = createLatestRequestAuthority();
    const token = authority.begin();
    const loadInitial = async () => {
      try {
        const loaded = await readGroupEventDetail(getExecutor(), {
          groupEventId,
        });
        if (!authority.isCurrent(token)) return;
        dispatch(
          loaded
            ? { type: "initialLoaded", event: loaded }
            : { type: "initialLoadFailed" },
        );
      } catch {
        if (authority.isCurrent(token)) dispatch({ type: "initialLoadFailed" });
      }
    };
    void loadInitial();
    return () => authority.invalidate();
  }, [groupEventId]);

  // Post-commit readback replaces the saved `event` only; never the draft.
  const refreshController = useMemo(
    () =>
      createGroupEventRefreshController({
        read: () => readGroupEventDetail(getExecutor(), { groupEventId }),
        onRefreshed: (refreshed) =>
          dispatch({ type: "eventRefreshed", event: refreshed }),
        onRefreshFailed: () => dispatch({ type: "refreshFailed" }),
      }),
    [groupEventId],
  );
  useEffect(() => () => refreshController.invalidate(), [refreshController]);
  const refreshEvent = refreshController.refresh;

  const hasUnsavedChanges = isGroupEventDraftDirty(state);
  useDiscardKeepGuard({ hasUnsavedChanges, bypassRef });
  const excludedIds = useMemo(
    () => excludedParticipantIds(event, state.committedPendingIds),
    [event, state.committedPendingIds],
  );

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

  // Picker owner: only a rejected write reports failure (D-19, D-04).
  function addSelected(contactIds: number[]) {
    return runParticipantAdd({
      add: () =>
        addParticipants(getExecutor(), {
          groupEventId,
          participants: contactIds.map((contactId) => ({
            contactId,
            uid: newUid(),
          })),
          now: localDateTime(),
        }),
      onCommitted: () =>
        dispatch({ type: "participantsCommitted", contactIds }),
      refresh: refreshEvent,
    });
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
      void refreshEvent();
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
        follow: buildParticipantFollowPatch(initial, draftParticipant),
        fields: buildParticipantFieldPatch(initial, draftParticipant),
      });
      setEditing(null);
      setParticipantDraftState(null);
      void refreshEvent();
    } catch {
      setError("Couldn't save this participant. Please try again.");
    }
  }

  if (!event || !draft) {
    return (
      <View style={styles.loading}>
        {state.loadError ? (
          <AppText role="body" style={{ color: colors.danger }}>
            Couldn't load this group event. Please go back and retry.
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
            dispatch({ type: "draftChanged", draft: { ...draft, value } })
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
              dispatch({ type: "draftChanged", draft: { ...draft, groupNote } })
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
        {state.refreshError ? (
          <View style={styles.refreshError}>
            <AppText role="caption" style={{ color: colors.danger }}>
              Couldn't refresh this event
            </AppText>
            <Button
              role="tertiary"
              label="Retry"
              accessibilityLabel="Retry refreshing this event"
              onPress={() => void refreshEvent()}
            />
          </View>
        ) : null}
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
        excludeContactIds={excludedIds}
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
  refreshError: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
});
