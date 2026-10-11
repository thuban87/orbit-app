// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button and AppText use a
// domain-specific semantic `role` prop, not a web ARIA role.
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import {
  type ParticipantEditDraft,
  ParticipantOverrideEditor,
  participantDraft,
} from "@/components/group/ParticipantOverrideEditor";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText, Button } from "@/components/ui";
import { getExecutor, localDateTime } from "@/db/database";
import { saveParticipantEdits } from "@/db/group-events-dao";
import {
  type GroupEventDetail,
  type GroupEventParticipant,
  readGroupEventDetail,
} from "@/db/group-events-read";
import {
  buildParticipantFieldPatch,
  buildParticipantFollowPatch,
} from "@/logic/group-participant-patch";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import type { RootStackScreenProps } from "@/navigation/types";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { beginInFlight, endInFlight } from "@/utils/single-flight";

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
  // Synchronous in-flight flag: `saving` state lags a render, so the guard
  // reads this ref to hold Back while the save runs (fix-pass WR-02).
  const savingRef = useRef(false);
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
        setError("This participant is no longer part of the event.");
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
  // A save in flight holds every exit, with no prompt (fix-pass WR-02).
  useDiscardKeepGuard({ hasUnsavedChanges, bypassRef, busyRef: savingRef });

  async function save() {
    if (!loaded || !draft || !beginInFlight(savingRef)) return;
    setSaving(true);
    setError(null);
    const initial = loaded.draft;
    const follow = buildParticipantFollowPatch(initial, draft);
    const fields = buildParticipantFieldPatch(initial, draft);
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
      endInFlight(savingRef);
    }
  }

  if (!loaded || !draft) {
    return (
      <View style={styles.root}>
        <ShellAppBar variant="child" title="Edit participant" />
        <View style={styles.loading}>
          {error ? (
            <AppText role="body" style={{ color: colors.danger }}>
              {error}
            </AppText>
          ) : (
            <ActivityIndicator color={colors.accentText} />
          )}
        </View>
      </View>
    );
  }

  // House header (38.9 D-16, D-44) with the person line from the loaded
  // participant (D-45); its Back calls goBack, which the guard above intercepts
  // (D-13). While a save runs the guard holds Back, so it draws disabled
  // (D-26; WR-02). No opaque screen fill: the theme art shows (D-17).
  return (
    <View style={styles.root}>
      <ShellAppBar
        variant="child"
        title="Edit participant"
        backDisabled={saving}
        person={{
          name: loaded.participant.contactName,
          photo: loaded.participant.contactPhoto,
          contactId: loaded.participant.contactId,
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  content: { padding: SPACING.base, gap: SPACING.base },
});
