/**
 * FrequencyPicker (CRUD-01) — the fixed-column frequency control the 7-type
 * custom `FieldType` union cannot express (RESEARCH Pattern 1). Renders the 7
 * presets from `FREQUENCY_DAYS` (`src/types.ts` — no re-declared numbers) plus
 * a "Custom…" affordance revealing an integer input + a days/weeks/months unit
 * toggle. Emits a positive-integer `interval_days` via `onChange`; a non-
 * positive / non-integer custom entry is rejected at entry with the locked copy
 * and reported through `onValidityChange` so the parent (CreateContactScreen,
 * Plan 04) can block Save.
 *
 * Controlled: the selected preset derives from the `value` prop. The custom
 * "every N" text/unit is transient input state this component owns; the emitted
 * interval is always driven back out through `onChange`. Validation math lives
 * in the tested pure module `frequency-picker-logic.ts`. Every colour resolves
 * through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "@/theme";
import { FREQUENCY_DAYS, type Frequency } from "@/types";
import {
  INVALID_INTERVAL_MESSAGE,
  type IntervalUnit,
  parseCustomInterval,
} from "./frequency-picker-logic";

interface FrequencyPickerProps {
  /** Current interval in days (the selected preset, or a custom every-N). */
  value: number;
  /** Emits a positive-integer interval_days — never fires on an invalid entry. */
  onChange: (intervalDays: number) => void;
  /** Reports custom-entry validity so the parent can block Save (Plan 04). */
  onValidityChange?: (valid: boolean) => void;
  /** Accessibility label for the control group. */
  label?: string;
  /** Stable testID root; children derive from it. */
  testID?: string;
}

const PRESETS = Object.entries(FREQUENCY_DAYS) as [Frequency, number][];
const PRESET_VALUES = Object.values(FREQUENCY_DAYS);
const UNITS: IntervalUnit[] = ["days", "weeks", "months"];
const UNIT_LABELS: Record<IntervalUnit, string> = {
  days: "Days",
  weeks: "Weeks",
  months: "Months",
};

export function FrequencyPicker({
  value,
  onChange,
  onValidityChange,
  label = "Contact frequency",
  testID = "frequency-picker",
}: FrequencyPickerProps) {
  const { colors } = useTheme();

  // Custom mode is transient input state; open it when the incoming value is
  // not one of the 7 presets. The emitted interval is still driven by onChange.
  const [customMode, setCustomMode] = useState(
    () => !PRESET_VALUES.includes(value),
  );
  const [customRaw, setCustomRaw] = useState(() =>
    PRESET_VALUES.includes(value) ? "" : String(value),
  );
  const [unit, setUnit] = useState<IntervalUnit>("days");

  const custom = parseCustomInterval(customRaw, unit);
  const valid = customMode ? custom.valid : true;

  // Surface validity to the parent (mount + on every change) so Save can block.
  useEffect(() => {
    onValidityChange?.(valid);
  }, [valid, onValidityChange]);

  function selectPreset(days: number) {
    setCustomMode(false);
    onChange(days);
  }

  function openCustom() {
    setCustomMode(true);
    const parsed = parseCustomInterval(customRaw, unit);
    if (parsed.valid && parsed.intervalDays !== null) {
      onChange(parsed.intervalDays);
    }
  }

  function changeCustomText(text: string) {
    setCustomRaw(text);
    const parsed = parseCustomInterval(text, unit);
    if (parsed.valid && parsed.intervalDays !== null) {
      onChange(parsed.intervalDays);
    }
  }

  function changeUnit(nextUnit: IntervalUnit) {
    setUnit(nextUnit);
    const parsed = parseCustomInterval(customRaw, nextUnit);
    if (parsed.valid && parsed.intervalDays !== null) {
      onChange(parsed.intervalDays);
    }
  }

  return (
    <View testID={testID} accessibilityLabel={label} style={styles.group}>
      <View style={styles.chips}>
        {PRESETS.map(([name, days]) => {
          const selected = !customMode && value === days;
          return (
            <Pressable
              key={name}
              testID={`${testID}-preset-${name}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={name}
              onPress={() => selectPreset(days)}
              style={[
                styles.chip,
                {
                  backgroundColor: colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? colors.accent : colors.textPrimary,
                }}
              >
                {name}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          testID={`${testID}-custom`}
          accessibilityRole="button"
          accessibilityState={{ selected: customMode }}
          accessibilityLabel="Custom interval"
          onPress={openCustom}
          style={[
            styles.chip,
            {
              backgroundColor: colors.surface,
              borderColor: customMode ? colors.accent : colors.border,
            },
          ]}
        >
          <Text
            style={{ color: customMode ? colors.accent : colors.textPrimary }}
          >
            Custom…
          </Text>
        </Pressable>
      </View>

      {customMode ? (
        <View style={styles.customArea}>
          <View style={styles.customRow}>
            <TextInput
              testID={`${testID}-custom-input`}
              accessibilityLabel="Custom interval value"
              value={customRaw}
              onChangeText={changeCustomText}
              keyboardType="number-pad"
              placeholder="every N"
              placeholderTextColor={colors.textSecondary}
              style={[
                styles.input,
                {
                  color: colors.textPrimary,
                  backgroundColor: colors.surface,
                  borderColor: custom.valid ? colors.border : colors.danger,
                },
              ]}
            />
            <View style={styles.units}>
              {UNITS.map((u) => {
                const active = unit === u;
                return (
                  <Pressable
                    key={u}
                    testID={`${testID}-unit-${u}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={UNIT_LABELS[u]}
                    onPress={() => changeUnit(u)}
                    style={[
                      styles.unit,
                      {
                        backgroundColor: colors.surface,
                        borderColor: active ? colors.accent : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? colors.accent : colors.textPrimary,
                      }}
                    >
                      {UNIT_LABELS[u]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {custom.valid ? null : (
            <Text
              testID={`${testID}-error`}
              accessibilityLabel={INVALID_INTERVAL_MESSAGE}
              style={[styles.error, { color: colors.danger }]}
            >
              {INVALID_INTERVAL_MESSAGE}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 12,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  customArea: {
    gap: 8,
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  units: {
    flexDirection: "row",
    gap: 8,
  },
  unit: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    fontSize: 13,
    fontWeight: "600",
  },
});
