/**
 * FieldDefForm — create or edit ONE custom-field DEFINITION (§14.10 item 1).
 *
 * This edits the field DEF (label, type, dropdown options, show_on_new,
 * always_show), NOT per-contact values. On CREATE it composes the FULL
 * `NewFieldDef` payload the data layer requires — deriving `col_name` via
 * `makeColName` over the caller's existing-col_name set (built from
 * `listDefs({ includeQuarantined: true })` so a re-created label cannot collide
 * with a quarantined field's still-present column), minting `uid` via
 * `newUid`, taking the append `display_order` the caller supplies, stamping
 * `now` via `localDateTime` (written to BOTH created_at and modified_at), and
 * defaulting `share_with_ai` to 0 (no toggle this phase — deferred to Phase 14,
 * so surfacing one would be dead UI). On EDIT it emits the edited draft; the
 * caller (CustomFieldsScreen) diffs it against the original def and routes each
 * change through the matching DAO op (rename / changeFieldOptions /
 * updateFieldCuration / the pre-flight + applyTypeChange flow).
 *
 * A live `FieldValueInput` preview renders the currently-selected type so the
 * owner can see the field's input at the --to 3 gate; the photo type shows the
 * deferred Plan-06 placeholder. Every colour resolves through
 * `useTheme().colors.*` — there is no colour literal here (CLAUDE.md).
 */
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { FieldValueInput } from "@/components/FieldValueInput";
import { makeColName } from "@/db/col-name";
import { localDateTime } from "@/db/database";
import type { CustomFieldDef, NewFieldDef, SqliteBool } from "@/db/field-types";
import { newUid } from "@/db/uid";
import type { FieldType } from "@/schemas/types";
import { useTheme } from "@/theme";

/** Human labels for the 7 FieldType values (picker order mirrors the union). */
const FIELD_TYPES: ReadonlyArray<{ value: FieldType; label: string }> = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Text area" },
  { value: "dropdown", label: "Dropdown" },
  { value: "date", label: "Date" },
  { value: "toggle", label: "Toggle" },
  { value: "number", label: "Number" },
  { value: "photo", label: "Photo" },
];

/** The edited-definition delta the caller diffs against the original def. */
export interface FieldDefDraft {
  label: string;
  type: FieldType;
  options: string | null;
  show_on_new: SqliteBool;
  always_show: SqliteBool;
}

interface CreateProps {
  mode: "create";
  /** col_names already in use (incl. quarantined) — makeColName uniquifies. */
  existingColNames: ReadonlySet<string>;
  /** The append position for the new def's display_order. */
  nextDisplayOrder: number;
  onSubmit: (def: NewFieldDef) => void;
  onCancel: () => void;
}

interface EditProps {
  mode: "edit";
  field: CustomFieldDef;
  onSubmit: (draft: FieldDefDraft) => void;
  onCancel: () => void;
}

export type FieldDefFormProps = CreateProps | EditProps;

