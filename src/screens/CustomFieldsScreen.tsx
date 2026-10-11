/**
 * CustomFieldsScreen — the Settings → Custom Fields management surface
 * (§14.10 item 1). Lists field DEFINITIONS, creates/edits/reorders them, runs
 * the dynamic delete/quarantine action, and drives a type change through the
 * pre-flight summary. This composes the whole Phase-3 data layer into the
 * user-facing capability of FLD-02/03/04/05 and the FLD-07 curation flags.
 *
 * The screen NEVER builds SQL: user label/type/options input becomes a col_name
 * + ALTER TABLE only through the tested data layer (makeColName in FieldDefForm,
 * the DAO/DDL ops here) — the T-03-01 trust-boundary mitigation.
 *
 * DATA-SAFETY (§14.5 / T-03-02): the delete control is dynamic — `isFieldEmpty`
 * decides Delete (immediate, empty only) vs Quarantine (reversible 30d,
 * populated). `deleteOrQuarantineField` re-checks emptiness atomically, so the
 * label here is an affordance and the DDL is the guard.
 *
 * TYPE / OPTIONS changes (§14.4): a type change runs `preflightTypeChange` and
 * shows the "N convert / K need your input" summary as the SINGLE confirmation
 * (no separate second prompt), then `applyTypeChange` with the CURRENT type so
 * `field_history` records the transition; an options edit runs
 * `preflightOptionsChange` before `changeFieldOptions` the same way.
 *
 * Every colour resolves through `useTheme().colors.*` — no colour literal
 * (CLAUDE.md). The executor comes from `getExecutor()` (Plan 07).
 */
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { type FieldDefDraft, FieldDefForm } from "@/components/FieldDefForm";
import { ShellAppBar } from "@/components/ShellAppBar";
import { resolveNewItemAiDefault } from "@/db/ai-permissions-dao";
import { getExecutor, localDateTime } from "@/db/database";
import { createField, deleteOrQuarantineField } from "@/db/field-ddl";
import {
  changeFieldOptions,
  isFieldEmpty,
  listDefs,
  renameField,
  reorderFields,
  restoreField,
  updateFieldCuration,
  updateFieldShareWithAi,
} from "@/db/field-defs-dao";
import {
  applyTypeChange,
  preflightOptionsChange,
  preflightTypeChange,
} from "@/db/field-type-change";
import type { CustomFieldDef, NewFieldDef } from "@/db/field-types";
import { useDiscardKeepGuard } from "@/navigation/discard-keep-guard";
import { useBottomClearance } from "@/navigation/use-bottom-clearance";
import { confirm, notice } from "@/stores/confirm-store";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "custom-fields";

/** The active editor: creating a new def, or editing an existing one. */
type Editor =
  | { mode: "create" }
  | { mode: "edit"; field: CustomFieldDef }
  | null;

/** Human summary of a type-change pre-flight (the §14.4 confirmation text). */
function typeSummary(pf: { total: number; convert: number[]; flag: number[] }) {
  return (
    `${pf.convert.length} of ${pf.total} will convert automatically.\n` +
    `${pf.flag.length} need your input — fix now or later.`
  );
}

/** Human summary of an options-change pre-flight. */
function optionsSummary(pf: { total: number; keep: number[]; flag: number[] }) {
  return (
    `${pf.keep.length} of ${pf.total} will be kept.\n` +
    `${pf.flag.length} need your input — fix now or later.`
  );
}

/**
 * A pre-flight summary as ONE themed gate (38.9 D-27). Non-destructive and
 * dismissable: Back or the scrim cancel, exactly like Cancel.
 */
function confirmSummary(title: string, message: string): Promise<boolean> {
  return confirm({ title, message, confirmLabel: "Apply", dismissable: true });
}

/**
 * Back is the shared header's (38.9 D-16, D-44), rendered once above the
 * list/editor switch so every branch has it (review M4). With the field editor
 * open, the header's `goBack()` fires `beforeRemove`, which the sub-editor
 * guard below turns into the same dirty-aware close as the hardware Back
 * (D-14); the editor's own Cancel keeps `requestClose` (D-61).
 */
