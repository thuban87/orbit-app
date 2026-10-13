// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button/AppText `role` is a domain prop, not ARIA.
/**
 * MemoryHistoryScreen — the full history of Last Talked About or Current
 * Location (Phase 38.10 D-45, D-47, D-48, D-51, D-52, D-53, D-69, D-41,
 * D-101, D-107). Route `{ contactId, fieldKey, openAdd?, editId? }`.
 *
 * - Read: the ADR-168 gated read (loading, Retry on a failed read; never an
 *   empty list standing in for a failure). The rows arrive in the one SQL
 *   order (D-45, D-51): the first is Most Recent, the rest Previous. Both
 *   render through the same row (convergence c10, Claude C-05).
 * - Each row shows the date it is about, date only (D-41, D-48; CU-04), and
 *   any stored URL with an Open action (D-24).
 * - A linked row's tap opens its interaction; its Edit is on long-press and
 *   the screen-reader actions (D-107, D-37). An unlinked row's tap opens its
 *   edit form. A linked row's date follows its interaction (D-41).
 * - Add: the D-66 entry field and a date that defaults to today and cannot
 *   pass it (D-101). `openAdd` opens it; `editId` opens that entry's form
 *   once per navigation after the read (D-107; convergence c6).
 * - Delete is immediate with Undo, then a confirming snackbar; a linked
 *   entry's interaction and note stay (D-47, D-69). It sits in the open
 *   form, off the row card (38.9 D-30, as the Off Limits editor does).
 * - Move only on Last Talked About (D-84; F-U12), through `MoveEntrySheet`,
 *   whose callbacks re-read this list (D-118).
 * - Nothing promotes an older entry (D-45). No Allow AI switch: this table has none and
 *   Last Talked About stays out of AI (D-49).
 * - Back closes an open form first, asking only when it holds changes
 *   (38.9 D-13/D-14 via D-19). The entry field centres above the keyboard
 *   (D-66 on a D-75 editor).
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md).
 */
import { useFocusEffect } from "@react-navigation/native";
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type AccessibilityActionEvent,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { openMemoryLink } from "@/components/MemoryCard";
import { MoveEntrySheet } from "@/components/MoveEntrySheet";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  AppText,
  Button,
  EmptyState,
  EntryDateField,
  EntryTextField,
  KeyboardCenteringProvider,
  useKeyboardCentering,
} from "@/components/ui";
import {
  isSavableEntry,
  normalizeEntryText,
} from "@/components/ui/entry-text-logic";
import {
  addCurrentStateEntry,
  type CurrentStateSnapshot,
  deleteCurrentStateEntry,
  editHistoryEntry,
  undoCurrentStateEntryDelete,
} from "@/db/current-state-history-dao";
import {
  type CurrentStateEntryRow,
  getCurrentStateHistory,
} from "@/db/current-state-history-read";
import { getExecutor, localDateTime } from "@/db/database";
import { getLinkedInteractionRefCore } from "@/db/linked-entry-dao";
import { useContactHeader } from "@/hooks/use-contact-header";
import { linkedEntryRoute } from "@/logic/linked-entry-route";
import { type ReadPhase, readLoading, runGatedRead } from "@/logic/read-phase";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import type { RootStackScreenProps } from "@/navigation/types";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { createLatestRequestAuthority } from "@/utils/latest-request";
import { Logger } from "@/utils/logger";
import { beginInFlight, endInFlight } from "@/utils/single-flight";
import {
  canMoveFrom,
  groupHistoryRows,
  HISTORY_MOST_RECENT,
  HISTORY_PREVIOUS,
  type HistoryRowModel,
  historyDeletedSnackbar,
  historyRestoredSnackbar,
  historyTitle,
  isPickableEntryDate,
  maxPickableDate,
} from "./memory-history-logic";
import {
  addedSnackbar,
  openEditTarget,
  savedSnackbar,
} from "./section-editor-logic";

const LOG_SCOPE = "memory-history";
const EDIT_ACTION = "edit";

/** The open form: a new entry, or one stored row. */
type FormTarget = { mode: "add" } | { mode: "edit"; row: CurrentStateEntryRow };

function errorNotice(label: string): void {
  showSnackbar({
    kind: "error",
    label,
    action: {
      label: "Dismiss",
      accessibilityLabel: "Dismiss error",
      onPress: () => {},
    },
  });
}