/** Parse the DEFS `options` JSON TEXT to a string[] (null/malformed → []). */
function parseOptions(options: string | null): string[] {
  if (options == null) return [];
  try {
    const parsed: unknown = JSON.parse(options);
    return Array.isArray(parsed)
      ? parsed.filter((o): o is string => typeof o === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * Build the DEFS `options` JSON TEXT from the editor rows (empty → null).
 * De-duplicates (preserving first-occurrence order) so a dropdown never
 * persists repeated option strings — duplicates would collide in
 * DropdownFieldWidget's `keyExtractor={(item) => item}` (duplicate React keys →
 * dev warning + unstable reconciliation) and make `includes`/`isValueInOptions`
 * membership ambiguous.
 */
function buildOptions(type: FieldType, rows: string[]): string | null {
  if (type !== "dropdown") return null;
  const cleaned = [
    ...new Set(rows.map((r) => r.trim()).filter((r) => r.length > 0)),
  ];
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

const toBool = (b: boolean): SqliteBool => (b ? 1 : 0);

export function FieldDefForm(props: FieldDefFormProps) {
  const { colors } = useTheme();

  const initial = props.mode === "edit" ? props.field : null;
  const [label, setLabel] = useState(initial?.label ?? "");
  const [type, setType] = useState<FieldType>(initial?.type ?? "text");
  const [optionRows, setOptionRows] = useState<string[]>(
    initial ? parseOptions(initial.options) : [],
  );
  const [showOnNew, setShowOnNew] = useState(initial?.show_on_new === 1);
  const [alwaysShow, setAlwaysShow] = useState(initial?.always_show === 1);
  // A live, throwaway value so the owner can drive the previewed widget.
  const [previewValue, setPreviewValue] = useState<string | null>(null);

  const options = useMemo(
    () => buildOptions(type, optionRows),
    [type, optionRows],
  );

  const previewField = useMemo(
    () => ({ type, label: label.trim() || "Preview", options }),
    [type, label, options],
  );

  const canSubmit = label.trim().length > 0;

  function setOptionAt(index: number, value: string) {
    setOptionRows((rows) => rows.map((r, i) => (i === index ? value : r)));
  }
  function addOption() {
    setOptionRows((rows) => [...rows, ""]);
  }
  function removeOptionAt(index: number) {
    setOptionRows((rows) => rows.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    if (!canSubmit) return;
    const trimmedLabel = label.trim();
    if (props.mode === "create") {
      const now = localDateTime();
      const colName = makeColName(trimmedLabel, props.existingColNames);
      const def: NewFieldDef = {
        uid: newUid(),
        col_name: colName,
        label: trimmedLabel,
        type,
        options,
        show_on_new: toBool(showOnNew),
        always_show: toBool(alwaysShow),
        display_order: props.nextDisplayOrder,
        share_with_ai: 0,
        now,
      };
      props.onSubmit(def);
      return;
    }
    props.onSubmit({
      label: trimmedLabel,
      type,
      options,
      show_on_new: toBool(showOnNew),
      always_show: toBool(alwaysShow),
    });
  }

  return (
    <ScrollView
      testID="field-def-form"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.heading, { color: colors.textPrimary }]}>
        {props.mode === "create" ? "New field" : "Edit field"}
      </Text>

      {/* Label */}
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
        Label
      </Text>
      <TextInput
        testID="field-def-label"
        accessibilityLabel="Field label"
        value={label}
        onChangeText={setLabel}
        placeholder="e.g. Birthday"
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          {
            color: colors.textPrimary,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      />

      {/* Type picker */}
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
        Type
      </Text>
      <View style={styles.typeRow}>
        {FIELD_TYPES.map((t) => {
          const selected = t.value === type;
          return (
            <Pressable
              key={t.value}
              testID={`field-def-type-${t.value}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Type ${t.label}`}
              onPress={() => setType(t.value)}
              style={[
                styles.typeChip,
                {
                  backgroundColor: selected ? colors.accent : colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? colors.background : colors.textPrimary,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Dropdown options editor — only when the type is dropdown */}
      {type === "dropdown" ? (
        <View testID="field-def-options">
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            Options
          </Text>
          {optionRows.map((row, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
            <View key={index} style={styles.optionRow}>
              <TextInput
                testID={`field-def-option-${index}`}
                accessibilityLabel={`Option ${index + 1}`}
                value={row}
                onChangeText={(v) => setOptionAt(index, v)}
                placeholder={`Option ${index + 1}`}
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.input,
                  styles.optionInput,
                  {
                    color: colors.textPrimary,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              />
              <Pressable
                testID={`field-def-option-remove-${index}`}
                accessibilityRole="button"
                accessibilityLabel={`Remove option ${index + 1}`}
                onPress={() => removeOptionAt(index)}
                style={[styles.removeBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textSecondary }}>Remove</Text>
              </Pressable>
            </View>
          ))}
          <Pressable
            testID="field-def-option-add"
            accessibilityRole="button"
            accessibilityLabel="Add option"
            onPress={addOption}
            style={[styles.addBtn, { borderColor: colors.borderStrong }]}
          >
            <Text style={{ color: colors.accent }}>Add option</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Curation flags */}
      <View style={styles.switchRow}>
        <Text style={[styles.switchLabel, { color: colors.textPrimary }]}>
          Show on new-contact form
        </Text>
        <Switch
          testID="field-def-show-on-new"
          accessibilityLabel="Show on new-contact form"
          value={showOnNew}
          onValueChange={setShowOnNew}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={colors.surfaceElevated}
        />
      </View>
      <View style={styles.switchRow}>
        <Text style={[styles.switchLabel, { color: colors.textPrimary }]}>
          Always show on profile
        </Text>
        <Switch
          testID="field-def-always-show"
          accessibilityLabel="Always show on profile"
          value={alwaysShow}
          onValueChange={setAlwaysShow}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={colors.surfaceElevated}
        />
      </View>

      {/* Live preview of the selected type's value widget */}
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
        Preview
      </Text>
      <View
        style={[
          styles.preview,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <FieldValueInput
          testID="field-def-preview"
          field={previewField}
          value={previewValue}
          onChange={setPreviewValue}
        />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          testID="field-def-cancel"
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          onPress={props.onCancel}
          style={[styles.actionBtn, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textSecondary }}>Cancel</Text>
        </Pressable>
        <Pressable
          testID="field-def-submit"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          accessibilityLabel={props.mode === "create" ? "Create field" : "Save"}
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={[
            styles.actionBtn,
            styles.submitBtn,
            {
              backgroundColor: canSubmit ? colors.accent : colors.surface,
              borderColor: canSubmit ? colors.accent : colors.border,
            },
          ]}
        >
          <Text
            style={{
              color: canSubmit ? colors.background : colors.textSecondary,
            }}
          >
            {props.mode === "create" ? "Create field" : "Save"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 8,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  optionInput: {
    flex: 1,
  },
  removeBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addBtn: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  switchLabel: {
    fontSize: 15,
    flex: 1,
    paddingRight: 12,
  },
  preview: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 24,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  submitBtn: {
    minWidth: 120,
    alignItems: "center",
  },
});
