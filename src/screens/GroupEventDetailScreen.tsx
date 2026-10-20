// biome-ignore-all lint/a11y/useValidAriaRole: Orbit Button/AppText `role` is a domain prop, not ARIA.
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { ContactPicker } from "@/components/ContactPicker";
import { ParticipantCard } from "@/components/group/ParticipantCard";
import { RemoveParticipantSheet } from "@/components/group/RemoveParticipantSheet";
import { InteractionDetail } from "@/components/history/InteractionDetail";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText, Button, ConfirmDialog, EmptyState } from "@/components/ui";
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
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { publishInteractionWrite } from "@/services/publish-interaction-write";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { formatDateTimeMinuteOrFallback } from "@/utils/dates";
import type { InFlightRef } from "@/utils/single-flight";
import {
  buildGroupEventDetailInteraction,
  closeThenOpenEventEditor,
  closeThenOpenParticipantEditor,
  closeThenOpenParticipantProfile,
  groupEventDurationLabel,
  resolveDetailParticipant,
} from "./group-event-detail-logic";
import {
  createGroupEventRefreshController,
  createParticipantAddAnnouncer,
  excludedParticipantIds,
  participantRemovedSnackbar,
  runParticipantAdd,
  runParticipantRemove,
  visibleParticipants,
} from "./group-event-refresh";

const DISSOLVE = {
  title: "Dissolve this event?",
  message:
    "Each participant's interaction is kept as an individual interaction. The event and its shared note are removed. The Group Note is not copied into anyone's note. Anything saved to a Things to Remember section stays on each person's Profile.",
  confirm: "Dissolve event",
};
const DELETE = {
  title: "Delete this event and all its interactions?",
  message:
    "This permanently deletes the event and every participant's interaction. This can't be undone and may change each contact's Status, Gravity, and Intensity. Anything saved to a Things to Remember section stays on each person's Profile.",
  confirm: "Delete Event & Interactions",
};

