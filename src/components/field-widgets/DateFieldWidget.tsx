// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's AppText `role` is a typography role, not ARIA.
/**
 * Date value widget (FLD-04; 38.9 D-66, D-67). A tap-to-pick row that opens
 * the native date picker (`@react-native-community/datetimepicker`), as the
 * birthday and last-spoke controls do. A pick emits the local YYYY-MM-DD from
 * `formatLocalDate()` (D-23); Clear emits `""`, the same value erasing the old
 * text field emitted. Full date only, no date range limit (D-67).
 *
 * Custom-field invariants (CLAUDE.md, ADR-001): only the widget changes. It
 * never calls `onChange` on mount, render or dismiss, so a stored value
 * (valid, trailing-text or invalid) is never rewritten until the user picks
 * or clears, and `custom_field_values.value` stays raw TEXT.
 *
 * Display: a value the date parser (`parsers.date`) accepts and that is a real
 * calendar day shows in the D-48 form ("Oct 20"). Anything else shows raw with
 * "Not a date" in the danger colour (D-67). Showing that caption for an
 * impossible day the regex parser accepts ("2026-02-31") is 38.9-13's choice
 * (review C6-L3); the parser and the Profile flag are unchanged.
 * Colours via `useTheme()`.
 */
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  isPickableStoredDate,
  pickerSeedFromStored,
  storedFromPickerEvent,
} from "@/components/date-pick-logic";
import { AppText } from "@/components/ui/AppText";
import { parsers } from "@/db/field-parsers";
import { useTheme } from "@/theme";
import { formatDisplayDate } from "@/utils/dates";
import type { FieldWidgetProps } from "./types";

/** What the row shows for a stored value. Display only. */
function dateDisplay(value: string | null): {
  text: string;
  empty: boolean;
  invalid: boolean;
} {
  if (value == null || value.trim() === "") {
    return { text: "Pick a date", empty: true, invalid: false };
  }
  const parsed = parsers.date(value);
  if (parsed.ok && parsed.value != null && isPickableStoredDate(value)) {
    return {
      text: formatDisplayDate(parsed.value),
      empty: false,
      invalid: false,
    };
  }
  return { text: value, empty: false, invalid: true };
}

export function DateFieldWidget({
  value,
  onChange,
  label,
  testID,
}: FieldWidgetProps) {
  const { colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const shown = dateDisplay(value);
  const hasValue = value != null && value !== "";

  const onPicked = (event: DateTimePickerEvent, date?: Date) => {
    setShowPicker(false);
    const stored = storedFromPickerEvent(event.type, date);
    if (stored !== null) onChange(stored);
  };

  return (
    <View style={styles.field}>
      <View style={styles.row}>
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={{ text: shown.text }}
          accessibilityHint="Opens the date picker"
          onPress={() => setShowPicker(true)}
          style={[
            styles.trigger,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <AppText
            role="body"
            style={{
              color: shown.empty ? colors.textPlaceholder : colors.textPrimary,
            }}
          >
            {shown.text}
          </AppText>
        </Pressable>
        {hasValue ? (
          <Pressable
            testID={testID ? `${testID}-clear` : undefined}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
            onPress={() => onChange("")}
            style={[styles.clear, { borderColor: colors.border }]}
          >
            <AppText role="body" style={{ color: colors.textSecondary }}>
              Clear
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {shown.invalid ? (
        <AppText role="caption" style={{ color: colors.danger }}>
          Not a date
        </AppText>
      ) : null}
      {showPicker ? (
        <DateTimePicker
          testID={testID ? `${testID}-picker` : undefined}
          value={pickerSeedFromStored(value)}
          mode="date"
          onChange={onPicked}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 4 },
  row: { alignItems: "center", flexDirection: "row", gap: 8 },
  trigger: {
    borderWidth: 1,
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clear: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
  },
});
