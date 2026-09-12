// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button and AppText use a
// domain-specific semantic `role` prop, not a web ARIA role.
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import {
  type ParticipantEditDraft,
  ParticipantOverrideEditor,
  participantDraft,
} from "@/components/group/ParticipantOverrideEditor";
import { AppText, Button } from "@/components/ui";
import { getExecutor, localDateTime } from "@/db/database";
import { saveParticipantEdits } from "@/db/group-events-dao";
import {
  type GroupEventDetail,
  type GroupEventParticipant,
  readGroupEventDetail,
} from "@/db/group-events-read";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

interface LoadedParticipant {
  event: GroupEventDetail;
  participant: GroupEventParticipant;
  draft: ParticipantEditDraft;
}

export function EditParticipantScreen({
  navigation,
  route,
}: RootStackScreenProps<"EditParticipant">) {
  const { colors } = useTheme();
  const { groupEventId, interactionId, contactId } = route.params;
  const [loaded, setLoaded] = useState<LoadedParticipant | null>(null);
  const [draft, setDraft] = useState<ParticipantEditDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const baselineRef = useRef<string | null>(null);
  const bypassRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const event = await readGroupEventDetail(getExecutor(), { groupEventId });
      const participant = event?.participants.find(
        (row) =>
          row.interactionId === interactionId && row.contactId === contactId,
      );
      if (!event || !participant) {
        setError("This participant is no longer part of the group event.");
        return;
      }
      const nextDraft = participantDraft(participant, event);
      baselineRef.current = JSON.stringify(nextDraft);
      setLoaded({ event, participant, draft: nextDraft });
      setDraft(nextDraft);
    } catch {
      setError("Couldn't load this participant. Please go back and retry.");
    }
  }, [contactId, groupEventId, interactionId]);

  useEffect(() => {
    void load();
  }, [load]);
  const hasUnsavedChanges =
    draft !== null && JSON.stringify(draft) !== baselineRef.current;
  useDiscardKeepGuard({ hasUnsavedChanges, bypassRef });

  async function save() {
    if (!loaded || !draft || saving) return;
    setSaving(true);
    setError(null);
    const initial = loaded.draft;
    const follow = {
      ...(draft.follow.channel !== initial.follow.channel
        ? {
            channel: draft.follow.channel
              ? { follow: true as const }
              : { follow: false as const, value: draft.value.channel },
          }
        : {}),
      ...(draft.follow.quality !== initial.follow.quality
        ? {
            quality: draft.follow.quality
              ? { follow: true as const }
              : { follow: false as const, value: draft.value.quality },
          }
        : {}),
      ...(draft.follow.duration !== initial.follow.duration
        ? {
            duration: draft.follow.duration
              ? { follow: true as const }
              : { follow: false as const, value: draft.value.duration },
          }
        : {}),
    };
    const fields = {
      ...(draft.value.direction !== initial.value.direction
        ? { direction: draft.value.direction }
        : {}),
      ...(draft.value.connected !== initial.value.connected
        ? { connected: draft.value.connected }
        : {}),
      ...(draft.value.note !== initial.value.note
        ? { note: draft.value.note }
        : {}),
    };
    try {
      await saveParticipantEdits(getExecutor(), {
        interactionId,
        contactId,
        groupEventId,
        now: localDateTime(),
        follow,
        fields,
      });
      bypassRef.current = true;
      navigation.goBack();
    } catch {
      setError("Couldn't save this participant. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded || !draft) {
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
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Button
          role="secondary"
          label="Back"
          onPress={() => navigation.goBack()}
        />
        <AppText role="heading">Edit participant</AppText>
      </View>
      <ParticipantOverrideEditor
        event={loaded.event}
        participant={loaded.participant}
        draft={draft}
        onChange={setDraft}
      />
      {error ? (
        <AppText role="caption" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}
      <Button
        role="primary"
        label="Save changes"
        disabled={saving}
        onPress={() => void save()}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  content: { padding: SPACING.base, gap: SPACING.base },
  header: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
});
