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
import { type RefObject, useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { openMemoryLink } from "@/components/MemoryCard";
import { MoveEntrySheet } from "@/components/MoveEntrySheet";
import {
  OffLimitsForm,
  type OffLimitsFormFields,
} from "@/components/OffLimitsForm";
import { ShellAppBar } from "@/components/ShellAppBar";
import {
  AppText,
  Button,
  EmptyState,
  KeyboardCenteringProvider,
  useKeyboardCentering,
} from "@/components/ui";
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
  const { contactId } = route.params;
  // Single-person form: the person line under the fixed title (38.9 D-45).
  const person = useContactHeader(contactId);
  // Snackbars fired after an await read the latest name.
  const nameRef = useRef<string | null>(null);
  nameRef.current = person?.name ?? null;

  const [phase, setPhase] = useState<ReadPhase<OffLimitsRow[]>>(readLoading);
  // Only the latest load may publish; blur invalidates outstanding reads.
  const readAuthority = useMemo(() => createLatestRequestAuthority(), []);

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

  // D-66 on a D-75 editor: the entry field centres above the keyboard.
  const scrollRef = useRef<ScrollView>(null);
  // ScrollView.d.ts types `innerViewRef` as a non-null `RefObject<View>`
  // (as use-first-error-reveal.ts widens it).
  const contentRef = useRef<View>(null) as RefObject<View>;
  const { centering, bottomSpacer } = useKeyboardCentering({
    scrollRef,
    contentRef,
  });

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
      onError: (error) =>
        Logger.error(LOG_SCOPE, "failed to load Off Limits", error),
    });
  }, [controller, readAuthority]);
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
      showSnackbar({
        kind: "success",
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

  return (
    <View style={styles.root}>
      {/* While a save runs the guard holds Back (D-26). */}
      <ShellAppBar
        variant="child"
        title={TITLE}
        person={person}
        backDisabled={saving}
      />
      <ScrollView
        ref={scrollRef}
        innerViewRef={contentRef}
        contentContainerStyle={styles.content}
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
              {rows.length === 0 && form === null ? (
                // D-68: the empty section's one Add action.
                <EmptyState
                  testID="off-limits-editor-empty"
                  icon="list"
                  heading={`Nothing in ${TITLE} yet`}
                  body="Add a topic to avoid bringing up."
                  action={{
                    label: ADD_OFF_LIMITS_ITEM,
                    onPress: () => openForm({ mode: "add" }),
                  }}
                />
              ) : null}
              {rows.map((row) => (
                <View
                  key={row.id}
                  testID={`off-limits-editor-row-${row.id}`}
                  style={[
                    styles.row,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {/* Full text: no line cap. */}
                  {row.text ? <AppText role="body">{row.text}</AppText> : null}
                  {row.label ? (
                    <AppText
                      role="caption"
                      style={{ color: colors.textSecondary }}
                    >
                      {row.label}
                    </AppText>
                  ) : null}
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
                  <View style={styles.actions}>
                    <Button
                      role="secondary"
                      label="Edit"
                      accessibilityLabel="Edit Off Limits item"
                      disabled={controlsHeld}
                      onPress={() => openForm({ mode: "edit", row })}
                    />
                    <Button
                      role="secondary"
                      label="Move"
                      accessibilityLabel="Move Off Limits item"
                      disabled={controlsHeld}
                      onPress={() => setMoveRow(row)}
                    />
                  </View>
                </View>
              ))}
              {form !== null ? (
                <OffLimitsForm
                  key={formKey}
                  testID="off-limits-editor-form"
                  initial={form.mode === "edit" ? form.row : null}
                  onSave={save}
                  onCancel={() => requestClose(closeForm, formDirty)}
                  onDelete={
                    form.mode === "edit" ? () => remove(form.row) : undefined
                  }
                  onDirtyChange={setFormDirty}
                  busy={saving}
                />
              ) : rows.length > 0 ? (
                <Button
                  testID="off-limits-editor-add"
                  role="primary"
                  label={ADD_OFF_LIMITS_ITEM}
                  disabled={saving}
                  onPress={() => openForm({ mode: "add" })}
                />
              ) : null}
            </>
          )}
        </KeyboardCenteringProvider>
        {bottomSpacer}
      </ScrollView>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: SPACING.md, padding: SPACING.base },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  link: { alignSelf: "flex-start" },
  readState: { minHeight: 88, alignItems: "center", justifyContent: "center" },
  readError: { gap: SPACING.sm, alignItems: "flex-start" },
  row: {
    borderRadius: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACING.xs,
    padding: SPACING.sm,
  },
});
