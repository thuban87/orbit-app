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
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "@/theme";
import { FREQUENCY_DAYS, type Frequency } from "@/types";
import {
  INVALID_INTERVAL_MESSAGE,
  type IntervalUnit,
  parseCustomInterval,
  shouldShowCustomError,
} from "./frequency-picker-logic";

interface FrequencyPickerProps {
  /** Current interval in days (the selected preset, or a custom every-N). */
  value: number;
  /** Emits a positive-integer interval_days — never fires on an invalid entry. */
  onChange: (intervalDays: number) => void;
  /** Reports custom-entry validity so the parent can block Save (Plan 04). */
  onValidityChange?: (valid: boolean) => void;
  /**
   * Reports the transient custom-entry state on mount and whenever Custom
   * opens/closes or its text or unit changes (38.9 D-14, review C4-M2): the
   * only way typed-but-invalid text (which never fires `onChange`) reaches an
   * unsaved-work guard. Optional; absent for hosts that do not guard it.
   */
  onDraftChange?: (draft: {
    customMode: boolean;
    raw: string;
    unit: IntervalUnit;
  }) => void;
  /** Accessibility label for the control group. */
  label?: string;
  /** Stable testID root; children derive from it. */
  testID?: string;
  /**
   * Read-only: every chip, unit and the custom input ignore input and announce
   * disabled (38.4 D-64, a locked bulk batch lifecycle). Off by default.
   */
  disabled?: boolean;
  /**
   * Opt-in error timing (38.11 D-36; Add and Edit Contact only): the Custom…
   * box shows its error only after the user types in it (or `errorForced`).
   * Off by default, so every other host keeps today's always-show timing
   * (T-07).
   */
  errorAfterTyping?: boolean;
  /**
   * A blocked Save asks the field to show its error now, typed or not (the
   * host's own reveal). The picker's message is the field's one error source
   * (D-36): the host renders no second message for frequency.
   */
  errorForced?: boolean;
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
  onDraftChange,
  label = "Contact frequency",
  testID = "frequency-picker",
  disabled = false,
  errorAfterTyping = false,
  errorForced = false,
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
  // Set on the first typing in the Custom… box; reset when the user leaves
  // custom mode (D-36). Only read when the host opts into `errorAfterTyping`.
  const [customTouched, setCustomTouched] = useState(false);

  const custom = parseCustomInterval(customRaw, unit);
  const valid = customMode ? custom.valid : true;
  // ONE show-error value drives the caption AND the danger border (review
  // U-03); without the opt-in it equals `!custom.valid`, as before (T-07).
  const showError = shouldShowCustomError({
    valid: custom.valid,
    touched: customTouched,
    forced: errorForced,
    afterTyping: errorAfterTyping,
  });

  // Surface validity to the parent (mount + on every change) so Save can block.
  useEffect(() => {
    onValidityChange?.(valid);
  }, [valid, onValidityChange]);

  // The custom-entry draft for a host's guard; the callback is read through a
  // ref so a fresh closure each render never re-fires the report.
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;
  useEffect(() => {
    onDraftChangeRef.current?.({ customMode, raw: customRaw, unit });
  }, [customMode, customRaw, unit]);

  function selectPreset(days: number) {
    setCustomMode(false);
    setCustomTouched(false);
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
    setCustomTouched(true);
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
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={name}
              disabled={disabled}
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
                  color: selected ? colors.accentText : colors.textPrimary,
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
          accessibilityState={{ selected: customMode, disabled }}
          accessibilityLabel="Custom interval"
          disabled={disabled}
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
            style={{
              color: customMode ? colors.accentText : colors.textPrimary,
            }}
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
              editable={!disabled}
              onChangeText={changeCustomText}
              keyboardType="number-pad"
              placeholder="every N"
              placeholderTextColor={colors.textPlaceholder}
              style={[
                styles.input,
                {
                  color: colors.textPrimary,
                  backgroundColor: colors.surface,
                  borderColor: showError ? colors.danger : colors.border,
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
                    accessibilityState={{ selected: active, disabled }}
                    accessibilityLabel={UNIT_LABELS[u]}
                    disabled={disabled}
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
                        color: active ? colors.accentText : colors.textPrimary,
                      }}
                    >
                      {UNIT_LABELS[u]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {showError ? (
            <Text
              testID={`${testID}-error`}
              accessibilityLabel={INVALID_INTERVAL_MESSAGE}
              style={[styles.error, { color: colors.danger }]}
            >
              {INVALID_INTERVAL_MESSAGE}
            </Text>
          ) : null}
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
