// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's AppText `role` is a typography role, not ARIA.
/**
 * EntryDateField — the date of a new Last Talked About or Current Location
 * entry (38.10 D-65, D-101; checker B4).
 *
 * A tap-to-pick row that opens the native date picker capped at `maxDate`:
 * these two pickers cannot go past today, because Most Recent is the newest
 * date (D-45, D-101). It lives in its own file on purpose: the memory date
 * pickers stay unlimited (38.9 D-67 still holds for them), and
 * display-date-contract.test.ts keeps banning `minimumDate|maximumDate` in
 * MemoryEditor.tsx and DateFieldWidget.tsx.
 *
 * Storage: a pick is stored through `storedFromPickerEvent` (local
 * YYYY-MM-DD from `formatLocalDate()`, never `toISOString`; CLAUDE.md). The
 * row's text comes from the shared display formatter and is display only.
 * Colours via `useTheme()`.
 */
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import {
  pickerSeedFromStored,
  storedFromPickerEvent,
} from "@/components/date-pick-logic";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { formatDisplayDateOrFallback } from "@/utils/dates";
import { AppText } from "./AppText";

export interface EntryDateFieldProps {
  /** The stored local `YYYY-MM-DD`. */
  value: string;
  /** Receives the picked local `YYYY-MM-DD`; never called on dismiss. */
  onChange: (stored: string) => void;
  /** The latest pickable date (today for these two pickers, D-101). */
  maxDate: Date;
  accessibilityLabel: string;
  testID?: string;
}

export function EntryDateField({
  value,
  onChange,
  maxDate,
  accessibilityLabel,
  testID,
}: EntryDateFieldProps) {
  const { colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const shown = formatDisplayDateOrFallback(value, value);

  const onPicked = (event: DateTimePickerEvent, date?: Date) => {
    setShowPicker(false);
    const stored = storedFromPickerEvent(event.type, date);
    if (stored !== null) onChange(stored);
  };

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: shown }}
        accessibilityHint="Opens the date picker"
        onPress={() => setShowPicker(true)}
        style={[
          styles.trigger,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <AppText role="body">{shown}</AppText>
      </Pressable>
      {showPicker ? (
        <DateTimePicker
          testID={testID ? `${testID}-picker` : undefined}
          value={pickerSeedFromStored(value)}
          mode="date"
          maximumDate={maxDate}
          onChange={onPicked}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    borderRadius: SPACING.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
});
