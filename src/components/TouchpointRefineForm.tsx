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
  coerceAllowAi,
  combineDateAndTime,
  DURATION_PRESETS,
  FUTURE_DATETIME_MESSAGE,
  formatDurationLabel,
  isCombinedInFuture,
  parseCustomDurationMinutes,
  parseLocalDateTime,
} from "@/components/touchpoint-refine-logic";
import { useTheme } from "@/theme";

/** The controlled refine value — every editable column of a touchpoint. */
export interface TouchpointRefineValue {
  /** Local wall-clock `YYYY-MM-DD HH:MM:SS`. */
  occurredAt: string;
  /** Message|Call|In Person|other|unspecified (D-06; other/unspecified are legacy pass-through). */
  channel: string;
  /** outbound|inbound|mutual|null. */
  direction: string | null;
  /** 0/1 — connected drives the rarely_responds recency filter. */
  connected: number;
  /** Tone: Positive|Neutral|Negative|null (D-06); null = unset, never treated as Neutral. */
  quality: string | null;
  note: string | null;
  /** Optional interaction duration in whole seconds (HIST-14); null = none. */
  duration: number | null;
  /** Per-interaction Allow-AI gate, 0/1 (D-04); defaults 0 (OFF). */
  allowAi: number;
}

/**
 * Locked copy (mirrors TriStateLastSpoke's future-date rejection). Defined in the
 * pure `touchpoint-refine-logic` module and re-exported here so existing importers
 * of `@/components/TouchpointRefineForm` keep working while the node-tested edit
 * logic (Plan 04) can import the SAME single copy without loading react-native.
 */
export { FUTURE_DATETIME_MESSAGE };

/**
 * The channel control (D-06): Message/Call/In Person are the primary labels;
 * other/unspecified stay representable so a legacy row is never silently rewritten.
 */
const CHANNEL_OPTIONS = [
  { value: "Message", label: "Message" },
  { value: "Call", label: "Call" },
  { value: "In Person", label: "In Person" },
  { value: "other", label: "Other" },
  { value: "unspecified", label: "Unspecified" },
] as const;

/** The direction enum; null = unset ("No selection"). */
const DIRECTION_OPTIONS = ["outbound", "inbound", "mutual"] as const;

/** The Tone enum (D-06); null = unset ("No selection"), never treated as Neutral. */
const TONE_OPTIONS = ["Positive", "Neutral", "Negative"] as const;

interface TouchpointRefineFormProps {
  /** The controlled value — the parent seeds and owns it. */
  value: TouchpointRefineValue;
  /** Emits every change; the parent owns the state and the DAO call. */
  onChange: (value: TouchpointRefineValue) => void;
  /** Local wall-clock now — the future-datetime bound. */
  now: string;
  /** Stable testID root; controls derive from it. */
  testID?: string;
  /**
   * Optional allow-list for reuse in scoped edit surfaces. Omitting it preserves
   * the canonical full interaction-edit form.
   */
  visibleFields?: ReadonlyArray<TouchpointRefineField>;
  /** Optional caller-specific copy for the inline future-date validation. */
  futureDateMessage?: string;
}

export type TouchpointRefineField =
  | "datetime"
  | "channel"
  | "direction"
  | "connected"
  | "tone"
  | "note"
  | "duration"
  | "allowAi";

const ALL_FIELDS: ReadonlySet<TouchpointRefineField> = new Set([
  "datetime",
  "channel",
  "direction",
  "connected",
  "tone",
  "note",
  "duration",
  "allowAi",
]);

