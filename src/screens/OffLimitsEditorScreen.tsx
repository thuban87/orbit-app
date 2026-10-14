// biome-ignore-all lint/a11y/useValidAriaRole: AppText / Button `role` is a typography / hierarchy role.
/**
 * OffLimitsEditorScreen — the dedicated Off Limits editor (Phase 38.10 D-08,
 * D-75). Route `{ contactId, editId? }`.
 *
 * - Reads `off_limits` through the ADR-168 gated read (loading, Retry on a
 *   failed read, never an empty list standing in for a failure). Writes go
 *   through `off-limits-editor-controller`, which re-reads the collection
 *   before every edit and delete and refuses an id that is not this
 *   contact's (D-11); the DAO scopes every write by `(id, contact_id)`.
 * - Rows show their full text, label and any stored link with an Open action
 *   (D-24). No AI control and no AI sparkle anywhere (D-09, D-10).
 * - Add and Edit open the shared `OffLimitsForm` (the D-66 field, optional
 *   label and link). Delete sits in the open form (38.9 D-30) and happens at
 *   once with an Undo snackbar naming the person, then a confirming snackbar
 *   (D-69; 38.9 D-39/D-46 via D-19).
 * - Card edit mode (D-130): each row has a pencil at its top right; the
 *   pencil or a tap on the row opens its form in the row's place, with Move
 *   and a red Delete at the form's top (none at rest). While a form is open
 *   the other rows and the Add are held (`controlsHeld`).
 * - Section Add FAB (D-131): the solid Add sits at the top of the list,
 *   above the rows and the empty state, whether or not there are rows; a new
 *   item's form opens in its place. Scrolled out of view, it morphs into the
 *   bottom-left FAB (the no-entry icon with a +), whose tap scrolls to the top
 *   and opens the add form. The empty state is text only (D-68: the top Add is
 *   the one action).
 * - Move goes through `MoveEntrySheet` (D-84, D-85 confirm, D-118 Undo); its
 *   callbacks re-read this list so the entry leaves on a move and comes back
 *   on Undo.
 * - `editId` opens that entry's form once per navigation after the read, and
 *   falls back to the list when the entry is gone (D-107; convergence c6).
 * - Back closes an open form first, asking only when it holds changes
 *   (38.9 D-13/D-14 via D-19). The entry field centres above the keyboard
 *   (D-66, D-75).
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md).
 */
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { openMemoryLink } from "@/components/MemoryCard";
import { MoveEntrySheet } from "@/components/MoveEntrySheet";
import {
  OffLimitsForm,
  type OffLimitsFormFields,
} from "@/components/OffLimitsForm";
import {
  SectionAddFab,
  useSectionAddMorph,
  useSectionFabClearance,
} from "@/components/SectionAddFab";
import { ShellAppBar } from "@/components/ShellAppBar";
import { sectionFabIcon } from "@/components/section-add-fab-logic";
import {
  AppText,
  Button,
  EmptyState,
  KeyboardCenteringProvider,
  useKeyboardCentering,
} from "@/components/ui";
import { useFirstErrorReveal } from "@/components/ui/use-first-error-reveal";
import { ADD_OFF_LIMITS_ITEM } from "@/constants/glossary";
import { getExecutor, localDateTime } from "@/db/database";
import {
  addOffLimits,
  deleteOffLimits,
  editOffLimits,
  type OffLimitsSnapshot,
  undoDeleteOffLimits,
} from "@/db/off-limits-dao";
import {
  listOffLimitsForContact,
  type OffLimitsRow,
} from "@/db/off-limits-read";
import { newUid } from "@/db/uid";
import { useContactHeader } from "@/hooks/use-contact-header";
import { type ReadPhase, readLoading, runGatedRead } from "@/logic/read-phase";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import { isFocusedWorkflow } from "@/navigation/focused-route-classification";
import type { RootStackScreenProps } from "@/navigation/types";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { createLatestRequestAuthority } from "@/utils/latest-request";
import { Logger } from "@/utils/logger";
import {
  createOffLimitsEditorController,
  type OffLimitsEditorOp,
  offLimitsAddedSnackbar,
  offLimitsDeletedSnackbar,
  offLimitsRestoredSnackbar,
  offLimitsSavedSnackbar,
} from "./off-limits-editor-controller";
import { openEditTarget } from "./section-editor-logic";

