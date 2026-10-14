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
 * - Section Add FAB (D-131): the solid Add sits at the top, above the entries
 *   and the empty state, whether or not the page has entries; the add form
 *   opens in its place. Scrolled out of view, it morphs into the bottom-left
 *   FAB (chat for Last Talked About, a map pin for Current Location, with a
 *   +), opposite the universal FAB on the same baseline; its tap scrolls to
 *   the top and opens the add form. The empty state is text only (D-68).
 * - A tab page, not a focused one: the scroll content keeps the shell FAB's
 *   `useBottomClearance` (38.4 D-52), which already clears a FAB-height row.
 * - Delete is immediate with Undo, then a confirming snackbar; a linked
 *   entry's interaction and note stay (D-47, D-69). It sits in the open
 *   form, off the row card (38.9 D-30, as the Off Limits editor does).
 * - Card edit mode (D-130): each row has a pencil at its top right that opens
 *   its form in the row's place (a linked row's tap still opens its
 *   interaction, D-107). Move and a red Delete sit at the open form's top,
 *   never on a resting row; the Open link shows at rest and in edit mode.
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
  type Ref,
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
  StyleSheet,
  View,
} from "react-native";
import Animated from "react-native-reanimated";
import { openMemoryLink } from "@/components/MemoryCard";
import { MoveEntrySheet } from "@/components/MoveEntrySheet";
import { SectionAddFab, useSectionAddMorph } from "@/components/SectionAddFab";
import { ShellAppBar } from "@/components/ShellAppBar";
import { sectionFabIcon } from "@/components/section-add-fab-logic";
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
import { useFirstErrorReveal } from "@/components/ui/use-first-error-reveal";
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
  historyAddLabel,
  historyDeletedSnackbar,
  historyFabSection,
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
/** The memory cards' held look: the Button.tsx disabled look (D-26 "dimmed"; D-144). */
const DISABLED_OPACITY = 0.5;
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
  /**
   * Edit only (D-130, D-84: Last Talked About): Move, which the host routes
   * through its dirty-aware close before opening the sheet.
   */
  onMove?: () => void;
  /** Edit only: the stored link, whose Open action stays visible (D-24). */
  url?: string | null;
  /** Attached to the form's outer View, so the host can scroll it into view. */
  formRef?: Ref<View>;
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
  onMove,
  url,
  formRef,
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
      ref={formRef}
      style={[
        styles.form,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {onDelete ? (
        // D-130: in edit mode the Open link (D-24), then Move (Last Talked
        // About only) and the red Delete, at the top right of the open card.
        <View style={styles.cardActions}>
          {url ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Open ${title} link`}
              hitSlop={8}
              onPress={() => openMemoryLink(url)}
              style={styles.link}
            >
              <AppText role="caption" style={{ color: colors.accentText }}>
                Open link
              </AppText>
            </Pressable>
          ) : null}
          <View style={styles.cardButtons}>
            {onMove ? (
              <Button
                role="secondary"
                label="Move"
                accessibilityLabel={`Move ${title} entry`}
                disabled={busy}
                onPress={onMove}
              />
            ) : null}
            <Button
              testID={`${testID}-delete`}
              role="destructive"
              label="Delete"
              accessibilityLabel={`Delete ${title} entry`}
              disabled={busy}
              onPress={onDelete}
            />
          </View>
        </View>
      ) : null}
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
    </View>
  );
}

interface HistoryRowProps {
  title: string;
  model: HistoryRowModel;
  held: boolean;
  onOpenLinked: () => void;
  onEdit: () => void;
  testID: string;
}

/** One entry, Most Recent or Previous: the same row and the same actions. */
function HistoryRow({
  title,
  model,
  held,
  onOpenLinked,
  onEdit,
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
        // D-144: a held row is dimmed, as the memory cards are.
        held ? styles.held : null,
      ]}
    >
      <View style={styles.rowHeader}>
        <AppText role="body" style={styles.rowValue}>
          {row.value}
        </AppText>
        {/* D-130: the pencil at the row's top right (linked rows too). */}
        <Button
          role="iconOnly"
          icon="edit"
          accessibilityLabel={`Edit ${title} entry`}
          disabled={held}
          onPress={onEdit}
        />
      </View>
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
  const addLabel = historyAddLabel(fieldKey);
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

  // D-66 on a D-75 editor: the entry field centres above the keyboard; the
  // same ScrollView pair scrolls an `editId` form into view (D-130).
  const { scrollRef, contentRef, reveal } = useFirstErrorReveal();
  const { centering, bottomSpacer } = useKeyboardCentering({
    scrollRef,
    contentRef,
  });
  // D-130: an `editId` form opens in place of its row, which may be further
  // down, so it is scrolled into view once after it mounts. A tap needs no
  // reveal: the form opens where the row was.
  const formRef = useRef<View>(null);
  const revealPendingRef = useRef(false);
  useEffect(() => {
    if (!revealPendingRef.current || form?.mode !== "edit") return;
    revealPendingRef.current = false;
    reveal(formRef);
  }, [form, reveal]);

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
          revealPendingRef.current = true;
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
      // D-132: a delete reports in the warning style.
      showSnackbar({
        kind: "warning",
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

  // D-131: the top Add morphs into the bottom-left FAB once it scrolls off.
  // A tab page (not a focused route): the FAB sits above the in-flow tab
  // bar, on the universal FAB's baseline.
  const morph = useSectionAddMorph({
    loaded: phase.phase === "loaded",
    formOpen: form !== null,
    focusedRoute: false,
  });
  const openAddFromFab = () => {
    // Held while a write runs or a form is open, as the top Add is.
    if (savingRef.current || form !== null) return;
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    openForm({ mode: "add" });
  };

  const renderRow = (model: HistoryRowModel) => {
    const { row } = model;
    const editing = form?.mode === "edit" && form.row.id === row.id;
    // D-130: the edit form renders instead of its row, not under it.
    return editing ? (
      <HistoryEntryForm
        key={`edit-form-${formKey}`}
        testID="memory-history-edit-form"
        formRef={formRef}
        title={title}
        initialValue={row.value}
        initialDate={row.entry_date}
        dateEditable={model.canEditDate}
        dateLabel={model.dateLabel}
        busy={saving}
        onSave={save}
        onCancel={() => requestClose(closeForm, formDirty)}
        onDelete={() => remove(row)}
        url={row.url}
        onMove={
          model.canMove
            ? () =>
                requestClose(() => {
                  closeForm();
                  setMoveRow(row);
                }, formDirty)
            : undefined
        }
        onDirtyChange={setFormDirty}
      />
    ) : (
      <HistoryRow
        key={row.id}
        testID={`memory-history-row-${row.id}`}
        title={title}
        model={model}
        held={controlsHeld}
        onOpenLinked={() => openLinked(row)}
        onEdit={() => openForm({ mode: "edit", row })}
      />
    );
  };

  return (
    <View style={styles.root} onLayout={morph.onRootLayout}>
      {/* House header (38.9 D-16, D-44); Back is held while a write runs. */}
      <ShellAppBar
        variant="child"
        title={title}
        person={person}
        backDisabled={saving}
      />
      <Animated.ScrollView
        ref={scrollRef}
        innerViewRef={contentRef}
        onLayout={morph.onViewportLayout}
        onScroll={morph.scrollHandler}
        scrollEventThrottle={16}
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
              ) : (
                // D-131: the solid Add at the top (D-130), the one Add on the
                // page, with entries or without. Held while a form is open or
                // a write runs.
                <View onLayout={morph.onBarLayout}>
                  <Button
                    testID="memory-history-add"
                    role="primary"
                    label={addLabel}
                    disabled={controlsHeld}
                    onPress={() => openForm({ mode: "add" })}
                  />
                </View>
              )}
              {groups === null || groups.mostRecent === null ? (
                form?.mode === "add" ? null : (
                  // D-68: text only; the top Add is the one action.
                  <EmptyState
                    testID="memory-history-empty"
                    icon="list"
                    heading={`Nothing in ${title} yet`}
                    body="Add the first entry with its date."
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
      </Animated.ScrollView>
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
      {/* Rendered last, so it floats over the content (D-131). */}
      <SectionAddFab
        morph={morph}
        icon={sectionFabIcon(historyFabSection(fieldKey))}
        label={addLabel}
        hint="Scrolls to the top and opens the add form."
        onPress={openAddFromFab}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  cardActions: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    justifyContent: "space-between",
  },
  cardButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    justifyContent: "flex-end",
    marginLeft: "auto",
  },
  content: { gap: SPACING.md, padding: SPACING.base },
  form: {
    borderRadius: SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACING.sm,
    padding: SPACING.base,
  },
  group: { gap: SPACING.sm },
  held: { opacity: DISABLED_OPACITY },
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
  rowHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: SPACING.sm,
    justifyContent: "space-between",
  },
  rowValue: { flex: 1 },
});
