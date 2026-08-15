/**
 * TouchpointRefineForm (LOG-01) — the "log fast, fix tonight" refine control.
 *
 * PURELY CONTROLLED: the parent owns the `value` and calls `editTouchpointFull`
 * on save; this form imports NO DAO (presentational + the tested pure logic
 * module only). It edits every editable column of a touchpoint — channel,
 * direction, connected, quality, note — plus the correctable date+time.
 *
 * ANDROID TWO-DIALOG DATE+TIME (dossier F7): Android has no combined picker, so
 * "Correct date & time" opens the native DATE dialog then chains into the TIME
 * dialog; the Y-M-D and H:M:S are stitched by the node-tested
 * `touchpoint-refine-logic.ts` into a LOCAL `YYYY-MM-DD HH:MM:SS` (never
 * toISOString). A combined datetime later than `now` is rejected inline in
 * `colors.danger` and the PRIOR selection is kept (mirrors TriStateLastSpoke /
 * LOG-06). Seeding the dialogs uses `parseLocalDateTime` (time-of-day preserved),
 * never `types.ts parseDate`.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  combineDateAndTime,
  isCombinedInFuture,
  parseLocalDateTime,
} from "@/components/touchpoint-refine-logic";
import { useTheme } from "@/theme";

/** The controlled refine value — every editable column of a touchpoint. */
export interface TouchpointRefineValue {
  /** Local wall-clock `YYYY-MM-DD HH:MM:SS`. */
  occurredAt: string;
  /** call|text|in-person|email|other|unspecified. */
  channel: string;
  /** outbound|inbound|mutual|null. */
  direction: string | null;
  /** 0/1 — connected drives the rarely_responds recency filter. */
  connected: number;
  /** good|fine|hard|null. */
  quality: string | null;
  note: string | null;
}

/** Locked copy (mirrors TriStateLastSpoke's future-date rejection). */
export const FUTURE_DATETIME_MESSAGE =
  "That time is in the future. Pick now or earlier.";

/** The closed channel enum (dossier). */
const CHANNEL_OPTIONS = [
  "call",
  "text",
  "in-person",
  "email",
  "other",
  "unspecified",
] as const;

/** The direction enum; null = unset ("No selection"). */
const DIRECTION_OPTIONS = ["outbound", "inbound", "mutual"] as const;

/** The quality enum; null = unset ("No selection"). */
const QUALITY_OPTIONS = ["good", "fine", "hard"] as const;

interface TouchpointRefineFormProps {
  /** The controlled value — the parent seeds and owns it. */
  value: TouchpointRefineValue;
  /** Emits every change; the parent owns the state and the DAO call. */
  onChange: (value: TouchpointRefineValue) => void;
  /** Local wall-clock now — the future-datetime bound. */
  now: string;
  /** Stable testID root; controls derive from it. */
  testID?: string;
}

