/**
 * TriStateLastSpoke (CRUD-02) — the fixed-column last-spoke control (RESEARCH
 * Pattern 1; no in-repo analog). Three segments: Today / Pick date / Not yet.
 *
 * PURELY CONTROLLED: the selected segment derives from the `value` prop; this
 * component holds NO internal default that overrides it. Each consumer seeds
 * its own initial state — CreateContactScreen (Plan 04) passes { kind: "today" },
 * the edit form's never-contacted path (Plan 06) passes { kind: "not-yet" }.
 *
 * "Not yet" stays visually muted (textSecondary text + borderStrong border),
 * NEVER accent-filled, so the backlog case reads honestly — muting is
 * deliberately not `danger` (Not-yet is a valid, non-error choice). "Pick date"
 * opens the native datetimepicker; a future date is rejected at entry with the
 * locked copy in `colors.danger` and the prior selection is kept. Dates format
 * through formatLocalDate (never toISOString) — validation lives in the tested
 * pure module tri-state-last-spoke-logic.ts. Every colour via useTheme().
 */
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme";
import { parseDate } from "@/types";
import {
  type LastSpokeValue,
  resolvePickedDate,
} from "./tri-state-last-spoke-logic";

interface TriStateLastSpokeProps {
  /** The controlled selection — the segment shown derives from this. */
  value: LastSpokeValue;
  /** Emits every change; the parent owns the state. */
  onChange: (value: LastSpokeValue) => void;
  /** Accessibility label for the control group. */
  label?: string;
  /** Stable testID root; segments derive from it. */
  testID?: string;
}

export function TriStateLastSpoke({
  value,
  onChange,
  label = "Last spoke",
  testID = "last-spoke",
}: TriStateLastSpokeProps) {
  const { colors } = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedKind = value.kind;
  // Seed the native picker with the current date (if one is chosen) or today —
  // NOT a persisted default; it only initialises the picker's cursor.
  const pickerSeed =
    value.kind === "date" ? (parseDate(value.date) ?? new Date()) : new Date();

  function pickToday() {
    setError(null);
    onChange({ kind: "today" });
  }

  function pickNotYet() {
    setError(null);
    onChange({ kind: "not-yet" });
  }

  function openPicker() {
    setError(null);
    setShowPicker(true);
  }

  function onPickerChange(event: DateTimePickerEvent, date?: Date) {
    setShowPicker(false);
    // Android cancel / dismiss — keep the prior selection, no emit.
    if (event.type !== "set" || !date) {
      return;
    }
    const result = resolvePickedDate(date);
    if (result.rejected) {
      // Future date — surface the locked copy, keep the prior selection.
      setError(result.message);
      return;
    }
    if (result.value) {
      onChange(result.value);
    }
  }

  // Segment style: selected Today/Pick-date get accent fill; "Not yet" is muted
  // even when selected; unselected segments sit on surface with a plain border.
  function segmentColors(kind: LastSpokeValue["kind"], selected: boolean) {
    if (kind === "not-yet") {
      return {
        background: colors.surface,
        border: colors.borderStrong,
        text: colors.textSecondary,
      };
    }
    if (selected) {
      return {
        background: colors.accent,
        border: colors.accent,
        text: colors.background,
      };
    }
    return {
      background: colors.surface,
      border: colors.border,
      text: colors.textPrimary,
    };
  }

  const todayC = segmentColors("today", selectedKind === "today");
  const dateC = segmentColors("date", selectedKind === "date");
  const notYetC = segmentColors("not-yet", selectedKind === "not-yet");
  const dateLabel = value.kind === "date" ? value.date : "Pick date";

  return (
    <View testID={testID} accessibilityLabel={label} style={styles.group}>
      <View style={styles.segments}>
        <Pressable
          testID={`${testID}-today`}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedKind === "today" }}
          accessibilityLabel="Today"
          hitSlop={8}
          onPress={pickToday}
          style={[
            styles.segment,
            { backgroundColor: todayC.background, borderColor: todayC.border },
          ]}
        >
          <Text style={{ color: todayC.text }}>Today</Text>
        </Pressable>

        <Pressable
          testID={`${testID}-pick-date`}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedKind === "date" }}
          accessibilityLabel="Pick date"
          hitSlop={8}
          onPress={openPicker}
          style={[
            styles.segment,
            { backgroundColor: dateC.background, borderColor: dateC.border },
          ]}
        >
          <Text style={{ color: dateC.text }}>{dateLabel}</Text>
        </Pressable>

        <Pressable
          testID={`${testID}-not-yet`}
          accessibilityRole="button"
          accessibilityState={{ selected: selectedKind === "not-yet" }}
          accessibilityLabel="Not yet"
          hitSlop={8}
          onPress={pickNotYet}
          style={[
            styles.segment,
            { backgroundColor: notYetC.background, borderColor: notYetC.border },
          ]}
        >
          <Text style={{ color: notYetC.text }}>Not yet</Text>
        </Pressable>
      </View>

      {error ? (
        <Text
          testID={`${testID}-error`}
          accessibilityLabel={error}
          style={[styles.error, { color: colors.danger }]}
        >
          {error}
        </Text>
      ) : null}

      {showPicker ? (
        <DateTimePicker
          testID={`${testID}-picker`}
          value={pickerSeed}
          mode="date"
          onChange={onPickerChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 8,
  },
  segments: {
    flexDirection: "row",
    gap: 8,
  },
  segment: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    fontSize: 13,
    fontWeight: "600",
  },
});
