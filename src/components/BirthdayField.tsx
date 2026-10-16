/**
 * BirthdayField — the shared Birthday control for Add Contact and Edit Contact
 * (38.11 D-48, D-49, D-61). Plan 38.11-08's Profile Birthday sheet reuses its
 * logic (`birthday-field-logic.ts`) and this component where it fits.
 *
 * A trigger showing the birthday ("Jun 2, 1990", or "Jun 2" when the year is
 * unknown — `formatStoredBirthdayForDisplay`, the 38.9 date standard) or "Set
 * birthday"; a Year unknown switch; and Clear when a birthday is set (D-49:
 * Clear is an Edit control, so Add Contact passes `showClear={false}`;
 * 38.11-14 A7).
 * The native picker is capped at today on Add, Edit and the Profile Birthday
 * sheet (38.11 D-86) and opens where `dateRowSeed` says (W-02), so every
 * month/day stays reachable under the cap.
 *
 * Year unknown OFF never keeps the 2000 placeholder (D-61): it opens the
 * picker on the year-ask seed; a pick stores that full date, a cancel leaves
 * Year unknown on. The state machine is the node-tested
 * `birthday-field-logic.ts`; this file only renders it.
 *
 * Owns no DAO: every change goes to `onChange(next)` and the host decides
 * what to save (storage via `buildBirthdayForStorage`). Every colour resolves
 * through theme tokens; every target is at least 44dp.
 */
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  type BirthdayFieldState,
  type BirthdayPickerPurpose,
  birthdayDisplayValue,
  birthdayPickerMaxDate,
  clearBirthday,
  dateFromLocalDateString,
  dateRowSeed,
  pickerResult,
  yearUnknownChanged,
} from "@/components/birthday-field-logic";
import { AppText, Button, OrbitSwitch } from "@/components/ui";
import { useTheme } from "@/theme";
import { formatLocalDate, formatStoredBirthdayForDisplay } from "@/utils/dates";

export interface BirthdayFieldProps {
  value: BirthdayFieldState;
  onChange: (next: BirthdayFieldState) => void;
  /**
   * Base test id: the trigger uses it as-is; the switch, picker and Clear add
   * `-year-unknown`, `-picker` and `-clear`.
   */
  testID: string;
  /** Hide the "Birthday" label when the host already titles the field. */
  showLabel?: boolean;
  /**
   * Offer Clear once a birthday is set (default true). Add Contact turns it
   * off; Edit Contact (D-49) and the Profile Birthday sheet (D-59) keep it.
   */
  showClear?: boolean;
}

/** The open picker: why it opened and the local `YYYY-MM-DD` it opens on. */
interface OpenPicker {
  purpose: BirthdayPickerPurpose;
  seed: string;
}

export function BirthdayField({
  value,
  onChange,
  testID,
  showLabel = true,
  showClear = true,
}: BirthdayFieldProps) {
  const { colors } = useTheme();
  const [picker, setPicker] = useState<OpenPicker | null>(null);
  const todayLocal = formatLocalDate(new Date());

  const display = birthdayDisplayValue(value);
  const label =
    display !== null ? formatStoredBirthdayForDisplay(display) : "Set birthday";

  function openDatePicker() {
    setPicker({ purpose: "date", seed: dateRowSeed(value, todayLocal) });
  }

  function onYearUnknownChange(next: boolean) {
    const step = yearUnknownChanged(value, next, todayLocal);
    if (step.kind === "ask-year") {
      // D-61: ask for the year; nothing changes until the user picks.
      setPicker({ purpose: "year", seed: step.seed });
      return;
    }
    onChange(step.state);
  }

  function onPickerChange(event: DateTimePickerEvent, date?: Date) {
    const open = picker;
    setPicker(null);
    if (!open) return;
    const next = pickerResult(
      value,
      open.purpose,
      event.type === "set" && date
        ? { type: "set", date: formatLocalDate(date) }
        : { type: "dismissed" },
    );
    if (next !== value) onChange(next);
  }

  return (
    <View style={styles.field}>
      {showLabel ? (
        <AppText role="label" style={{ color: colors.textSecondary }}>
          Birthday
        </AppText>
      ) : null}
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel="Birthday"
        onPress={openDatePicker}
        style={[
          styles.trigger,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <AppText
          role="body"
          style={{
            color: display !== null ? colors.textPrimary : colors.textSecondary,
          }}
        >
          {label}
        </AppText>
      </Pressable>
      <View style={styles.toggleRow}>
        <AppText role="label" style={{ color: colors.textPrimary }}>
          Year unknown
        </AppText>
        <OrbitSwitch
          testID={`${testID}-year-unknown`}
          accessibilityLabel="Year unknown"
          value={value.yearUnknown}
          onValueChange={onYearUnknownChange}
        />
      </View>
      {showClear && value.input !== null ? (
        <View style={styles.clearRow}>
          <Button
            testID={`${testID}-clear`}
            role="tertiary"
            label="Clear"
            accessibilityLabel="Clear birthday"
            onPress={() => onChange(clearBirthday())}
          />
        </View>
      ) : null}
      {picker ? (
        <DateTimePicker
          testID={`${testID}-picker`}
          value={dateFromLocalDateString(picker.seed)}
          mode="date"
          maximumDate={birthdayPickerMaxDate(todayLocal)}
          onChange={onPickerChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  trigger: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toggleRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  clearRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
});
