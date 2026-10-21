// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button and AppText use a
// domain-specific semantic `role` prop, not a web ARIA role.
/**
 * Edit Event. 38.10 D-113 (convergence c1 F-U13): the Group Note is NOT
 * pre-checked: clearing it saves through the normal event save, and the DAO
 * detaches its copies in the same transaction. No error, confirm or message
 * for it.
 *
 * 38.14 D-68: there is one participant editor app-wide, the EditParticipant
 * screen (the inline participant sheet is gone). Returning here re-reads the
 * event through the refresh controller only, so the unsaved parent draft and
 * its baseline survive (D-07; ADR-167). D-67: adds and removes still commit
 * at once and confirm by name with a snackbar.
 *
 * 38.14 D-69: the title is editable here, inside the parent draft and its
 * discard guard. A blank title is refused on Save with the not-blank rule
 * under the field (Save stays pressable, ux-standards rule 9); the DAO trims
 * and refuses blank again. D-27: a committed save publishes the widget notify
 * and the shell refresh.
 */
import { CommonActions, useFocusEffect } from "@react-navigation/native";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { ContactPicker } from "@/components/ContactPicker";
import { RemoveParticipantSheet } from "@/components/group/RemoveParticipantSheet";
import { ShellAppBar } from "@/components/ShellAppBar";
import { TouchpointRefineForm } from "@/components/TouchpointRefineForm";
import { AppText, Button } from "@/components/ui";
import { FieldError } from "@/components/ui/FieldError";
import { useFirstErrorReveal } from "@/components/ui/use-first-error-reveal";
import { getExecutor, localDateTime } from "@/db/database";
import {
  addParticipants,
  deleteGroupChild,
  detachParticipant,
  updateGroupEvent,
} from "@/db/group-events-dao";
import {
  type GroupEventParticipant,
  readGroupEventDetail,
} from "@/db/group-events-read";
import { newUid } from "@/db/uid";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import type { RootStackScreenProps } from "@/navigation/types";
import { useFocusedBottomInset } from "@/navigation/use-focused-bottom-inset";
import { publishInteractionWrite } from "@/services/publish-interaction-write";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { createLatestRequestAuthority } from "@/utils/latest-request";
import {
  beginInFlight,
  endInFlight,
  type InFlightRef,
} from "@/utils/single-flight";
import { eventDetailRouteKeyBelow } from "./group-event-detail-logic";
import {
  createGroupEventRefreshController,
  createParticipantAddAnnouncer,
  EVENT_SAVED_SNACKBAR,
  eventDraft,
  excludedParticipantIds,
  groupEventEditReducer,
  initialGroupEventEditState,
  isGroupEventDraftDirty,
  participantRemovedSnackbar,
  runParticipantAdd,
  runParticipantRemove,
  visibleParticipants,
} from "./group-event-refresh";
import { channelOptionsFor } from "./log-interaction-logic";

const GROUP_FUTURE_DATE_MESSAGE = "Events can't be in the future.";
/** Group Log's not-blank rule, shown under Title (38.14 D-69; 38.9 D-19). */
const TITLE_REQUIRED_MESSAGE = "An event needs a title.";

