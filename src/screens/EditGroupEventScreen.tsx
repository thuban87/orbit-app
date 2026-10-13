// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button and AppText use a
// domain-specific semantic `role` prop, not a web ARIA role.
/**
 * Edit Event. 38.10:
 * - The Group Note is NOT pre-checked (D-113; convergence c1 F-U13): clearing
 *   it saves through the normal event save, and the DAO detaches its copies
 *   in the same transaction. No error, confirm or message for it.
 * - The per-participant editor refuses clearing a participant's OWN note while
 *   it is also saved to a section (Research Q4; checker cycle 2 W-13): an
 *   inline error under the note, inside the Sheet (docs/systems/
 *   ux-standards.md "Validation errors inside a sheet render inline"). Its
 *   "Save participant" is single-flight on its own ref (38.9 standards via
 *   D-19; convergence c11, Claude C-10).
 */
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
import { ShellAppBar } from "@/components/ShellAppBar";
import { TouchpointRefineForm } from "@/components/TouchpointRefineForm";
import { AppText, Button, Sheet } from "@/components/ui";
import {
  clearFieldError,
  type FieldErrors,
  toFieldErrors,
} from "@/components/ui/field-error-logic";
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
import { readOwnNoteLinkedSection } from "@/db/interaction-edit-read";
import { LinkedNoteBlankError } from "@/db/linked-entry-dao";
import { newUid } from "@/db/uid";
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
import { createLatestRequestAuthority } from "@/utils/latest-request";
import {
  beginInFlight,
  endInFlight,
  type InFlightRef,
} from "@/utils/single-flight";
import {
  createGroupEventRefreshController,
  eventDraft,
  excludedParticipantIds,
  groupEventEditReducer,
  initialGroupEventEditState,
  isGroupEventDraftDirty,
  runParticipantAdd,
  runParticipantRemove,
  visibleParticipants,
} from "./group-event-refresh";

const GROUP_FUTURE_DATE_MESSAGE = "Events can't be in the future.";

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
  const [removePending, setRemovePending] = useState(false);
  const removeLatch = useRef<InFlightRef>({ current: false });
  const [saving, setSaving] = useState(false);
  // Synchronous in-flight flag for the event Save: `saving` state lags a
  // render, so the guard reads this ref to hold Back (fix-pass WR-02).
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const bypassRef = useRef(false);
  // "Save participant" single-flight (convergence c11, Claude C-10; this plan
  // only): its own ref, separate from the event save's `savingRef`, mirrored
  // in state for the disabled look.
  const participantSavingRef = useRef(false);
  const [participantSaving, setParticipantSaving] = useState(false);
  // Inline errors in the participant Sheet (Research Q4; 38.9 D-19).
  const [participantFieldErrors, setParticipantFieldErrors] =
    useState<FieldErrors>({});

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
  // The event save in flight holds every exit, with no prompt (fix-pass WR-02).
  const { settleHold } = useDiscardKeepGuard({
    hasUnsavedChanges,
    bypassRef,
    busyRef: savingRef,
  });
  const excludedIds = useMemo(
    () => excludedParticipantIds(event, state.committedPendingIds),
    [event, state.committedPendingIds],
  );

  async function saveEvent() {
    if (!event || !draft || !beginInFlight(savingRef)) return;
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
      setError("Couldn't update the event. Your changes weren't saved.");
    } finally {
      setSaving(false);
      endInFlight(savingRef);
      settleHold();
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
      onCommitted: () => {
        // A stale failure must not sit beside a fresh success (A-WR-04, D-04).
        setError(null);
        dispatch({ type: "participantsCommitted", contactIds });
      },
      refresh: refreshEvent,
    });
  }

  // 38.3 review A-WR-03 (D-04): latched, and only a rejected first write is
  // "not saved". A committed remove hides its row until a successful refresh,
  // so a stale Edit/Remove can never target a child that is gone.
  async function removeParticipant(keep: boolean) {
    const target = removing;
    if (!target) return;
    setError(null);
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
        dispatch({
          type: "participantRemoved",
          interactionId: target.interactionId,
        });
        setRemoving(null);
      },
      onWriteFailed: () =>
        setError("Couldn't update the event. Your changes weren't saved."),
      refresh: refreshEvent,
    });
    if (result !== "busy") setRemovePending(false);
  }

  async function saveParticipant() {
    if (!editing || !participantDraftState || !event) return;
    if (!beginInFlight(participantSavingRef)) return;
    setParticipantSaving(true);
    const initial = participantDraft(editing, event);
    const draftParticipant = participantDraftState;
    setError(null);
    try {
      // Q4 pre-check, inside the guarded save: the participant's own note,
      // blank while also saved to a section, is refused under the field. A
      // Group Note copy never blocks (D-113).
      if (!canAlsoSave(draftParticipant.value.note)) {
        const section = await readOwnNoteLinkedSection(
          getExecutor(),
          editing.interactionId,
        );
        if (section !== null) {
          setParticipantFieldErrors(
            toFieldErrors([
              { field: "note", message: linkedNoteBlankMessage(section) },
            ]),
          );
          return;
        }
      }
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
      setParticipantFieldErrors({});
      void refreshEvent();
    } catch (err) {
      if (err instanceof LinkedNoteBlankError) {
        // The DAO's own refusal (fails closed): the same error under the note.
        const section = await readOwnNoteLinkedSection(
          getExecutor(),
          editing.interactionId,
        ).catch(() => null);
        setParticipantFieldErrors(
          toFieldErrors([
            { field: "note", message: linkedNoteBlankMessage(section) },
          ]),
        );
        return;
      }
      setError("Couldn't save this participant. Please try again.");
    } finally {
      setParticipantSaving(false);
      endInFlight(participantSavingRef);
    }
  }

  // House header (38.9 D-16, D-44): its Back calls goBack, which the
  // unsaved-work guard above intercepts (D-13). While the event save runs the
  // guard holds Back, so it draws disabled (D-26; WR-02).
  const header = (
    <ShellAppBar variant="child" title="Edit Event" backDisabled={saving} />
  );

  if (!event || !draft) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.loading}>
          {state.loadError ? (
            <AppText role="body" style={{ color: colors.danger }}>
              Couldn't load this event. Please go back and retry.
            </AppText>
          ) : (
            <ActivityIndicator color={colors.accentText} />
          )}
        </View>
      </View>
    );
  }

  // No opaque screen fill: pushed screens show the theme art (38.9 D-17).
  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={styles.content}>
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
          <FlatList
            data={visibleParticipants(event, state.committedRemovedIds)}
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
                      setParticipantFieldErrors({});
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
        busy={removePending}
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
              onChange={(next) => {
                // Editing the note clears its error (38.9 D-19).
                if (next.value.note !== participantDraftState.value.note) {
                  setParticipantFieldErrors((errors) =>
                    clearFieldError(errors, "note"),
                  );
                }
                setParticipantDraftState(next);
              }}
              noteError={participantFieldErrors.note ?? null}
            />
            <Button
              role="primary"
              label="Save participant"
              disabled={participantSaving}
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