export function TouchpointRefineForm({
  value,
  onChange,
  now,
  testID = "touchpoint-refine",
  visibleFields,
  futureDateMessage = FUTURE_DATETIME_MESSAGE,
}: TouchpointRefineFormProps) {
  const { colors } = useTheme();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  // Carry the day picked in the DATE dialog into the TIME dialog (Android's two
  // dialogs are sequential — the combine happens only after the time is chosen).
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Raw text of the Custom-duration entry (minutes). The persisted seconds live on
  // `value.duration`; this only backs the free-text field while the user types.
  const [customMinutes, setCustomMinutes] = useState("");
  const fields = visibleFields ? new Set(visibleFields) : ALL_FIELDS;

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
      setError(futureDateMessage);
      return;
    }
    setError(null);
    set("occurredAt", combined);
  }

  return (
    <View testID={testID} style={styles.form}>
      {/* Date + time */}
      {fields.has("datetime") ? (
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
            <Text style={{ color: colors.textPrimary }}>
              {value.occurredAt}
            </Text>
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
      ) : null}

      {/* Channel */}
      {fields.has("channel") ? (
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
                <Picker.Item key={o.value} label={o.label} value={o.value} />
              ))}
            </Picker>
          </View>
        </View>
      ) : null}

      {/* Direction */}
      {fields.has("direction") ? (
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
              onValueChange={(v) =>
                set("direction", v === "" ? null : String(v))
              }
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
      ) : null}

      {/* Connected */}
      {fields.has("connected") ? (
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
      ) : null}

      {/* Tone */}
      {fields.has("tone") ? (
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Tone
          </Text>
          <View
            style={[
              styles.control,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Picker
              testID={`${testID}-tone`}
              accessibilityLabel="Tone"
              selectedValue={value.quality ?? ""}
              onValueChange={(v) => set("quality", v === "" ? null : String(v))}
              dropdownIconColor={colors.textSecondary}
              style={{ color: colors.textPrimary }}
            >
              <Picker.Item label="No selection" value="" />
              {TONE_OPTIONS.map((o) => (
                <Picker.Item key={o} label={o} value={o} />
              ))}
            </Picker>
          </View>
        </View>
      ) : null}

      {/* Note */}
      {fields.has("note") ? (
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
      ) : null}

      {/* Duration (optional; descriptive only — never feeds Status/Gravity/Intensity) */}
      {fields.has("duration") ? (
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Duration
          </Text>
          <View style={styles.chipRow}>
            {DURATION_PRESETS.map((preset) => {
              const selected = value.duration === preset.seconds;
              return (
                <Pressable
                  key={preset.label}
                  testID={`${testID}-duration-${preset.label}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Duration ${preset.label}`}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setCustomMinutes("");
                    set("duration", preset.seconds);
                  }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: colors.surface,
                      borderColor: selected ? colors.accent : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: colors.textPrimary }}>
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              testID={`${testID}-duration-none`}
              accessibilityRole="button"
              accessibilityLabel="Duration none"
              accessibilityState={{ selected: value.duration === null }}
              onPress={() => {
                setCustomMinutes("");
                set("duration", null);
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: colors.surface,
                  borderColor:
                    value.duration === null ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={{ color: colors.textPrimary }}>None</Text>
            </Pressable>
          </View>
          <TextInput
            testID={`${testID}-duration-custom`}
            accessibilityLabel="Custom duration in minutes"
            value={customMinutes}
            onChangeText={(t) => {
              setCustomMinutes(t);
              // parseCustomDurationMinutes returns null for empty/invalid/out-of-range
              // (the "none" outcome), so an in-progress or bad entry never persists a
              // 0 or an out-of-bound duration.
              set("duration", parseCustomDurationMinutes(t));
            }}
            keyboardType="number-pad"
            placeholder="Custom (minutes)"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.control,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
          />
          <Text
            testID={`${testID}-duration-label`}
            style={[styles.hint, { color: colors.textSecondary }]}
          >
            {formatDurationLabel(value.duration)}
          </Text>
        </View>
      ) : null}

      {/* Allow AI (per-interaction egress gate; defaults OFF — D-04) */}
      {fields.has("allowAi") ? (
        <View style={[styles.field, styles.toggleRow]}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>
            Allow AI
          </Text>
          <Switch
            testID={`${testID}-allow-ai`}
            accessibilityLabel="Allow AI"
            value={value.allowAi === 1}
            onValueChange={(v) => set("allowAi", coerceAllowAi(v))}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={colors.surfaceElevated}
          />
        </View>
      ) : null}

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
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  hint: {
    fontSize: 13,
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