export function TouchpointRefineForm({
  value,
  onChange,
  now,
  testID = "touchpoint-refine",
}: TouchpointRefineFormProps) {
  const { colors } = useTheme();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  // Carry the day picked in the DATE dialog into the TIME dialog (Android's two
  // dialogs are sequential — the combine happens only after the time is chosen).
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Seed both dialogs from the stored occurred_at, preserving time-of-day.
  const seed = parseLocalDateTime(value.occurredAt);

  function set<K extends keyof TouchpointRefineValue>(
    key: K,
    v: TouchpointRefineValue[K],
  ) {
    onChange({ ...value, [key]: v });
  }

  function openDateTime() {
    setError(null);
    setPendingDate(null);
    setShowDatePicker(true);
  }

  function onDateChange(event: DateTimePickerEvent, date?: Date) {
    setShowDatePicker(false);
    // Android cancel / dismiss — keep the prior selection, no chain.
    if (event.type !== "set" || !date) {
      return;
    }
    setPendingDate(date);
    setShowTimePicker(true);
  }

  function onTimeChange(event: DateTimePickerEvent, time?: Date) {
    setShowTimePicker(false);
    const day = pendingDate;
    setPendingDate(null);
    // Android cancel / dismiss — keep the prior selection, no emit.
    if (event.type !== "set" || !time || !day) {
      return;
    }
    const combined = combineDateAndTime(day, time);
    if (isCombinedInFuture(combined, now)) {
      // Future datetime — surface the locked copy, keep the prior selection.
      setError(FUTURE_DATETIME_MESSAGE);
      return;
    }
    setError(null);
    set("occurredAt", combined);
  }

  return (
    <View testID={testID} style={styles.form}>
      {/* Date + time */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Date & time
        </Text>
        <Pressable
          testID={`${testID}-datetime`}
          accessibilityRole="button"
          accessibilityLabel="Correct date and time"
          onPress={openDateTime}
          style={[
            styles.control,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={{ color: colors.textPrimary }}>{value.occurredAt}</Text>
        </Pressable>
        {error ? (
          <Text
            testID={`${testID}-error`}
            accessibilityLabel={error}
            style={[styles.error, { color: colors.danger }]}
          >
            {error}
          </Text>
        ) : null}
      </View>

      {/* Channel */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Channel
        </Text>
        <View
          style={[
            styles.control,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Picker
            testID={`${testID}-channel`}
            accessibilityLabel="Channel"
            selectedValue={value.channel}
            onValueChange={(v) => set("channel", String(v))}
            dropdownIconColor={colors.textSecondary}
            style={{ color: colors.textPrimary }}
          >
            {CHANNEL_OPTIONS.map((o) => (
              <Picker.Item key={o} label={o} value={o} />
            ))}
          </Picker>
        </View>
      </View>

      {/* Direction */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Direction
        </Text>
        <View
          style={[
            styles.control,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Picker
            testID={`${testID}-direction`}
            accessibilityLabel="Direction"
            selectedValue={value.direction ?? ""}
            onValueChange={(v) => set("direction", v === "" ? null : String(v))}
            dropdownIconColor={colors.textSecondary}
            style={{ color: colors.textPrimary }}
          >
            <Picker.Item label="No selection" value="" />
            {DIRECTION_OPTIONS.map((o) => (
              <Picker.Item key={o} label={o} value={o} />
            ))}
          </Picker>
        </View>
      </View>

      {/* Connected */}
      <View style={[styles.field, styles.toggleRow]}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          Connected
        </Text>
        <Switch
          testID={`${testID}-connected`}
          accessibilityLabel="Connected"
          value={value.connected === 1}
          onValueChange={(v) => set("connected", v ? 1 : 0)}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor={colors.surfaceElevated}
        />
      </View>

      {/* Quality */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Quality
        </Text>
        <View
          style={[
            styles.control,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Picker
            testID={`${testID}-quality`}
            accessibilityLabel="Quality"
            selectedValue={value.quality ?? ""}
            onValueChange={(v) => set("quality", v === "" ? null : String(v))}
            dropdownIconColor={colors.textSecondary}
            style={{ color: colors.textPrimary }}
          >
            <Picker.Item label="No selection" value="" />
            {QUALITY_OPTIONS.map((o) => (
              <Picker.Item key={o} label={o} value={o} />
            ))}
          </Picker>
        </View>
      </View>

      {/* Note */}
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Note
        </Text>
        <TextInput
          testID={`${testID}-note`}
          accessibilityLabel="Note"
          value={value.note ?? ""}
          onChangeText={(t) => set("note", t === "" ? null : t)}
          multiline
          placeholder="Add a detail"
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.control,
            styles.noteInput,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
        />
      </View>

      {showDatePicker ? (
        <DateTimePicker
          testID={`${testID}-date-picker`}
          value={seed}
          mode="date"
          onChange={onDateChange}
        />
      ) : null}
      {showTimePicker ? (
        <DateTimePicker
          testID={`${testID}-time-picker`}
          value={pendingDate ?? seed}
          mode="time"
          onChange={onTimeChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  control: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  noteInput: {
    minHeight: 88,
    paddingVertical: 10,
    textAlignVertical: "top",
    fontSize: 15,
  },
  error: {
    fontSize: 13,
    fontWeight: "600",
  },
});
