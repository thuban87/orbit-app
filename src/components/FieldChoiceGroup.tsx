import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/icons/Icon";
import { useTheme } from "@/theme";

export type FieldChoiceMode = "additive" | "conflict" | "removed";

export interface FieldChoiceOption<T extends string = string> {
  id: T;
  value: string;
  provenance: string;
  recommended?: boolean;
  danger?: boolean;
}

interface FieldChoiceGroupProps<T extends string> {
  label: string;
  options: readonly FieldChoiceOption<T>[];
  mode: FieldChoiceMode;
  /** Controlled selection, if the caller keeps merge/reconciliation state. */
  selectedId?: T | null;
  /**
   * Multi-select mode (convergence c3 D-1): when set, every listed id is
   * selected, rows are checkboxes, and a tap calls `onToggle` (else
   * `onChange`); the caller owns the toggle rule. Single-choice callers
   * (MergeConflicts, PhotoChoice, Reconcile name/birthday) leave it unset.
   */
  selectedIds?: readonly T[];
  onToggle?: (option: FieldChoiceOption<T>) => void;
  onChange: (option: FieldChoiceOption<T>) => void;
}

function initialSelection<T extends string>(
  options: readonly FieldChoiceOption<T>[],
  mode: FieldChoiceMode,
): T | null {
  if (mode === "conflict") return null;
  return (
    options.find((option) => option.recommended && !option.danger)?.id ?? null
  );
}

/**
 * Shared, write-free scalar resolver for reconciliation and merge conflicts.
 * The caller owns persistence; this component only reports an explicit choice.
 */
export function FieldChoiceGroup<T extends string>({
  label,
  options,
  mode,
  selectedId,
  selectedIds,
  onToggle,
  onChange,
}: FieldChoiceGroupProps<T>) {
  const multiple = selectedIds !== undefined;
  const { colors } = useTheme();
  const [uncontrolledSelection, setUncontrolledSelection] = useState<T | null>(
    () => initialSelection(options, mode),
  );
  const selection =
    selectedId === undefined ? uncontrolledSelection : selectedId;

  useEffect(() => {
    if (selectedId === undefined)
      setUncontrolledSelection(initialSelection(options, mode));
  }, [mode, options, selectedId]);

  return (
    <View accessibilityLabel={`${label} choice`} style={styles.group}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      {options.map((option) => {
        const selected = multiple
          ? selectedIds.includes(option.id)
          : selection === option.id;
        return (
          // `id` is the selection bucket (e.g. "source"), not unique per row: a
          // multi-value family yields several options sharing one id, so the
          // React key also folds in the per-row value. Selection identity stays `id`.
          <Pressable
            key={`${option.id}:${option.value}`}
            accessibilityRole={multiple ? "checkbox" : "radio"}
            accessibilityState={multiple ? { checked: selected } : { selected }}
            accessibilityLabel={`${label}: ${option.value}, ${option.provenance}`}
            onPress={() => {
              if (multiple) {
                (onToggle ?? onChange)(option);
                return;
              }
              if (selectedId === undefined) setUncontrolledSelection(option.id);
              onChange(option);
            }}
            style={[
              styles.option,
              {
                backgroundColor: colors.surface,
                borderColor: selected ? colors.accent : colors.border,
              },
              selected && styles.selected,
            ]}
          >
            {/* Every row reads as selectable before a tap: an empty radio or
                checkbox, filled in the accent when chosen (38.12 D-48). */}
            <Icon
              name={multiple ? "checkbox" : "select"}
              state={selected ? "active" : "default"}
              tone={selected ? "accentText" : "textSecondary"}
            />
            <View style={styles.copy}>
              <Text style={[styles.value, { color: colors.textPrimary }]}>
                {option.value}
              </Text>
              <Text
                style={[
                  styles.provenance,
                  {
                    color: option.danger ? colors.danger : colors.textSecondary,
                  },
                ]}
              >
                {option.danger ? "Remove · " : ""}
                {option.provenance}
              </Text>
              {option.recommended && !option.danger ? (
                <View
                  style={[
                    styles.chip,
                    { backgroundColor: colors.surfaceElevated },
                  ]}
                >
                  <Text
                    style={[styles.chipText, { color: colors.textSecondary }]}
                  >
                    Recommended
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: { fontSize: 13, fontWeight: "600" },
  option: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  selected: { borderWidth: 2, padding: 11 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  value: { fontSize: 15, fontWeight: "400", flexShrink: 1 },
  provenance: { fontSize: 13, fontWeight: "400", flexShrink: 1 },
  chip: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: { fontSize: 13, fontWeight: "600" },
});
