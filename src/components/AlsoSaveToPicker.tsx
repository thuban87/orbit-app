/**
 * AlsoSaveToPicker (Phase 38.10 D-38, D-40, D-42, D-95, D-96) — the one-section
 * "Also save to" control on Log Interaction, the Add Note sheet and Group Log.
 *
 * A single-select chip row: None (the default) and the four sections in D-38
 * order. At most one section per note (D-95). The parent owns the choice and
 * the save; this control imports no DAO.
 *
 * Disabled while the note is blank (convergence c10, Codex C-01): the parent
 * passes `disabled`, and its note-change handler resets the choice to None
 * through `alsoSaveChoiceAfterNoteChange`, so a disabled chip never stays
 * selected. Disabled chips are dimmed (38.9 D-26).
 *
 * Chip colours come from `chipTone("primary", …)` (38.9 D-05) and resolve
 * through theme tokens (CLAUDE.md / check:colors).
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { chipTone } from "@/components/ui/chip-tone";
import type { LinkedSection } from "@/db/linked-entry-dao";
import {
  ALSO_SAVE_TO_NONE_LABEL,
  ALSO_SAVE_TO_SECTIONS,
  alsoSaveToLabel,
} from "@/logic/also-save-to-logic";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";

export interface AlsoSaveToPickerProps {
  /** The chosen section, or null for None. */
  value: LinkedSection | null;
  onChange: (next: LinkedSection | null) => void;
  /** True while the note is blank (or a save holds the form). */
  disabled?: boolean;
  /** Stable testID root; each chip is `${testID}-${section | "none"}`. */
  testID?: string;
}

const OPTIONS: ReadonlyArray<{ value: LinkedSection | null; label: string }> = [
  { value: null, label: ALSO_SAVE_TO_NONE_LABEL },
  ...ALSO_SAVE_TO_SECTIONS.map((section) => ({
    value: section,
    label: alsoSaveToLabel(section),
  })),
];

export function AlsoSaveToPicker({
  value,
  onChange,
  disabled = false,
  testID = "also-save-to",
}: AlsoSaveToPickerProps) {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={styles.field}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Also save to
      </Text>
      <View style={styles.chips}>
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          const tone = chipTone("primary", selected);
          return (
            <Pressable
              key={option.value ?? "none"}
              testID={`${testID}-${option.value ?? "none"}`}
              accessibilityRole="button"
              accessibilityLabel={`Also save to ${option.label}`}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => {
                if (!selected) onChange(option.value);
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: colors[tone.fill],
                  borderColor: colors[tone.border],
                  opacity: disabled ? 0.5 : 1,
                },
              ]}
            >
              <Text style={[styles.chipLabel, { color: colors[tone.label] }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: SPACING.sm },
  label: { fontSize: 13, fontWeight: "600" },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  chipLabel: { fontSize: 14, fontWeight: "600" },
});