export function CustomFieldsScreen() {
  const { colors } = useTheme();
  // The last item scrolls fully above the shell FAB (38.4 D-52, OA-E3).
  const bottomClearance = useBottomClearance();
  const [defs, setDefs] = useState<CustomFieldDef[]>([]);
  const [emptyById, setEmptyById] = useState<Record<number, boolean>>({});
  const [editor, setEditor] = useState<Editor>(null);
  const [newFieldShareDefault, setNewFieldShareDefault] = useState<0 | 1>(0);

  // In-screen sub-editor guard (G-04; D-14, D-61; RESEARCH DC-08): Back with
  // the field editor open closes it and stays (asking only when it holds typed
  // changes); its Cancel follows the same rule. A successful create/edit
  // closes directly through setEditor(null), with no prompt.
  const [editorDirty, setEditorDirty] = useState(false);
  const bypassRef = useRef(false);
  const closeEditor = () => {
    setEditor(null);
    setEditorDirty(false);
  };
  const { requestClose } = useDiscardKeepGuard({
    hasUnsavedChanges: false,
    bypassRef,
    subEditor: {
      open: editor !== null,
      dirty: editorDirty,
      close: closeEditor,
    },
  });

  /** Load all defs (incl. quarantined) and each field's emptiness. */
  const load = useCallback(async () => {
    try {
      const exec = getExecutor();
      const [all, shareDefault] = await Promise.all([
        listDefs(exec, { includeQuarantined: true }),
        resolveNewItemAiDefault(exec, "custom-field"),
      ]);
      const empties: Record<number, boolean> = {};
      for (const d of all) {
        empties[d.id] = await isFieldEmpty(exec, d.id);
      }
      setDefs(all);
      setNewFieldShareDefault(shareDefault);
      setEmptyById(empties);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load custom fields", err);
      void notice({
        title: "Couldn't load custom fields",
        message: "Please reopen this screen.",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = useMemo(
    () => defs.filter((d) => d.quarantined_at === null),
    [defs],
  );
  const quarantined = useMemo(
    () => defs.filter((d) => d.quarantined_at !== null),
    [defs],
  );

  // The create path uniquifies against EVERY col_name, incl. quarantined
  // fields' still-present columns, so a re-created label can't collide.
  const existingColNames = useMemo(
    () => new Set(defs.map((d) => d.col_name)),
    [defs],
  );
  const nextDisplayOrder = useMemo(
    () =>
      defs.length === 0 ? 0 : Math.max(...defs.map((d) => d.display_order)) + 1,
    [defs],
  );

  function reportError(err: unknown) {
    Logger.error(LOG_SCOPE, "field mutation failed", err);
    showSnackbar({
      kind: "error",
      label: "Couldn't update field. Please try again.",
    });
  }

  async function handleCreate(def: NewFieldDef) {
    try {
      await createField(getExecutor(), def);
      setEditor(null);
      await load();
    } catch (err) {
      reportError(err);
    }
  }

  async function handleEdit(field: CustomFieldDef, draft: FieldDefDraft) {
    const exec = getExecutor();
    try {
      const labelChanged = draft.label !== field.label;
      const curationChanged =
        draft.show_on_new !== field.show_on_new ||
        draft.always_show !== field.always_show;
      const shareChanged = draft.share_with_ai !== field.share_with_ai;
      const typeChanged = draft.type !== field.type;
      const optionsChanged = draft.options !== field.options;

      // ALL-OR-NOTHING ON CANCEL (WR-03): the pre-flight summary is an
      // interactive gate, and the pre-flights (preflightTypeChange /
      // preflightOptionsChange) are strictly READ-ONLY. Run the gate FIRST,
      // before ANY write, so that cancelling it discards the entire edit —
      // label/curation are no longer committed ahead of a cancelled type or
      // options change. A type change and an options edit are mutually
      // exclusive gates (a type change to dropdown carries its options through
      // the type pre-flight), mirroring the original branch structure.
      if (typeChanged) {
        const pf = await preflightTypeChange(exec, field, draft.type);
        if (!(await confirmSummary("Change field type", typeSummary(pf)))) {
          return; // cancelled — nothing has been written
        }
      } else if (optionsChanged) {
        const pf = await preflightOptionsChange(exec, field, draft.options);
        if (
          !(await confirmSummary("Change dropdown options", optionsSummary(pf)))
        ) {
          return; // cancelled — nothing has been written
        }
      }

      // Every gate passed — apply each diff. Each DAO op owns its OWN
      // `inWriteTransaction`; they are NEVER composed inside an outer
      // transaction (the shared mutex is non-reentrant — transaction.ts).
      // Label — a stable-slug rename edits `label` only.
      if (labelChanged) {
        await renameField(exec, field.id, draft.label, localDateTime());
      }
      // Curation flags — persisted via updateFieldCuration.
      if (curationChanged) {
        await updateFieldCuration(
          exec,
          field.id,
          draft.show_on_new,
          draft.always_show,
          localDateTime(),
        );
      }
      // AI-sharing opt-in — persisted via its own DEFS-row flag writer so a
      // toggled opt-in survives the edit (H7). Same standalone-transaction idiom
      // as the curation write; never composed inside an outer transaction.
      if (shareChanged) {
        await updateFieldShareWithAi(
          exec,
          field.id,
          draft.share_with_ai,
          localDateTime(),
        );
      }
      // Type change — applyTypeChange with the CURRENT type so field_history
      // records the transition (blast radius zero — no value rewrite).
      if (typeChanged) {
        await applyTypeChange(
          exec,
          { id: field.id, col_name: field.col_name, type: field.type },
          draft.type,
          localDateTime(),
        );
      }
      // Options persist whenever the edited field IS a dropdown and its options
      // moved — covering both a same-type options edit and a type change INTO
      // dropdown (matches the original behaviour, which only wrote options when
      // draft.type === "dropdown").
      if (optionsChanged && draft.type === "dropdown") {
        await changeFieldOptions(
          exec,
          field.id,
          draft.options,
          localDateTime(),
        );
      }

      setEditor(null);
      await load();
    } catch (err) {
      reportError(err);
    }
  }

  async function moveField(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= active.length) return;
    const reordered = [...active];
    const tmp = reordered[index];
    reordered[index] = reordered[target];
    reordered[target] = tmp;
    // Reorder over the FULL set (active first, quarantined after) so
    // display_order stays a clean contiguous total order.
    const orderedIds = [
      ...reordered.map((d) => d.id),
      ...quarantined.map((d) => d.id),
    ];
    try {
      await reorderFields(getExecutor(), orderedIds, localDateTime());
      await load();
    } catch (err) {
      reportError(err);
    }
  }

  async function onDeletePress(field: CustomFieldDef) {
    const empty = emptyById[field.id] === true;
    const verb = empty ? "Delete" : "Quarantine";
    const message = empty
      ? `"${field.label}" is empty and will be deleted permanently.`
      : `"${field.label}" has values and will be quarantined for 30 days — you can restore it before then.`;
    // An empty field is deleted permanently: a destructive, non-dismissable
    // confirm (D-06, ADR-086). A field with values is quarantined, which is
    // recoverable for 30 days (HANDOFF §14.5; "Quarantine" stays, D-41), so it
    // stays a plain dismissable confirm, as before.
    const confirmed = await confirm({
      title: `${verb} field`,
      message,
      confirmLabel: verb,
      destructive: empty,
    });
    if (confirmed) await doDelete(field);
  }

  async function doDelete(field: CustomFieldDef) {
    try {
      await deleteOrQuarantineField(
        getExecutor(),
        { id: field.id, col_name: field.col_name },
        localDateTime(),
      );
      await load();
    } catch (err) {
      reportError(err);
    }
  }

  async function doRestore(field: CustomFieldDef) {
    try {
      await restoreField(getExecutor(), field.id, localDateTime());
      await load();
    } catch (err) {
      reportError(err);
    }
  }

  // -- The create/edit form takes over the body when open; the header stays. --
  let body: ReactNode;
  if (editor !== null && editor.mode === "create") {
    body = (
      <FieldDefForm
        mode="create"
        existingColNames={existingColNames}
        nextDisplayOrder={nextDisplayOrder}
        initialShareWithAi={newFieldShareDefault}
        bottomClearance={bottomClearance}
        onDirtyChange={setEditorDirty}
        onSubmit={(def) => void handleCreate(def)}
        onCancel={() => requestClose(closeEditor, editorDirty)}
      />
    );
  } else if (editor !== null) {
    const editing = editor.field;
    body = (
      <FieldDefForm
        mode="edit"
        field={editing}
        bottomClearance={bottomClearance}
        onDirtyChange={setEditorDirty}
        onSubmit={(draft) => void handleEdit(editing, draft)}
        onCancel={() => requestClose(closeEditor, editorDirty)}
      />
    );
  } else {
    body = (
      <ScrollView
        testID="custom-fields-screen"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomClearance },
        ]}
      >
        <Pressable
          testID="custom-fields-new"
          accessibilityRole="button"
          accessibilityLabel="New field"
          onPress={() => setEditor({ mode: "create" })}
          style={[
            styles.newBtn,
            { backgroundColor: colors.accent, borderColor: colors.accent },
          ]}
        >
          <Text style={{ color: colors.onAccent, fontWeight: "600" }}>
            New field
          </Text>
        </Pressable>

        {active.length === 0 ? (
          <Text
            testID="custom-fields-empty"
            style={[styles.emptyNote, { color: colors.textSecondary }]}
          >
            No custom fields yet. Add one to start describing your people.
          </Text>
        ) : (
          active.map((field, index) => {
            const empty = emptyById[field.id] === true;
            return (
              <View
                key={field.id}
                testID={`field-row-${field.id}`}
                style={[
                  styles.row,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.rowMain}>
                  <Text
                    style={[styles.rowLabel, { color: colors.textPrimary }]}
                  >
                    {field.label}
                  </Text>
                  <Text
                    style={[styles.rowType, { color: colors.textSecondary }]}
                  >
                    {field.type}
                  </Text>
                </View>
                <View style={styles.rowActions}>
                  <Pressable
                    testID={`field-move-up-${field.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${field.label} up`}
                    disabled={index === 0}
                    onPress={() => void moveField(index, -1)}
                    style={[styles.iconBtn, { borderColor: colors.border }]}
                  >
                    <Text
                      style={{
                        color:
                          index === 0 ? colors.border : colors.textSecondary,
                      }}
                    >
                      Up
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`field-move-down-${field.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${field.label} down`}
                    disabled={index === active.length - 1}
                    onPress={() => void moveField(index, 1)}
                    style={[styles.iconBtn, { borderColor: colors.border }]}
                  >
                    <Text
                      style={{
                        color:
                          index === active.length - 1
                            ? colors.border
                            : colors.textSecondary,
                      }}
                    >
                      Down
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`field-edit-${field.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${field.label}`}
                    onPress={() => setEditor({ mode: "edit", field })}
                    style={[styles.iconBtn, { borderColor: colors.border }]}
                  >
                    <Text style={{ color: colors.accentText }}>Edit</Text>
                  </Pressable>
                  <Pressable
                    testID={`field-delete-${field.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`${empty ? "Delete" : "Quarantine"} ${
                      field.label
                    }`}
                    onPress={() => void onDeletePress(field)}
                    style={[
                      styles.iconBtn,
                      { borderColor: colors.borderStrong },
                    ]}
                  >
                    <Text style={{ color: colors.textPrimary }}>
                      {empty ? "Delete" : "Quarantine"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        {quarantined.length > 0 ? (
          <View
            testID="custom-fields-quarantined"
            style={styles.quarantineSection}
          >
            <Text
              style={[styles.sectionHeading, { color: colors.textSecondary }]}
            >
              Quarantined
            </Text>
            {quarantined.map((field) => (
              <View
                key={field.id}
                testID={`quarantined-row-${field.id}`}
                style={[
                  styles.row,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderStrong,
                  },
                ]}
              >
                <View style={styles.rowMain}>
                  <Text
                    style={[styles.rowLabel, { color: colors.textPrimary }]}
                  >
                    {field.label}
                  </Text>
                  <Text
                    style={[styles.rowType, { color: colors.textSecondary }]}
                  >
                    quarantined · {field.type}
                  </Text>
                </View>
                <Pressable
                  testID={`field-restore-${field.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Restore ${field.label}`}
                  onPress={() => void doRestore(field)}
                  style={[styles.iconBtn, { borderColor: colors.accent }]}
                >
                  <Text style={{ color: colors.accentText }}>Restore</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      <ShellAppBar variant="child" title="Custom Fields" />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    padding: 16,
    gap: 12,
  },
  newBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  emptyNote: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  rowMain: {
    gap: 2,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  rowType: {
    fontSize: 13,
  },
  rowActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  iconBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quarantineSection: {
    gap: 10,
    marginTop: 8,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
