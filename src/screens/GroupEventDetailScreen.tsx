// biome-ignore-all lint/a11y/useValidAriaRole: Orbit Button/AppText `role` is a domain prop, not ARIA.
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { ContactPicker } from "@/components/ContactPicker";
import { ParticipantCard } from "@/components/group/ParticipantCard";
import { RemoveParticipantSheet } from "@/components/group/RemoveParticipantSheet";
import { InteractionDetail } from "@/components/history/InteractionDetail";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText, Button, ConfirmDialog } from "@/components/ui";
import { getExecutor, localDateTime } from "@/db/database";
import {
  addParticipants,
  deleteGroupChild,
  deleteGroupEventAndInteractions,
  detachParticipant,
  dissolveGroupEvent,
} from "@/db/group-events-dao";
import {
  type GroupEventDetail,
  type GroupEventParticipant,
  readGroupEventDetail,
} from "@/db/group-events-read";
import { newUid } from "@/db/uid";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import {
  buildGroupEventDetailInteraction,
  closeThenOpenParticipantProfile,
  groupEventDurationLabel,
} from "./group-event-detail-logic";
import {
  createGroupEventRefreshController,
  excludedParticipantIds,
  runParticipantAdd,
} from "./group-event-refresh";

const DISSOLVE = {
  title: "Dissolve this group event?",
  message:
    "Each participant's interaction is kept as an individual interaction. The group and its shared note are removed. The Group Note is not copied into anyone's note.",
  confirm: "Dissolve group event",
};
const DELETE = {
  title: "Delete this group event and all its interactions?",
  message:
    "This permanently deletes the group event and every participant's interaction. This can't be undone and may change each contact's Status, Gravity, and Intensity.",
  confirm: "Delete group & interactions",
};

