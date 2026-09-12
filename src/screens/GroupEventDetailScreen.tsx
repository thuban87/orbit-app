// biome-ignore-all lint/a11y/useValidAriaRole: Orbit Button/AppText `role` is a domain prop, not ARIA.
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { ContactPicker } from "@/components/ContactPicker";
import { ParticipantCard } from "@/components/group/ParticipantCard";
import { RemoveParticipantSheet } from "@/components/group/RemoveParticipantSheet";
import { InteractionDetail } from "@/components/history/InteractionDetail";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText, ConfirmDialog } from "@/components/ui";
import { getExecutor, localDateTime } from "@/db/database";
import {
  addParticipant,
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
  const [failed, setFailed] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [removing, setRemoving] = useState<GroupEventParticipant | null>(null);
  const [detail, setDetail] = useState<GroupEventParticipant | null>(null);
  const [confirm, setConfirm] = useState<"dissolve" | "delete" | null>(null);

  const load = useCallback(async () => {
    try {
      setEvent(await readGroupEventDetail(getExecutor(), { groupEventId }));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [groupEventId]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const addSelected = async (contactIds: number[]) => {
    setPickerVisible(false);
    try {
      for (const contactId of contactIds)
        await addParticipant(getExecutor(), {
          groupEventId,
          contactId,
          uid: newUid(),
          now: localDateTime(),
        });
      await load();
    } catch {
      setFailed(true);
    }
  };
  const remove = async (keep: boolean) => {
    if (!removing) return;
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
      setRemoving(null);
      await load();
    } catch {
      setFailed(true);
    }
  };
  const lifecycle = async () => {
    if (!confirm) return;
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
      setFailed(true);
    }
  };
  const interaction =
    detail && event
      ? {
          id: detail.interactionId,
          occurredAt: event.occurredAt,
          date: event.occurredAt.slice(0, 10),
          channel: detail.channel,
          direction: detail.direction,
          connected: detail.connected,
          quality: detail.quality,
          note: detail.note,
          duration: detail.duration,
          allowAi: 0,
          groupEventId: event.id,
          groupTitle: event.title,
          groupNote: event.groupNote,
          groupLinked: true,
        }
      : null;
  const confirmCopy = confirm === "dissolve" ? DISSOLVE : DELETE;

  if (!event)
    return (
      <View style={styles.center}>
        {failed ? (
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
            <DetailField label="When" value={event.occurredAt} />
            <DetailField label="Channel" value={event.channel} />
            <DetailField label="Tone" value={event.quality} />
            <DetailField
              label="Duration"
              value={event.duration == null ? null : `${event.duration} min`}
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
          onDeleted={() => {
            setDetail(null);
            void load();
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
});