const LOG_SCOPE = "off-limits-editor";
const TITLE = "Off Limits";

/** The open form: a new item, or one stored row. */
type FormTarget = { mode: "add" } | { mode: "edit"; row: OffLimitsRow };

const ERROR_LABELS: Record<OffLimitsEditorOp, string> = {
  add: "Couldn't save. Please try again.",
  edit: "Couldn't save. Please try again.",
  delete: "Couldn't delete. Please try again.",
  undo: "Couldn't undo the delete.",
};

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

export function OffLimitsEditorScreen({
  route,
}: RootStackScreenProps<"OffLimitsEditor">) {
  const { colors } = useTheme();
  const { contactId, editId } = route.params;
  // Single-person form: the person line under the fixed title (38.9 D-45).
  const person = useContactHeader(contactId);
  // Snackbars fired after an await read the latest name.
  const nameRef = useRef<string | null>(null);
  nameRef.current = person?.name ?? null;

  const [phase, setPhase] = useState<ReadPhase<OffLimitsRow[]>>(readLoading);
  // Only the latest load may publish; blur invalidates outstanding reads.
  const readAuthority = useMemo(() => createLatestRequestAuthority(), []);

  // `editId` opens its form once per navigation (D-107; convergence c6): a
  // reload after Save does not reopen it.
  const editConsumedRef = useRef(false);

  const [form, setForm] = useState<FormTarget | null>(null);
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

  // A write in flight holds Back and every control (D-26).
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

  // The reload the controller triggers after each write; a ref so the
  // controller (made once per contact) always calls the current `load`.
  const loadRef = useRef<() => Promise<void>>(async () => {});
  const controller = useMemo(
    () =>
      createOffLimitsEditorController({
        contactId,
        dao: {
          list: (id) => listOffLimitsForContact(getExecutor(), id),
          add: (input) => addOffLimits(getExecutor(), input),
          edit: (input) => editOffLimits(getExecutor(), input),
          delete: (input) => deleteOffLimits(getExecutor(), input),
          undo: (snapshot, now) =>
            undoDeleteOffLimits(getExecutor(), snapshot, now),
        },
        now: localDateTime,
        newUid,
        onChanged: () => void loadRef.current(),
        onError: (error, op) => {
          Logger.error(LOG_SCOPE, `failed to ${op} an Off Limits item`, error);
          errorNotice(ERROR_LABELS[op]);
        },
      }),
    [contactId],
  );

  /** NEVER rejects: a failure lands in the error phase (D-04). */
  const load = useCallback(async (): Promise<void> => {
    await runGatedRead({
      gate: readAuthority,
      read: () => controller.list(),
      publish: setPhase,
      onLoaded: (rows) => {
        if (editConsumedRef.current) return;
        editConsumedRef.current = true;
        const target = openEditTarget(editId, rows);
        const row = rows.find((candidate) => candidate.id === target);
        // Opens it exactly as tapping the row's Edit does.
        if (row) {
          revealPendingRef.current = true;
          setFormKey((key) => key + 1);
          setFormDirty(false);
          setForm({ mode: "edit", row });
        }
      },
      onError: (error) =>
        Logger.error(LOG_SCOPE, "failed to load Off Limits", error),
    });
  }, [controller, editId, readAuthority]);
  loadRef.current = load;

  useFocusEffect(
    useCallback(() => {
      void load();
      return () => readAuthority.invalidate();
    }, [load, readAuthority]),
  );

  /** Runs one add or edit single-flight; closes the form on success. */
  const save = async (fields: OffLimitsFormFields): Promise<void> => {
    if (form === null || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    let ok: boolean;
    try {
      ok =
        form.mode === "add"
          ? await controller.onAdd(fields)
          : await controller.onEdit(form.row.id, fields);
    } finally {
      savingRef.current = false;
      setSaving(false);
      settleHold();
    }
    if (!ok) return; // The form stays open with its draft.
    closeForm();
    showSnackbar({
      kind: "success",
      label:
        form.mode === "add"
          ? offLimitsAddedSnackbar(nameRef.current)
          : offLimitsSavedSnackbar(nameRef.current),
    });
  };

  const undoDelete = (snapshot: OffLimitsSnapshot) => {
    void (async () => {
      if (!(await controller.onUndo(snapshot))) return;
      showSnackbar({
        kind: "success",
        label: offLimitsRestoredSnackbar(nameRef.current),
      });
    })();
  };

  // D-69: the delete happens at once (a hard delete with a tombstone) and
  // Undo puts it back. It replaces the old irreversible confirm.
  const remove = (row: OffLimitsRow) => {
    if (savingRef.current) return;
    closeForm();
    void (async () => {
      const snapshot = await controller.onDelete(row.id);
      if (snapshot === null) return;
      // D-132: a delete reports in the warning style.
      showSnackbar({
        kind: "warning",
        label: offLimitsDeletedSnackbar(nameRef.current),
        action: {
          label: "Undo",
          accessibilityLabel: "Undo deleting the Off Limits item",
          onPress: () => undoDelete(snapshot),
        },
      });
    })();
  };

  // D-84: Move opens the shared sheet for that entry.
  const [moveRow, setMoveRow] = useState<OffLimitsRow | null>(null);

  const rows = phase.phase === "loaded" ? phase.data : [];
  const controlsHeld = saving || form !== null;

  // D-131: the top Add morphs into the bottom-left FAB once it scrolls off.
  const focusedRoute = isFocusedWorkflow(route.name);
  const morph = useSectionAddMorph({
    loaded: phase.phase === "loaded",
    formOpen: form !== null,
    focusedRoute,
  });
  const fabClearance = useSectionFabClearance(focusedRoute);
  const openAddFromFab = () => {
    // Held while a save runs or a form is open, as the top Add is.
    if (savingRef.current || form !== null) return;
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    openForm({ mode: "add" });
  };

  /** The open edit form, in card edit mode (D-130). */
  const renderEditForm = (row: OffLimitsRow) => (
    <OffLimitsForm
      key={`form-${formKey}`}
      testID="off-limits-editor-form"
      formRef={formRef}
      initial={row}
      onSave={save}
      onCancel={() => requestClose(closeForm, formDirty)}
      onDelete={() => remove(row)}
      cardEditMode
      onMove={() =>
        requestClose(() => {
          closeForm();
          setMoveRow(row);
        }, formDirty)
      }
      onDirtyChange={setFormDirty}
      busy={saving}
    />
  );

  return (
    <View style={styles.root} onLayout={morph.onRootLayout}>
      {/* While a save runs the guard holds Back (D-26). */}
      <ShellAppBar
        variant="child"
        title={TITLE}
        person={person}
        backDisabled={saving}
      />
      <Animated.ScrollView
        ref={scrollRef}
        innerViewRef={contentRef}
        onLayout={morph.onViewportLayout}
        onScroll={morph.scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          // The last row scrolls fully above the section FAB.
          { paddingBottom: fabClearance },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <KeyboardCenteringProvider value={centering}>
          <AppText role="body" style={{ color: colors.textSecondary }}>
            Keep topics here that you want to avoid bringing up.
          </AppText>
          {phase.phase === "loading" ? (
            <View
              testID="off-limits-editor-loading"
              accessibilityLabel={`Loading ${TITLE}`}
              style={styles.readState}
            >
              <ActivityIndicator color={colors.accentText} />
            </View>
          ) : phase.phase === "error" ? (
            <View
              testID="off-limits-editor-read-error"
              style={styles.readError}
            >
              <AppText role="body" style={{ color: colors.textPrimary }}>
                {`Couldn't load ${TITLE}`}
              </AppText>
              <Button
                role="tertiary"
                label="Retry"
                accessibilityLabel={`Retry loading ${TITLE}`}
                onPress={() => void load()}
              />
            </View>
          ) : (
            <>
              {form?.mode === "add" ? (
                // D-131: a new item's form opens in the top Add's place.
                <OffLimitsForm
                  key={`form-${formKey}`}
                  testID="off-limits-editor-form"
                  initial={null}
                  onSave={save}
                  onCancel={() => requestClose(closeForm, formDirty)}
                  onDirtyChange={setFormDirty}
                  busy={saving}
                />
              ) : (
                // D-131: the solid Add at the top (D-130), the one Add on the
                // page, with rows or without. Held while a form is open or a
                // save runs.
                <View onLayout={morph.onBarLayout}>
                  <Button
                    testID="off-limits-editor-add"
                    role="primary"
                    label={ADD_OFF_LIMITS_ITEM}
                    disabled={controlsHeld}
                    onPress={() => openForm({ mode: "add" })}
                  />
                </View>
              )}
              {rows.length === 0 && form === null ? (
                // D-68: text only; the top Add is the one action.
                <EmptyState
                  testID="off-limits-editor-empty"
                  icon="list"
                  heading={`Nothing in ${TITLE} yet`}
                  body="Add a topic to avoid bringing up."
                />
              ) : null}
              {rows.map((row) =>
                form?.mode === "edit" && form.row.id === row.id ? (
                  // D-130: the form opens in this row's place.
                  renderEditForm(form.row)
                ) : (
                  <Pressable
                    key={row.id}
                    testID={`off-limits-editor-row-${row.id}`}
                    accessibilityRole="button"
                    accessibilityLabel="Edit Off Limits item"
                    accessibilityState={{ disabled: controlsHeld }}
                    disabled={controlsHeld}
                    onPress={() => openForm({ mode: "edit", row })}
                    style={[
                      styles.row,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.rowHeader}>
                      <View style={styles.rowText}>
                        {/* Full text: no line cap. */}
                        {row.text ? (
                          <AppText role="body">{row.text}</AppText>
                        ) : null}
                        {row.label ? (
                          <AppText
                            role="caption"
                            style={{ color: colors.textSecondary }}
                          >
                            {row.label}
                          </AppText>
                        ) : null}
                      </View>
                      {/* D-130: the pencil at the row's top right. */}
                      <Button
                        role="iconOnly"
                        icon="edit"
                        accessibilityLabel="Edit Off Limits item"
                        disabled={controlsHeld}
                        onPress={() => openForm({ mode: "edit", row })}
                      />
                    </View>
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
                          accessibilityLabel="Open Off Limits link"
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
                ),
              )}
              {/* An edited row a reload removed keeps its form, at the end. */}
              {form?.mode === "edit" &&
              !rows.some((row) => row.id === form.row.id)
                ? renderEditForm(form.row)
                : null}
            </>
          )}
        </KeyboardCenteringProvider>
        {bottomSpacer}
      </Animated.ScrollView>
      {moveRow !== null ? (
        <MoveEntrySheet
          entryRef={{ table: "off_limits", id: moveRow.id, contactId }}
          row={moveRow}
          section="off_limits"
          contactName={person?.name ?? null}
          onMoved={() => void load()}
          onMoveUndone={() => void load()}
          onClose={() => setMoveRow(null)}
        />
      ) : null}
      {/* Rendered last, so it floats over the content (D-131). */}
      <SectionAddFab
        morph={morph}
        icon={sectionFabIcon("off_limits")}
        label={ADD_OFF_LIMITS_ITEM}
        hint="Scrolls to the top and opens the add form."
        onPress={openAddFromFab}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: SPACING.md, padding: SPACING.base },
  link: { alignSelf: "flex-start" },
  readState: { minHeight: 88, alignItems: "center", justifyContent: "center" },
  readError: { gap: SPACING.sm, alignItems: "flex-start" },
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
  rowText: { flex: 1, gap: SPACING.xs },
});