export function GroupEventDetailScreen({
  navigation,
  route,
}: RootStackScreenProps<"GroupEventDetail">) {
  const { colors } = useTheme();
  // The last item scrolls fully above the shell FAB (38.4 D-52, OA-E3).
  const bottomClearance = useBottomClearance();
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
  const [removePending, setRemovePending] = useState(false);
  const removeLatch = useRef<InFlightRef>({ current: false });
  // Committed removals not yet dropped by a successful refresh (A-WR-03).
  const [committedRemovedIds, setCommittedRemovedIds] = useState<
    readonly number[]
  >([]);
  // The sheet holds an id, never a participant snapshot (38.14 D-28).
  const [detailInteractionId, setDetailInteractionId] = useState<number | null>(
    null,
  );
  const [confirm, setConfirm] = useState<"dissolve" | "delete" | null>(null);

  // 38.14 D-84 (owner): adds confirm by name like Edit Event (D-67) — the
  // first readback after the commit names them; a failed one counts them.
  const announcer = useMemo(
    () =>
      createParticipantAddAnnouncer((label) =>
        showSnackbar({ kind: "success", label }),
      ),
    [],
  );
  const refreshController = useMemo(
    () =>
      createGroupEventRefreshController({
        read: () => readGroupEventDetail(getExecutor(), { groupEventId }),
        onRefreshed: (loaded) => {
          setEvent(loaded);
          setReadFailed(false);
          setCommittedPendingIds([]);
          setCommittedRemovedIds([]);
          announcer.settle(loaded);
        },
        onRefreshFailed: () => {
          setReadFailed(true);
          announcer.settle(null);
        },
      }),
    [groupEventId, announcer],
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
      onCommitted: () => {
        setCommittedPendingIds((current) => [
          ...new Set([...current, ...contactIds]),
        ]);
        // D-84: the readback that follows names them in a snackbar.
        announcer.queue(contactIds);
        // 38.14 D-81: a committed add tells the widget and the shell.
        publishInteractionWrite();
      },
      refresh,
    });
  // 38.3 review A-WR-03 (D-04): latched, and only a rejected first write shows
  // the write error. A committed remove hides its row until a successful
  // refresh, so a stale Remove/Edit can never target a child that is gone.
  const remove = async (keep: boolean) => {
    const target = removing;
    if (!target) return;
    setWriteError(false);
    setRemovePending(true);
    const result = await runParticipantRemove({
      latch: removeLatch.current,
      remove: () =>
        keep
          ? detachParticipant(getExecutor(), {
              groupEventId,
              interactionId: target.interactionId,
              now: localDateTime(),
            })
          : deleteGroupChild(getExecutor(), {
              groupEventId,
              interactionId: target.interactionId,
              contactId: target.contactId,
              now: localDateTime(),
            }),
      onCommitted: () => {
        setCommittedRemovedIds((current) =>
          current.includes(target.interactionId)
            ? current
            : [...current, target.interactionId],
        );
        setRemoving(null);
        // D-84: confirm by name; a delete reads as a destructive result
        // (38.10 D-132 / D-140 via D-14), as on Edit Event (D-67).
        showSnackbar({
          kind: keep ? "success" : "warning",
          label: participantRemovedSnackbar(target.contactName, !keep),
        });
        // 38.14 D-27: detach and delete both publish once committed.
        publishInteractionWrite();
      },
      onWriteFailed: () => {
        setRemoving(null);
        setWriteError(true);
      },
      refresh,
    });
    if (result !== "busy") setRemovePending(false);
  };
  const lifecycle = async () => {
    if (!confirm) return;
    setWriteError(false);
    try {
      if (confirm === "dissolve") {
        await dissolveGroupEvent(getExecutor(), {
          groupEventId,
          now: localDateTime(),
        });
        // 38.14 D-27: dissolve publishes once committed.
        publishInteractionWrite();
      } else {
        await deleteGroupEventAndInteractions(getExecutor(), {
          groupEventId,
          now: localDateTime(),
        });
        // 38.14 D-27: delete event publishes once committed.
        publishInteractionWrite();
      }
      setConfirm(null);
      navigation.goBack();
    } catch {
      setConfirm(null);
      setWriteError(true);
    }
  };
  // D-28: re-derived from the refreshed event on every render; null once the
  // participant left the event or their remove committed.
  const detail = resolveDetailParticipant(
    event,
    committedRemovedIds,
    detailInteractionId,
  );
  const detailGone = detailInteractionId !== null && detail === null;
  useEffect(() => {
    // The sheet closes when its participant is gone.
    if (detailGone) setDetailInteractionId(null);
  }, [detailGone]);
  const closeDetail = () => setDetailInteractionId(null);
  const interaction =
    detail && event ? buildGroupEventDetailInteraction(event, detail) : null;
  const confirmCopy = confirm === "dissolve" ? DISSOLVE : DELETE;
  const cardColors = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  };

  if (!event)
    return (
      <View style={styles.center}>
        {loadFailed ? (
          <AppText role="body" style={{ color: colors.danger }}>
            Couldn't load this event.
          </AppText>
        ) : (
          <ActivityIndicator color={colors.accentText} />
        )}
      </View>
    );
  return (
    // No page fill: the background art shows through, and the event summary,
    // the empty state and every participant are full (opaque `surface`) cards
    // over it (38.5, owner 2026-09-29).
    <View style={styles.root}>
      <ShellAppBar
        variant="child"
        title="Event"
        // D-71: Edit Event and Add participants are visible buttons in the
        // summary; the ⋯ keeps only the careful actions.
        overflow={[
          { label: "Dissolve", onPress: () => setConfirm("dissolve") },
          {
            label: "Delete Event & Interactions",
            onPress: () => setConfirm("delete"),
          },
        ]}
      />
      <FlatList
        data={visibleParticipants(event, committedRemovedIds)}
        keyExtractor={(item) => String(item.interactionId)}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomClearance },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={[styles.card, cardColors]}>
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
                  Couldn't update this event. Please try again.
                </AppText>
              ) : null}
              {/* RG-038 (ui-accessibility/AUD-UIA-018, D-07): display-only minute
                precision; the edit flow keeps the stored value. */}
              <DetailField
                label="When"
                value={formatDateTimeMinuteOrFallback(event.occurredAt)}
              />
              <DetailField label="Channel" value={event.channel} />
              <DetailField label="Tone" value={event.quality} />
              <DetailField
                label="Duration"
                value={groupEventDurationLabel(event.duration)}
              />
              <DetailField label="Group Note" value={event.groupNote} />
              <View style={styles.actions}>
                <Button
                  role="secondary"
                  label="Edit Event"
                  onPress={() =>
                    navigation.navigate("EditGroupEvent", { groupEventId })
                  }
                />
                <Button
                  role="secondary"
                  label="Add participants"
                  onPress={() => setPickerVisible(true)}
                />
              </View>
            </View>
            <AppText role="label">Participants</AppText>
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.card, cardColors]}>
            {/* The one empty state (38.9 D-20) with its one action (D-71). */}
            <EmptyState
              testID="event-participants-empty"
              icon="group-events"
              heading="No participants yet"
              body="Add the people who were at this event."
              action={{
                label: "Add participants",
                onPress: () => setPickerVisible(true),
              }}
            />
          </View>
        }
        renderItem={({ item }) => (
          <ParticipantCard
            event={event}
            participant={item}
            onPress={() => setDetailInteractionId(item.interactionId)}
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
        title="Add participants: choose contacts"
        excludeContactIds={excludedIds}
        onDismiss={() => setPickerVisible(false)}
        onConfirm={addSelected}
      />
      <RemoveParticipantSheet
        visible={removing !== null}
        participant={removing}
        busy={removePending}
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
          onRequestClose={closeDetail}
          interaction={interaction}
          contactId={detail.contactId}
          // B-CR-01: every route off the modal sheet closes it before the
          // push, or the pushed editor opens hidden under the sheet.
          onEdit={() =>
            closeThenOpenParticipantEditor({
              close: closeDetail,
              navigate: navigation.navigate,
              groupEventId,
              interactionId: detail.interactionId,
              contactId: detail.contactId,
            })
          }
          onViewProfile={() =>
            closeThenOpenParticipantProfile({
              close: closeDetail,
              navigate: navigation.navigate,
              contactId: detail.contactId,
            })
          }
          // D-30: no View Event while already on this event.
          onEditGroupEvent={() =>
            closeThenOpenEventEditor({
              close: closeDetail,
              navigate: navigation.navigate,
              groupEventId,
            })
          }
          onEditParticipant={() =>
            closeThenOpenParticipantEditor({
              close: closeDetail,
              navigate: navigation.navigate,
              groupEventId,
              interactionId: detail.interactionId,
              contactId: detail.contactId,
            })
          }
          onDeleted={() => {
            closeDetail();
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
  // Matches the Events list row card.
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.md,
    gap: SPACING.md,
    padding: SPACING.base,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  inlineError: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
});