export function EditGroupEventScreen({
  navigation,
  route,
}: RootStackScreenProps<"EditGroupEvent">) {
  const { colors } = useTheme();
  // DEF-01: the root clears the system navigation bar (focused workflow).
  const bottomInset = useFocusedBottomInset();
  const { groupEventId } = route.params;
  const [state, dispatch] = useReducer(
    groupEventEditReducer,
    initialGroupEventEditState,
  );
  const { event, draft } = state;
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
  // The title's not-blank error under the field, cleared as the title changes
  // (38.14 D-69; 38.9 D-19). Save failures stay in `error`.
  const [titleError, setTitleError] = useState<string | null>(null);
  const { scrollRef, contentRef, reveal } = useFirstErrorReveal();
  const titleFieldRef = useRef<View>(null);
  const titleInputRef = useRef<TextInput>(null);

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
  // D-67: name who was just added, once, from the first readback after the
  // commit; a failed readback still confirms the add, by count.
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
        onRefreshed: (refreshed) => {
          dispatch({ type: "eventRefreshed", event: refreshed });
          announcer.settle(refreshed);
        },
        onRefreshFailed: () => {
          dispatch({ type: "refreshFailed" });
          announcer.settle(null);
        },
      }),
    [groupEventId, announcer],
  );
  // Review B-WR-07 (ADR-162: invalidate on blur and on unmount): a blur or an
  // unmount (Save, Back) first confirms a still-pending add by count, then
  // drops the readback, so the add is never left unconfirmed and a late
  // readback never announces over another screen.
  useEffect(
    () => () => {
      announcer.flush();
      refreshController.invalidate();
    },
    [announcer, refreshController],
  );
  const refreshEvent = refreshController.refresh;

  // D-68: back from EditParticipant, re-read the event only (eventRefreshed
  // never reseeds the draft, D-07). The first focus is the mount, which the
  // seed above already loads.
  const seenFocusRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!seenFocusRef.current) {
        seenFocusRef.current = true;
      } else {
        void refreshEvent();
      }
      return () => {
        announcer.flush();
        refreshController.invalidate();
      };
    }, [refreshEvent, announcer, refreshController]),
  );

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
    if (!event || !draft || savingRef.current) return;
    const title = draft.title.trim();
    if (title.length === 0) {
      // Save stays pressable (ux-standards rule 9): the rule shows under
      // Title, which is scrolled into view and focused (38.9 D-19).
      setTitleError(TITLE_REQUIRED_MESSAGE);
      reveal(titleFieldRef, titleInputRef);
      return;
    }
    if (!beginInFlight(savingRef)) return;
    setSaving(true);
    setTitleError(null);
    setError(null);
    const initial = eventDraft(event);
    const patch = {
      // D-69: only a real rename is written; the DAO trims and guards again.
      ...(title !== event.title ? { title: { value: title } } : {}),
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
      // D-27: the widget and every screen reflect the saved event.
      publishInteractionWrite();
      // ADR-199 / D-20 (review B-WR-03): the save confirms, like Edit
      // interaction's "Changes saved" (D-58).
      showSnackbar({ kind: "success", label: EVENT_SAVED_SNACKBAR });
      // 38.14 D-91: hand a committed rename back to the event detail below,
      // so it shows the new title at once; its focus re-read still follows.
      if (patch.title !== undefined) {
        const detailKey = eventDetailRouteKeyBelow(
          navigation.getState(),
          groupEventId,
        );
        if (detailKey !== null) {
          navigation.dispatch({
            ...CommonActions.setParams({ savedTitle: title }),
            source: detailKey,
          });
        }
      }
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
        // D-67: the readback that follows names them in a snackbar.
        announcer.queue(contactIds);
        // D-81: a committed add tells the widget and the shell.
        publishInteractionWrite();
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
        // D-67: confirm by name; a delete reads as a destructive result
        // (38.10 D-132 / D-140 via D-14).
        showSnackbar({
          kind: keep ? "success" : "warning",
          label: participantRemovedSnackbar(target.contactName, !keep),
        });
        // D-27: detach and delete both publish once committed.
        publishInteractionWrite();
      },
      onWriteFailed: () =>
        setError("Couldn't update the event. Your changes weren't saved."),
      refresh: refreshEvent,
    });
    if (result !== "busy") setRemovePending(false);
  }

  // House header (38.9 D-16, D-44): its Back calls goBack, which the
  // unsaved-work guard above intercepts (D-13). While the event save runs the
  // guard holds Back, so it draws disabled (D-26; WR-02).
  const header = (
    <ShellAppBar variant="child" title="Edit Event" backDisabled={saving} />
  );

  if (!event || !draft) {
    return (
      <View style={[styles.screen, { paddingBottom: bottomInset }]}>
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
    <View style={[styles.screen, { paddingBottom: bottomInset }]}>
      {header}
      <ScrollView
        ref={scrollRef}
        innerViewRef={contentRef}
        contentContainerStyle={styles.content}
      >
        <View
          ref={titleFieldRef}
          testID="edit-group-event-title-field"
          style={styles.field}
        >
          <AppText role="label" style={{ color: colors.textSecondary }}>
            Title
          </AppText>
          <TextInput
            ref={titleInputRef}
            testID="edit-group-event-title"
            accessibilityLabel="Event title"
            value={draft.title}
            onChangeText={(title) => {
              setTitleError(null);
              dispatch({ type: "draftChanged", draft: { ...draft, title } });
            }}
            placeholder="Name this event"
            placeholderTextColor={colors.textPlaceholder}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
          <FieldError
            testID="edit-group-event-title-error"
            message={titleError}
          />
        </View>
        <TouchpointRefineForm
          testID="edit-group-event-form"
          value={draft.value}
          onChange={(value) =>
            dispatch({ type: "draftChanged", draft: { ...draft, value } })
          }
          now={localDateTime()}
          // 38.14 D-60: options from the refreshed SAVED event, not the draft.
          channelOptions={channelOptionsFor(event.channel)}
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
                    accessibilityLabel={`Edit for ${item.contactName}`}
                    // D-68: the one participant editor.
                    onPress={() =>
                      navigation.navigate("EditParticipant", {
                        groupEventId,
                        interactionId: item.interactionId,
                        contactId: item.contactId,
                      })
                    }
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
        onDelete={() => void removeParticipant(false)}
        onKeep={() => void removeParticipant(true)}
      />
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
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: RADII.sm,
    paddingHorizontal: SPACING.md,
  },
  note: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: RADII.sm,
    padding: SPACING.md,
    textAlignVertical: "top",
  },
  participants: {
    gap: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.sm,
    padding: SPACING.base,
  },
  participantRow: { gap: SPACING.xs, paddingVertical: SPACING.xs },
  rowActions: { flexDirection: "row", gap: SPACING.sm },
  refreshError: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
});
