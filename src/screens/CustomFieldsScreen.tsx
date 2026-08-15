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
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { type FieldDefDraft, FieldDefForm } from "@/components/FieldDefForm";
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
} from "@/db/field-defs-dao";
import {
  applyTypeChange,
  preflightOptionsChange,
  preflightTypeChange,
} from "@/db/field-type-change";
import type { CustomFieldDef, NewFieldDef } from "@/db/field-types";
import { useTheme } from "@/theme";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "custom-fields";

interface CustomFieldsScreenProps {
  /** Return to the home shell (wired by HomeScreen's dependency-free route). */
  onBack: () => void;
}

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

/** Promise wrapper over Alert so a pre-flight summary reads as ONE gate. */
function confirmSummary(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Apply", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function CustomFieldsScreen({ onBack }: CustomFieldsScreenProps) {
  const { colors } = useTheme();
  const [defs, setDefs] = useState<CustomFieldDef[]>([]);
  const [emptyById, setEmptyById] = useState<Record<number, boolean>>({});
  const [editor, setEditor] = useState<Editor>(null);

  /** Load all defs (incl. quarantined) and each field's emptiness. */
  const load = useCallback(async () => {
    try {
      const exec = getExecutor();
      const all = await listDefs(exec, { includeQuarantined: true });
      const empties: Record<number, boolean> = {};
      for (const d of all) {
        empties[d.id] = await isFieldEmpty(exec, d.col_name);
      }
      setDefs(all);
      setEmptyById(empties);
    } catch (err) {
      Logger.error(LOG_SCOPE, "failed to load custom fields", err);
      Alert.alert("Couldn't load custom fields", "Please reopen this screen.");
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
    Alert.alert("Couldn't update field", "Please try again.");
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
      // Label — a stable-slug rename edits `label` only.
      if (draft.label !== field.label) {
        await renameField(exec, field.id, draft.label, localDateTime());
      }
      // Curation flags — persisted via updateFieldCuration.
      if (
        draft.show_on_new !== field.show_on_new ||
        draft.always_show !== field.always_show
      ) {
        await updateFieldCuration(
          exec,
          field.id,
          draft.show_on_new,
          draft.always_show,
          localDateTime(),
        );
      }

      if (draft.type !== field.type) {
        // Type change — pre-flight summary is the single confirmation, then
        // applyTypeChange with the CURRENT type so history records the move.
        const pf = await preflightTypeChange(exec, field, draft.type);
        if (await confirmSummary("Change field type", typeSummary(pf))) {
          await applyTypeChange(
            exec,
            { id: field.id, col_name: field.col_name, type: field.type },
            draft.type,
            localDateTime(),
          );
          // The new type's options (dropdown) still need persisting.
          if (draft.type === "dropdown" && draft.options !== field.options) {
            await changeFieldOptions(
              exec,
              field.id,
              draft.options,
              localDateTime(),
            );
          }
        }
      } else if (draft.options !== field.options) {
        // Same-type options edit — pre-flight summary then changeFieldOptions.
        const pf = await preflightOptionsChange(exec, field, draft.options);
        if (
          await confirmSummary("Change dropdown options", optionsSummary(pf))
        ) {
          await changeFieldOptions(
            exec,
            field.id,
            draft.options,
            localDateTime(),
          );
        }
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

  function onDeletePress(field: CustomFieldDef) {
    const empty = emptyById[field.id] === true;
    const verb = empty ? "Delete" : "Quarantine";
    const message = empty
      ? `"${field.label}" is empty and will be deleted permanently.`
      : `"${field.label}" has values and will be quarantined for 30 days — you can restore it before then.`;
    Alert.alert(`${verb} field`, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: verb,
        style: empty ? "destructive" : "default",
        onPress: () => void doDelete(field),
      },
    ]);
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

  // -- The create/edit form takes over the whole screen when open. -----------
  if (editor !== null) {
    if (editor.mode === "create") {
      return (
        <FieldDefForm
          mode="create"
          existingColNames={existingColNames}
          nextDisplayOrder={nextDisplayOrder}
          onSubmit={(def) => void handleCreate(def)}
          onCancel={() => setEditor(null)}
        />
      );
    }
    const editing = editor.field;
    return (
      <FieldDefForm
        mode="edit"
        field={editing}
        onSubmit={(draft) => void handleEdit(editing, draft)}
        onCancel={() => setEditor(null)}
      />
    );
  }

  return (
    <ScrollView
      testID="custom-fields-screen"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Pressable
          testID="custom-fields-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={[styles.backBtn, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Back</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.textPrimary }]}
        >
          Custom Fields
        </Text>
      </View>

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
        <Text style={{ color: colors.background, fontWeight: "600" }}>
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
                <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                  {field.label}
                </Text>
                <Text style={[styles.rowType, { color: colors.textSecondary }]}>
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
                      color: index === 0 ? colors.border : colors.textSecondary,
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
                  <Text style={{ color: colors.accent }}>Edit</Text>
                </Pressable>
                <Pressable
                  testID={`field-delete-${field.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${empty ? "Delete" : "Quarantine"} ${
                    field.label
                  }`}
                  onPress={() => onDeletePress(field)}
                  style={[styles.iconBtn, { borderColor: colors.borderStrong }]}
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
                <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
                  {field.label}
                </Text>
                <Text style={[styles.rowType, { color: colors.textSecondary }]}>
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
                <Text style={{ color: colors.accent }}>Restore</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
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