interface HistoryEntryFormProps {
  title: string;
  initialValue: string;
  initialDate: string;
  /** False for a linked entry: its date follows the interaction (D-41). */
  dateEditable: boolean;
  /** Shown read-only when the date is not editable. */
  dateLabel?: string;
  busy: boolean;
  onSave: (value: string, entryDate: string) => void;
  onCancel: () => void;
  /** Edit only: the immediate delete with Undo (D-69). */
  onDelete?: () => void;
  onDirtyChange: (dirty: boolean) => void;
  testID: string;
}

/**
 * One add or edit form. It owns its draft; the host mounts it with a `key`
 * per open and unmounts it on a successful save.
 */
function HistoryEntryForm({
  title,
  initialValue,
  initialDate,
  dateEditable,
  dateLabel,
  busy,
  onSave,
  onCancel,
  onDelete,
  onDirtyChange,
  testID,
}: HistoryEntryFormProps) {
  const { colors } = useTheme();
  const [value, setValue] = useState(initialValue);
  const [entryDate, setEntryDate] = useState(initialDate);
  const dirty = value !== initialValue || entryDate !== initialDate;
  const savable =
    !busy &&
    isSavableEntry(value) &&
    (!dateEditable || isPickableEntryDate(entryDate));

  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;
  useEffect(() => {
    onDirtyChangeRef.current(dirty);
  }, [dirty]);

  const save = () => {
    if (!savable) return;
    onSave(normalizeEntryText(value), entryDate);
  };

  return (
    <View
      testID={testID}
      style={[
        styles.form,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <EntryTextField
        testID={`${testID}-value`}
        accessibilityLabel={`${title} entry`}
        value={value}
        onChangeText={setValue}
        onSubmit={save}
        returnKeyType="done"
        editable={!busy}
      />
      {dateEditable ? (
        <EntryDateField
          testID={`${testID}-date`}
          accessibilityLabel={`${title} date`}
          value={entryDate}
          onChange={setEntryDate}
          // D-101: never past today.
          maxDate={new Date()}
        />
      ) : dateLabel ? (
        <AppText role="caption" style={{ color: colors.textSecondary }}>
          {dateLabel}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Button
          role="secondary"
          label="Cancel"
          disabled={busy}
          onPress={onCancel}
        />
        <Button
          testID={`${testID}-save`}
          role="primary"
          label="Save"
          disabled={!savable}
          onPress={save}
        />
      </View>
      {onDelete ? (
        <Button
          testID={`${testID}-delete`}
          role="tertiary"
          label="Delete"
          accessibilityLabel={`Delete ${title} entry`}
          disabled={busy}
          onPress={onDelete}
        />
      ) : null}
    </View>
  );
}

interface HistoryRowProps {
  title: string;
  model: HistoryRowModel;
  held: boolean;
  onOpenLinked: () => void;
  onEdit: () => void;
  onMove?: () => void;
  testID: string;
}

/** One entry, Most Recent or Previous: the same row and the same actions. */
function HistoryRow({
  title,
  model,
  held,
  onOpenLinked,
  onEdit,
  onMove,
  testID,
}: HistoryRowProps) {
  const { colors } = useTheme();
  const { row, dateLabel, pressAction } = model;
  const linked = pressAction === "openLinked";
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (held) return;
    if (event.nativeEvent.actionName === EDIT_ACTION) onEdit();
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        linked
          ? `Open the interaction for this ${title} entry, ${row.value}, ${dateLabel}`
          : `Edit ${title} entry, ${row.value}, ${dateLabel}`
      }
      accessibilityHint={
        linked ? "Long-press or use actions to edit." : undefined
      }
      accessibilityState={{ disabled: held }}
      accessibilityActions={
        linked ? [{ name: EDIT_ACTION, label: "Edit" }] : []
      }
      onAccessibilityAction={onAccessibilityAction}
      disabled={held}
      onPress={linked ? onOpenLinked : onEdit}
      onLongPress={onEdit}
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <AppText role="body">{row.value}</AppText>
      <AppText role="caption" style={{ color: colors.textSecondary }}>
        {dateLabel}
      </AppText>
      {row.url ? (
        // D-24: the URL itself, then its Open action.
        <>
          <AppText
            role="caption"
            numberOfLines={2}
            style={{ color: colors.textSecondary }}
          >
            {row.url}
          </AppText>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open ${title} link`}
            hitSlop={8}
            onPress={() => openMemoryLink(row.url ?? "")}
            style={styles.link}
          >
            <AppText
              role="caption"
              numberOfLines={1}
              style={{ color: colors.accentText }}
            >
              Open link
            </AppText>
          </Pressable>
        </>
      ) : null}
      {onMove ? (
        <View style={styles.actions}>
          <Button
            role="secondary"
            label="Move"
            accessibilityLabel={`Move ${title} entry`}
            disabled={held}
            onPress={onMove}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

export function MemoryHistoryScreen({
  navigation,
  route,
}: RootStackScreenProps<"MemoryHistory">) {
  const { colors } = useTheme();
  // The last item scrolls fully above the shell FAB (38.4 D-52, OA-E3).
  const bottomClearance = useBottomClearance();
  const { contactId, fieldKey, openAdd, editId } = route.params;
  const title = historyTitle(fieldKey);
  // D-45 (38.9): the person line under the fixed title.
  const person = useContactHeader(contactId);
  // Snackbars fired after an await read the latest name.
  const nameRef = useRef<string | null>(null);
  nameRef.current = person?.name ?? null;

  const [phase, setPhase] =
    useState<ReadPhase<CurrentStateEntryRow[]>>(readLoading);
  // Only the latest load may publish; blur invalidates outstanding reads.
  const readAuthority = useMemo(() => createLatestRequestAuthority(), []);
  // `editId` opens its form once per navigation (D-107; convergence c6).
  const editConsumedRef = useRef(false);

  // `openAdd` opens the add form (the Profile's Add, plan 16).
  const [form, setForm] = useState<FormTarget | null>(
    openAdd === true ? { mode: "add" } : null,
  );
  const [formDirty, setFormDirty] = useState(false);
  // Remounts the form for each open (it owns its draft).
  const [formKey, setFormKey] = useState(0);
  const openForm = (target: FormTarget) => {
    setFormKey((key) => key + 1);
    setFormDirty(false);
    setForm(target);
  };
  const closeForm = () => {
    setForm(null);
    setFormDirty(false);
  };

  // Single-flight for add, edit and delete; `saving` mirrors it for Back.
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  // In-screen sub-editor guard (38.9 D-14 via D-19).
  const bypassRef = useRef(false);
  const { requestClose, settleHold } = useDiscardKeepGuard({
    hasUnsavedChanges: false,
    bypassRef,
    busyRef: savingRef,
    subEditor: { open: form !== null, dirty: formDirty, close: closeForm },
  });

  // D-66 on a D-75 editor: the entry field centres above the keyboard.
  const scrollRef = useRef<ScrollView>(null);
  // ScrollView.d.ts types `innerViewRef` as a non-null `RefObject<View>`
  // (as use-first-error-reveal.ts widens it).
  const contentRef = useRef<View>(null) as RefObject<View>;
  const { centering, bottomSpacer } = useKeyboardCentering({
    scrollRef,
    contentRef,
  });

  /** NEVER rejects: a failure lands in the error phase (D-04). */
  const load = useCallback(async (): Promise<void> => {
    await runGatedRead({
      gate: readAuthority,
      read: () => getCurrentStateHistory(getExecutor(), contactId, fieldKey),
      publish: setPhase,
      onLoaded: (rows) => {
        if (editConsumedRef.current) return;
        editConsumedRef.current = true;
        // Every row, Most Recent included (convergence c10, Claude C-05).
        const target = openEditTarget(editId, rows);
        const row = rows.find((candidate) => candidate.id === target);
        // Opens it exactly as a long-press does.
        if (row) {
          setFormKey((key) => key + 1);
          setFormDirty(false);
          setForm({ mode: "edit", row });
        }
      },
      onError: (error) =>
        Logger.error(LOG_SCOPE, "failed to load current-state history", error),
    });
  }, [contactId, fieldKey, editId, readAuthority]);

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => readAuthority.invalidate();
    }, [load, readAuthority]),
  );

  /** Runs one add or edit single-flight; closes the form on success. */
  const save = (value: string, entryDate: string) => {
    if (form === null || !beginInFlight(savingRef)) return;
    const target = form;
    setSaving(true);
    void (async () => {
      try {
        const now = localDateTime();
        if (target.mode === "add") {
          await addCurrentStateEntry(getExecutor(), {
            contactId,
            fieldKey,
            value,
            entryDate,
            entryTime: null,
            now,
          });
        } else {
          await editHistoryEntry(getExecutor(), {
            contactId,
            fieldKey,
            entryId: target.row.id,
            value,
            // D-41: a linked entry's date follows its interaction.
            entryDate:
              target.row.interaction_id === null ? entryDate : undefined,
            now,
          });
        }
      } catch (error) {
        Logger.error(LOG_SCOPE, `failed to ${target.mode} an entry`, error);
        errorNotice("Couldn't save. Please try again.");
        return; // The form stays open with its draft.
      } finally {
        setSaving(false);
        endInFlight(savingRef);
        settleHold();
      }
      closeForm();
      void load();
      showSnackbar({
        kind: "success",
        label:
          target.mode === "add"
            ? addedSnackbar(title, nameRef.current)
            : savedSnackbar(title, nameRef.current),
      });
    })();
  };

  const undoDelete = (snapshot: CurrentStateSnapshot) => {
    void (async () => {
      try {
        await undoCurrentStateEntryDelete(
          getExecutor(),
          snapshot,
          localDateTime(),
        );
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to undo a delete", error);
        errorNotice("Couldn't undo the delete.");
        return;
      }
      void load();
      showSnackbar({
        kind: "success",
        label: historyRestoredSnackbar(title, nameRef.current),
      });
    })();
  };

  // D-47 / D-69: the delete happens at once (a hard delete with a
  // tombstone); a linked entry's interaction and note stay (D-37).
  const remove = (row: CurrentStateEntryRow) => {
    if (!beginInFlight(savingRef)) return;
    setSaving(true);
    void (async () => {
      let snapshot: CurrentStateSnapshot;
      try {
        snapshot = await deleteCurrentStateEntry(getExecutor(), {
          id: row.id,
          contactId,
          now: localDateTime(),
        });
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to delete an entry", error);
        errorNotice("Couldn't delete. Please try again.");
        return;
      } finally {
        setSaving(false);
        endInFlight(savingRef);
        settleHold();
      }
      closeForm();
      void load();
      showSnackbar({
        kind: "success",
        label: historyDeletedSnackbar(title, nameRef.current),
        action: {
          label: "Undo",
          accessibilityLabel: `Undo deleting the ${title} entry`,
          onPress: () => undoDelete(snapshot),
        },
      });
    })();
  };

  // D-107: a linked entry opens its interaction (D-37, D-48; checker B5).
  const openLinked = (row: CurrentStateEntryRow) => {
    const interactionId = row.interaction_id;
    if (interactionId === null) return;
    void (async () => {
      let target: ReturnType<typeof linkedEntryRoute>;
      try {
        const ref = await getLinkedInteractionRefCore(
          getExecutor(),
          interactionId,
        );
        target = linkedEntryRoute(
          ref === null
            ? null
            : {
                ...ref,
                linkSource:
                  row.link_source === "group_note" ? "group_note" : "note",
              },
        );
      } catch (error) {
        Logger.error(LOG_SCOPE, "failed to open the interaction", error);
        return;
      }
      if (target === null) {
        // The interaction is gone; the entry is standalone now.
        void load();
        return;
      }
      switch (target.name) {
        case "GroupEventDetail":
          navigation.navigate("GroupEventDetail", target.params);
          return;
        case "EditParticipant":
          navigation.navigate("EditParticipant", target.params);
          return;
        case "EditInteraction":
          navigation.navigate("EditInteraction", target.params);
          return;
      }
    })();
  };

  // D-84: Move opens the shared sheet (Last Talked About only, F-U12).
  const [moveRow, setMoveRow] = useState<CurrentStateEntryRow | null>(null);
  const movable = canMoveFrom(fieldKey);

  const groups = useMemo(
    () =>
      phase.phase === "loaded" ? groupHistoryRows(phase.data, fieldKey) : null,
    [phase, fieldKey],
  );
  const controlsHeld = saving || form !== null;

  const renderRow = (model: HistoryRowModel) => {
    const { row } = model;
    const editing = form?.mode === "edit" && form.row.id === row.id;
    return (
      <View key={row.id} style={styles.rowGroup}>
        <HistoryRow
          testID={`memory-history-row-${row.id}`}
          title={title}
          model={model}
          held={controlsHeld}
          onOpenLinked={() => openLinked(row)}
          onEdit={() => openForm({ mode: "edit", row })}
          onMove={model.canMove ? () => setMoveRow(row) : undefined}
        />
        {editing ? (
          <HistoryEntryForm
            key={formKey}
            testID="memory-history-edit-form"
            title={title}
            initialValue={row.value}
            initialDate={row.entry_date}
            dateEditable={model.canEditDate}
            dateLabel={model.dateLabel}
            busy={saving}
            onSave={save}
            onCancel={() => requestClose(closeForm, formDirty)}
            onDelete={() => remove(row)}
            onDirtyChange={setFormDirty}
          />
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      {/* House header (38.9 D-16, D-44); Back is held while a write runs. */}
      <ShellAppBar
        variant="child"
        title={title}
        person={person}
        backDisabled={saving}
      />
      <ScrollView
        ref={scrollRef}
        innerViewRef={contentRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomClearance },
        ]}
      >
        <KeyboardCenteringProvider value={centering}>
          {phase.phase === "loading" ? (
            <View
              testID="memory-history-loading"
              accessibilityLabel={`Loading ${title}`}
              style={styles.readState}
            >
              <ActivityIndicator color={colors.accentText} />
            </View>
          ) : phase.phase === "error" ? (
            <View testID="memory-history-read-error" style={styles.readError}>
              <AppText role="body" style={{ color: colors.textPrimary }}>
                {`Couldn't load ${title}`}
              </AppText>
              <Button
                role="tertiary"
                label="Retry"
                accessibilityLabel={`Retry loading ${title}`}
                onPress={() => void load()}
              />
            </View>
          ) : (
            <>
              {form?.mode === "add" ? (
                <HistoryEntryForm
                  key={formKey}
                  testID="memory-history-add-form"
                  title={title}
                  initialValue=""
                  initialDate={maxPickableDate()}
                  dateEditable
                  busy={saving}
                  onSave={save}
                  onCancel={() => requestClose(closeForm, formDirty)}
                  onDirtyChange={setFormDirty}
                />
              ) : groups !== null && groups.mostRecent !== null ? (
                <Button
                  testID="memory-history-add"
                  role="primary"
                  label={`Add ${title}`}
                  disabled={controlsHeld}
                  onPress={() => openForm({ mode: "add" })}
                />
              ) : null}
              {groups === null || groups.mostRecent === null ? (
                form?.mode === "add" ? null : (
                  // D-68: the empty page's one Add action.
                  <EmptyState
                    testID="memory-history-empty"
                    icon="list"
                    heading={`Nothing in ${title} yet`}
                    body="Add the first entry with its date."
                    action={{
                      label: `Add ${title}`,
                      onPress: () => openForm({ mode: "add" }),
                    }}
                  />
                )
              ) : (
                <>
                  <View style={styles.group}>
                    <AppText role="heading" accessibilityRole="header">
                      {HISTORY_MOST_RECENT}
                    </AppText>
                    {renderRow(groups.mostRecent)}
                  </View>
                  {groups.previous.length > 0 ? (
                    <View style={styles.group}>
                      <AppText role="heading" accessibilityRole="header">
                        {HISTORY_PREVIOUS}
                      </AppText>
                      {groups.previous.map(renderRow)}
                    </View>
                  ) : null}
                </>
              )}
            </>
          )}
        </KeyboardCenteringProvider>
        {bottomSpacer}
      </ScrollView>
      {movable && moveRow !== null ? (
        <MoveEntrySheet
          entryRef={{
            table: "current_state_entries",
            id: moveRow.id,
            contactId,
          }}
          row={moveRow}
          section="last_talked_about"
          contactName={person?.name ?? null}
          onMoved={() => void load()}
          onMoveUndone={() => void load()}
          onClose={() => setMoveRow(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  content: { gap: SPACING.md, padding: SPACING.base },
  form: {
    borderRadius: SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACING.sm,
    padding: SPACING.base,
  },
  group: { gap: SPACING.sm },
  link: { alignSelf: "flex-start" },
  readError: { gap: SPACING.sm, alignItems: "flex-start" },
  readState: { minHeight: 88, alignItems: "center", justifyContent: "center" },
  root: { flex: 1 },
  row: {
    borderRadius: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACING.xs,
    padding: SPACING.sm,
  },
  rowGroup: { gap: SPACING.sm },
});
