// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button and AppText use a
// domain-specific semantic `role` prop, not a web ARIA role.
/**
 * Edit participant (a `linkedEntryRoute` target). 38.10 Research Q4 (checker
 * cycle 2 W-13): clearing this participant's OWN note while it is also saved
 * to a section is refused with an inline error under the note naming the
 * section, and nothing is saved. A Group Note copy never blocks (D-113). The
 * pre-check runs inside the guarded save; the DAO's `LinkedNoteBlankError`
 * maps to the same error; every other failure keeps the generic message.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import {
  type ParticipantEditDraft,
  ParticipantOverrideEditor,
  participantDraft,
} from "@/components/group/ParticipantOverrideEditor";
import { ShellAppBar } from "@/components/ShellAppBar";
import { AppText, Button } from "@/components/ui";
import {
  clearFieldError,
  type FieldErrors,
  toFieldErrors,
} from "@/components/ui/field-error-logic";
import { getExecutor, localDateTime } from "@/db/database";
import { saveParticipantEdits } from "@/db/group-events-dao";
import {
  type GroupEventDetail,
  type GroupEventParticipant,
  readGroupEventDetail,
} from "@/db/group-events-read";
import { readOwnNoteLinkedSection } from "@/db/interaction-edit-read";
import { LinkedNoteBlankError } from "@/db/linked-entry-dao";
import {
  canAlsoSave,
  linkedNoteBlankMessage,
} from "@/logic/also-save-to-logic";
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
  // Inline field errors (38.9 D-19): the note's linked-blank refusal (Q4).
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
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
  const { settleHold } = useDiscardKeepGuard({
    hasUnsavedChanges,
    bypassRef,
    busyRef: savingRef,
  });

  async function save() {
    if (!loaded || !draft || !beginInFlight(savingRef)) return;
    setSaving(true);
    setError(null);
    const initial = loaded.draft;
    const follow = buildParticipantFollowPatch(initial, draft);
    const fields = buildParticipantFieldPatch(initial, draft);
    try {
      // Q4 pre-check, inside the guarded save: this participant's own note,
      // blank while also saved to a section, is refused under the field.
      if (!canAlsoSave(draft.value.note)) {
        const section = await readOwnNoteLinkedSection(
          getExecutor(),
          interactionId,
        );
        if (section !== null) {
          setFieldErrors(
            toFieldErrors([
              { field: "note", message: linkedNoteBlankMessage(section) },
            ]),
          );
          return;
        }
      }
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
    } catch (err) {
      if (err instanceof LinkedNoteBlankError) {
        // The DAO's own refusal (fails closed): the same error under the note.
        const section = await readOwnNoteLinkedSection(
          getExecutor(),
          interactionId,
        ).catch(() => null);
        setFieldErrors(
          toFieldErrors([
            { field: "note", message: linkedNoteBlankMessage(section) },
          ]),
        );
        return;
      }
      setError("Couldn't save this participant. Please try again.");
    } finally {
      setSaving(false);
      endInFlight(savingRef);
      settleHold();
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
          onChange={(next) => {
            // Editing the note clears its error (38.9 D-19).
            if (next.value.note !== draft.value.note) {
              setFieldErrors((errors) => clearFieldError(errors, "note"));
            }
            setDraft(next);
          }}
          noteError={fieldErrors.note ?? null}
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