export function GroupEventDetailScreen({
  navigation,
  route,
}: RootStackScreenProps<"GroupEventDetail">) {
  const { colors } = useTheme();
  const { groupEventId } = route.params;
  const [event, setEvent] = useState<GroupEventDetail | null>(null);
  // One read-failure flag, split by whether an event is already on screen:
  // no event → the full "Couldn't load" view; an event → an inline refresh
  // row whose Retry only re-reads (38.3 D-19).
  const [readFailed, setReadFailed] = useState(false);
  const loadFailed = event === null && readFailed;
  const refreshFailed = event !== null && readFailed;
  // A remove/dissolve/delete write that actually rejected.
  const [writeError, setWriteError] = useState(false);
  const [committedPendingIds, setCommittedPendingIds] = useState<
    readonly number[]
  >([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [removing, setRemoving] = useState<GroupEventParticipant | null>(null);
  const [detail, setDetail] = useState<GroupEventParticipant | null>(null);
  const [confirm, setConfirm] = useState<"dissolve" | "delete" | null>(null);

  const refreshController = useMemo(
    () =>
      createGroupEventRefreshController({
        read: () => readGroupEventDetail(getExecutor(), { groupEventId }),
        onRefreshed: (loaded) => {
          setEvent(loaded);
          setReadFailed(false);
          setCommittedPendingIds([]);
        },
        onRefreshFailed: () => setReadFailed(true),
      }),
    [groupEventId],
  );
  useEffect(() => () => refreshController.invalidate(), [refreshController]);
  const refresh = refreshController.refresh;
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const excludedIds = useMemo(
    () => excludedParticipantIds(event, committedPendingIds),
    [event, committedPendingIds],
  );

  // Picker owner: only a rejected write reports failure (D-19, D-04).
  const addSelected = (contactIds: number[]) =>
    runParticipantAdd({
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
        setCommittedPendingIds((current) => [
          ...new Set([...current, ...contactIds]),
        ]),
      refresh,
    });
  const remove = async (keep: boolean) => {
    if (!removing) return;
    setWriteError(false);
    try {
      if (keep)
        await detachParticipant(getExecutor(), {
          groupEventId,
          interactionId: removing.interactionId,
          now: localDateTime(),
        });
      else
        await deleteGroupChild(getExecutor(), {
          groupEventId,
          interactionId: removing.interactionId,
          contactId: removing.contactId,
          now: localDateTime(),
        });
    } catch {
      setRemoving(null);
      setWriteError(true);
      return;
    }
    setRemoving(null);
    void refresh();
  };
  const lifecycle = async () => {
    if (!confirm) return;
    setWriteError(false);
    try {
      if (confirm === "dissolve")
        await dissolveGroupEvent(getExecutor(), {
          groupEventId,
          now: localDateTime(),
        });
      else
        await deleteGroupEventAndInteractions(getExecutor(), {
          groupEventId,
          now: localDateTime(),
        });
      setConfirm(null);
      navigation.goBack();
    } catch {
      setConfirm(null);
      setWriteError(true);
    }
  };
  const interaction =
    detail && event ? buildGroupEventDetailInteraction(event, detail) : null;
  const confirmCopy = confirm === "dissolve" ? DISSOLVE : DELETE;

  if (!event)
    return (
      <View style={styles.center}>
        {loadFailed ? (
          <AppText role="body" style={{ color: colors.danger }}>
            Couldn't load this group event.
          </AppText>
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </View>
    );
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ShellAppBar
        variant="child"
        title="Group Event"
        overflow={[
          {
            label: "Edit Group Event",
            onPress: () =>
              navigation.navigate("EditGroupEvent", { groupEventId }),
          },
          { label: "Add Participant", onPress: () => setPickerVisible(true) },
          { label: "Dissolve", onPress: () => setConfirm("dissolve") },
          {
            label: "Delete Group Event & Interactions",
            onPress: () => setConfirm("delete"),
          },
        ]}
      />
      <FlatList
        data={event.participants}
        keyExtractor={(item) => String(item.interactionId)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText role="heading">{event.title}</AppText>
            {refreshFailed ? (
              <View style={styles.inlineError}>
                <AppText role="caption" style={{ color: colors.danger }}>
                  Couldn't refresh this event
                </AppText>
                <Button
                  role="tertiary"
                  label="Retry"
                  accessibilityLabel="Retry refreshing this event"
                  onPress={() => void refresh()}
                />
              </View>
            ) : null}
            {writeError ? (
              <AppText role="caption" style={{ color: colors.danger }}>
                Couldn't update this group event. Please try again.
              </AppText>
            ) : null}
            <DetailField label="When" value={event.occurredAt} />
            <DetailField label="Channel" value={event.channel} />
            <DetailField label="Tone" value={event.quality} />
            <DetailField
              label="Duration"
              value={groupEventDurationLabel(event.duration)}
            />
            <DetailField label="Group Note" value={event.groupNote} />
            <AppText role="label">Participants</AppText>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppText role="heading">No participants yet</AppText>
            <AppText role="body" style={{ color: colors.textSecondary }}>
              Add the people who were there — or save now and add them later.
            </AppText>
          </View>
        }
        renderItem={({ item }) => (
          <ParticipantCard
            event={event}
            participant={item}
            onPress={() => setDetail(item)}
            onEdit={() =>
              navigation.navigate("EditParticipant", {
                groupEventId,
                interactionId: item.interactionId,
                contactId: item.contactId,
              })
            }
            onRemove={() => setRemoving(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
      />
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
        onDelete={() => void remove(false)}
        onKeep={() => void remove(true)}
      />
      <ConfirmDialog
        visible={confirm !== null}
        destructive
        title={confirmCopy.title}
        message={confirmCopy.message}
        confirmLabel={confirmCopy.confirm}
        onConfirm={() => void lifecycle()}
        onRequestClose={() => setConfirm(null)}
      />
      {interaction && detail ? (
        <InteractionDetail
          visible
          onRequestClose={() => setDetail(null)}
          interaction={interaction}
          contactId={detail.contactId}
          onEdit={() =>
            navigation.navigate("EditParticipant", {
              groupEventId,
              interactionId: detail.interactionId,
              contactId: detail.contactId,
            })
          }
          onViewProfile={() =>
            closeThenOpenParticipantProfile({
              close: () => setDetail(null),
              navigate: navigation.navigate,
              contactId: detail.contactId,
            })
          }
          onViewGroupEvent={() => setDetail(null)}
          onEditGroupEvent={() =>
            navigation.navigate("EditGroupEvent", { groupEventId })
          }
          onEditParticipant={() =>
            navigation.navigate("EditParticipant", {
              groupEventId,
              interactionId: detail.interactionId,
              contactId: detail.contactId,
            })
          }
          onDeleted={() => {
            setDetail(null);
            void refresh();
          }}
        />
      ) : null}
    </View>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return value ? (
    <View style={styles.field}>
      <AppText role="caption">{label}</AppText>
      <AppText role="body">{value}</AppText>
    </View>
  ) : null;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  content: { padding: SPACING.base },
  header: { gap: SPACING.md, paddingBottom: SPACING.base },
  field: { gap: SPACING.xs },
  empty: { gap: SPACING.sm, paddingVertical: SPACING.lg },
  inlineError: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
});
