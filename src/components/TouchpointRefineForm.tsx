/**
 * TouchpointRefineForm (LOG-01) — the "log fast, fix tonight" refine control.
 *
 * PURELY CONTROLLED: the parent owns the `value` and calls `editTouchpointFull`
 * on save; this form imports NO DAO (presentational + the tested pure logic
 * module only). It edits every editable column of a touchpoint — channel,
 * direction, connected, quality, note — plus the correctable date+time.
 *
 * ANDROID TWO-DIALOG DATE+TIME (dossier F7): Android has no combined picker, so
 * "Date & time" opens the native DATE dialog then chains into the TIME
 * dialog; the Y-M-D and H:M:S are stitched by the node-tested
 * `touchpoint-refine-logic.ts` into a LOCAL `YYYY-MM-DD HH:MM:SS` (never
 * toISOString). A combined datetime later than `now` is rejected inline in
 * `colors.danger` and the PRIOR selection is kept (mirrors TriStateLastSpoke /
 * LOG-06). Seeding the dialogs uses `parseLocalDateTime` (time-of-day preserved),
 * never `types.ts parseDate`.
 * The date dialog's `maximumDate` is `now`, so no later day can be picked
 * (38.14 D-24); the inline rejection still covers a later time today.
 *
 * VISIBLE TIMESTAMP (38.4 RG-038, ui-accessibility/AUD-UIA-018, D-07): the
 * date/time control DISPLAYS `formatDateTimeMinuteOrFallback(occurredAt)`
 * (12-hour AM/PM, no seconds) and exposes that same string as its
 * accessibility value (RG-030, AUD-UIA-005); the stored value and the native
 * picker seed keep full `HH:MM:SS` precision. Duration preset/None chips sit at
 * the MIN_TOUCH_TARGET floor with no hitSlop, so the 8dp row gap keeps
 * neighbouring hit regions apart (RG-030, AUD-UIA-006).
 *
 * CHOICES (38.9 D-28): Channel, Direction and Tone open the one themed
 * `OptionSheet` from an `OptionSelectRow` trigger (no native spinner). "No
 * selection" is the null option for Direction and Tone; Channel has none (38.14
 * D-60, Q26 rejected). Channel offers Message / Call / In Person by default;
 * an edit host adds a record's own legacy value through `channelOptionsFor`.
 * A stored value outside the option set is shown raw on the trigger and is
 * never rewritten unless the user picks another option.
 *
 * 38.10 additive props (plan 12; every other consumer unchanged):
 * - `noteError` renders a `FieldError` directly under the note field (Research
 *   Q4: a linked note cleared to blank; 38.9 D-19, docs/systems/ux-standards.md).
 * - `allowAiLockedReason` renders the Allow AI switch off and disabled with
 *   the reason in the caption slot (D-103); the user cannot turn it on.
 *
 * Every colour resolves through `useTheme().colors.*` (CLAUDE.md / check:colors).
 */
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Fragment, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  coerceAllowAi,
  combineDateAndTime,
  customDurationError,
  customMinutesDisplay,
  customMinutesSeed,
  DURATION_PRESETS,
  durationChipTone,
  FUTURE_DATETIME_MESSAGE,
  formatDurationLabel,
  isCombinedInFuture,
  parseCustomDurationMinutes,
  parseLocalDateTime,
  showDurationReadout,
} from "@/components/touchpoint-refine-logic";
import { OptionSelectRow, OptionSheet, OrbitSwitch } from "@/components/ui";
import { MIN_TOUCH_TARGET } from "@/components/ui/button-roles";
import { FieldError } from "@/components/ui/FieldError";
import { useKeyboardCenteringContext } from "@/components/ui/KeyboardCenteringProvider";
import { DIRECTION_LABEL } from "@/constants/glossary";
import { ORDINARY_LOG_CHANNEL_OPTIONS } from "@/screens/log-interaction-logic";
import { useTheme } from "@/theme";
import { formatDateTimeMinuteOrFallback } from "@/utils/dates";

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

/** The direction enum; null = unset ("No selection"). */
const DIRECTION_OPTIONS = ["outbound", "inbound", "mutual"] as const;

/** The Tone enum (D-06); null = unset ("No selection"), never treated as Neutral. */
const TONE_OPTIONS = ["Positive", "Neutral", "Negative"] as const;

/**
 * Direction and Tone sheet options: "No selection" is the null value.
 * Direction labels come from the glossary (Outbound / Inbound / Mutual;
 * 38.14 D-33, D-64); the stored value stays lower case.
 */
const DIRECTION_SHEET_OPTIONS: ReadonlyArray<{
  value: string | null;
  label: string;
}> = [
  { value: null, label: "No selection" },
  ...DIRECTION_OPTIONS.map((o) => ({ value: o, label: DIRECTION_LABEL[o] })),
];
const TONE_SHEET_OPTIONS: ReadonlyArray<{
  value: string | null;
  label: string;
}> = [
  { value: null, label: "No selection" },
  ...TONE_OPTIONS.map((o) => ({ value: o, label: o })),
];

/** The sheet that is open, if any (one at a time). */
type ChoiceSheet = "channel" | "direction" | "tone";

/** The trigger label for a stored value: its option label, else the raw value. */
function choiceLabel(
  options: ReadonlyArray<{ value: string | null; label: string }>,
  current: string | null,
): string {
  return (
    options.find((o) => o.value === current)?.label ?? current ?? "No selection"
  );
}

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
  /**
   * Optional Channel option set. DEFAULTS to the three canonical channels
   * (Message / Call / In Person, `ORDINARY_LOG_CHANNEL_OPTIONS`; 38.14 D-60).
   * Edit surfaces pass `channelOptionsFor(saved channel)`, which adds a
   * record's own legacy value (Other / Unspecified) only when it holds one. A
   * stored value outside the set is shown raw and never rewritten unless the
   * user picks another option.
   */
  channelOptions?: ReadonlyArray<{ value: string; label: string }>;
  /**
   * Optional progressive-disclosure allow-list. DEFAULTS to empty → every visible
   * field renders inline exactly as before (no Phase-32 regression). Any VISIBLE
   * field listed here renders inside a single collapsed "More Options" disclosure
   * instead of inline — the mechanism that delivers CAPT-07's "Duration under More
   * Options" when LogInteractionScreen passes `moreOptionsFields={["duration"]}`.
   */
  moreOptionsFields?: ReadonlyArray<TouchpointRefineField>;
  /**
   * Optional helper caption rendered beneath the Allow AI toggle. DEFAULTS to
   * undefined → no caption, so Edit Interaction / Group Log surfaces are visually
   * unchanged. LogInteractionScreen passes the D-04 consent copy ("Let AI use this
   * note's text. Off by default.").
   */
  allowAiCaption?: string;
  /**
   * 38.10 D-103: when set, the Allow AI switch renders off and disabled and
   * this reason replaces the caption. Absent → unchanged.
   */
  allowAiLockedReason?: string;
  /**
   * 38.10 Research Q4: an inline error rendered under the note field. Absent or
   * null renders nothing.
   */
  noteError?: string | null;
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

/**
 * The canonical top-to-bottom field order. Both the inline render and the "More
 * Options" disclosure iterate this so a deferred field keeps its natural position
 * relative to the others (a field is never reordered by being deferred).
 */
const FIELD_ORDER: readonly TouchpointRefineField[] = [
  "datetime",
  "channel",
  "direction",
  "connected",
  "tone",
  "note",
  "duration",
  "allowAi",
];

const ALL_FIELDS: ReadonlySet<TouchpointRefineField> = new Set(FIELD_ORDER);

export function TouchpointRefineForm({
  value,
  onChange,
  now,
  testID = "touchpoint-refine",
  visibleFields,
  futureDateMessage = FUTURE_DATETIME_MESSAGE,
  channelOptions,
  moreOptionsFields,
  allowAiCaption,
  allowAiLockedReason,
  noteError,
}: TouchpointRefineFormProps) {
  const { colors } = useTheme();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  // Carry the day picked in the DATE dialog into the TIME dialog (Android's two
  // dialogs are sequential — the combine happens only after the time is chosen).
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Whether the "More Options" disclosure is expanded. Defaults collapsed, so a
  // deferred field (e.g. Duration) is ABSENT until the user expands it (CAPT-07).
  const [showMore, setShowMore] = useState(false);
  // Raw text of the Custom-duration entry (minutes). The persisted seconds live on
  // `value.duration`; this only backs the free-text field while the user types.
  // A saved custom duration reopens as its minutes (38.14 D-31).
  const [customMinutes, setCustomMinutes] = useState(() =>
    customMinutesSeed(value.duration),
  );
  const [openSheet, setOpenSheet] = useState<ChoiceSheet | null>(null);
  // 38.14 D-34: the note and the custom minutes tell the nearest host's
  // keyboard centring on focus and blur (null outside a host: no centring).
  // Raw TextInputs, so the multi-line note keeps its line breaks.
  const centering = useKeyboardCenteringContext();
  const noteInputRef = useRef<TextInput>(null);
  const customMinutesRef = useRef<TextInput>(null);
  const fields = visibleFields ? new Set(visibleFields) : ALL_FIELDS;
  // Channel options default to the three canonical channels (38.14 D-60).
  const channels = channelOptions ?? ORDINARY_LOG_CHANNEL_OPTIONS;
  // Fields deferred to the "More Options" disclosure; empty = everything inline.
  const moreSet = moreOptionsFields ? new Set(moreOptionsFields) : null;
  const showInline = (field: TouchpointRefineField): boolean =>
    fields.has(field) && !(moreSet?.has(field) ?? false);
  const deferredFields = moreSet
    ? FIELD_ORDER.filter((field) => fields.has(field) && moreSet.has(field))
    : [];

  // Seed both dialogs from the stored occurred_at, preserving time-of-day.
  const seed = parseLocalDateTime(value.occurredAt);
  // Display-only minute presentation; never written back (D-07).
  const occurredAtLabel = formatDateTimeMinuteOrFallback(value.occurredAt);
  // The More / Hide options toggle reads the same words aloud as it shows
  // (38.14 D-39).
  const moreOptionsLabel = showMore ? "Hide options" : "More Options";

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

  // Render one field's markup by name. Both the inline pass and the "More
  // Options" disclosure call this, so a deferred field is byte-identical to its
  // inline form — deferral changes only WHERE it renders, never WHAT.
  function renderField(field: TouchpointRefineField) {
    switch (field) {
      case "datetime":
        return (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Date & time
            </Text>
            <Pressable
              testID={`${testID}-datetime`}
              accessibilityRole="button"
              accessibilityLabel="Date & time"
              accessibilityValue={{ text: occurredAtLabel }}
              onPress={openDateTime}
              style={[
                styles.control,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={{ color: colors.textPrimary }}>
                {occurredAtLabel}
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
        );
      case "channel":
        return (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Channel
            </Text>
            <OptionSelectRow
              testID={`${testID}-channel`}
              label="Channel"
              currentLabel={choiceLabel(channels, value.channel)}
              onPress={() => setOpenSheet("channel")}
            />
          </View>
        );
      case "direction":
        return (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Direction
            </Text>
            <OptionSelectRow
              testID={`${testID}-direction`}
              label="Direction"
              currentLabel={choiceLabel(
                DIRECTION_SHEET_OPTIONS,
                value.direction,
              )}
              onPress={() => setOpenSheet("direction")}
            />
          </View>
        );
      case "connected":
        return (
          <View style={[styles.field, styles.toggleRow]}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              Connected
            </Text>
            <OrbitSwitch
              testID={`${testID}-connected`}
              accessibilityLabel="Connected"
              value={value.connected === 1}
              onValueChange={(v) => set("connected", v ? 1 : 0)}
            />
          </View>
        );
      case "tone":
        return (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Tone
            </Text>
            <OptionSelectRow
              testID={`${testID}-tone`}
              label="Tone"
              currentLabel={choiceLabel(TONE_SHEET_OPTIONS, value.quality)}
              onPress={() => setOpenSheet("tone")}
            />
          </View>
        );
      case "note":
        return (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Note
            </Text>
            <TextInput
              ref={noteInputRef}
              testID={`${testID}-note`}
              accessibilityLabel="Note"
              value={value.note ?? ""}
              onChangeText={(t) => set("note", t === "" ? null : t)}
              onFocus={() => centering?.onFieldFocus(noteInputRef)}
              onBlur={() => centering?.onFieldBlur(noteInputRef)}
              multiline
              placeholder="Add a detail"
              placeholderTextColor={colors.textPlaceholder}
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
            <FieldError testID={`${testID}-note-error`} message={noteError} />
          </View>
        );
      case "duration": {
        // Optional; descriptive only — never feeds Status/Gravity/Intensity.
        // Selected chip = accent fill + onAccent label (D-30).
        const noneTone = durationChipTone(value.duration === null);
        return (
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Duration
            </Text>
            <View style={styles.chipRow}>
              {DURATION_PRESETS.map((preset) => {
                const selected = value.duration === preset.seconds;
                const tone = durationChipTone(selected);
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
                        backgroundColor: colors[tone.fill],
                        borderColor: colors[tone.border],
                      },
                    ]}
                  >
                    <Text style={{ color: colors[tone.label] }}>
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
                    backgroundColor: colors[noneTone.fill],
                    borderColor: colors[noneTone.border],
                  },
                ]}
              >
                <Text style={{ color: colors[noneTone.label] }}>None</Text>
              </Pressable>
            </View>
            <TextInput
              ref={customMinutesRef}
              testID={`${testID}-duration-custom`}
              onFocus={() => centering?.onFieldFocus(customMinutesRef)}
              onBlur={() => centering?.onFieldBlur(customMinutesRef)}
              accessibilityLabel="Custom duration in minutes"
              // Follows a duration changed elsewhere (a chip, Follow event).
              value={customMinutesDisplay(customMinutes, value.duration)}
              onChangeText={(t) => {
                setCustomMinutes(t);
                // parseCustomDurationMinutes returns null for empty/invalid/out-of-range
                // (the "none" outcome), so an in-progress or bad entry never persists a
                // 0 or an out-of-bound duration.
                set("duration", parseCustomDurationMinutes(t));
              }}
              keyboardType="number-pad"
              placeholder="Custom (minutes)"
              placeholderTextColor={colors.textPlaceholder}
              style={[
                styles.control,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
            />
            {/* A refused entry says so; nothing else on screen would (A-WR-04). */}
            <FieldError
              testID={`${testID}-duration-error`}
              message={customDurationError(customMinutes, value.duration)}
            />
            {/* No "None" readout: the None chip already shows it (38.14 D-31). */}
            {showDurationReadout(value.duration) ? (
              <Text
                testID={`${testID}-duration-label`}
                style={[styles.hint, { color: colors.textSecondary }]}
              >
                {formatDurationLabel(value.duration)}
              </Text>
            ) : null}
          </View>
        );
      }
      case "allowAi": {
        // Per-interaction egress gate; defaults OFF — D-04. A locked note
        // (D-103) shows off and disabled, with its reason in the caption slot.
        const locked = allowAiLockedReason !== undefined;
        const caption = locked ? allowAiLockedReason : allowAiCaption;
        return (
          <View style={styles.field}>
            <View style={styles.toggleRow}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                Allow AI
              </Text>
              <OrbitSwitch
                testID={`${testID}-allow-ai`}
                accessibilityLabel="Allow AI"
                value={locked ? false : value.allowAi === 1}
                disabled={locked}
                onValueChange={(v) => {
                  if (!locked) set("allowAi", coerceAllowAi(v));
                }}
              />
            </View>
            {caption ? (
              <Text
                testID={`${testID}-allow-ai-caption`}
                style={[styles.hint, { color: colors.textSecondary }]}
              >
                {caption}
              </Text>
            ) : null}
          </View>
        );
      }
      default:
        return null;
    }
  }

  return (
    <View testID={testID} style={styles.form}>
      {FIELD_ORDER.filter(showInline).map((field) => (
        <Fragment key={field}>{renderField(field)}</Fragment>
      ))}

      {/* More Options disclosure — a self-contained, form-owned toggle. Defaults
          collapsed, so deferred fields are absent until the user expands it. */}
      {deferredFields.length > 0 ? (
        <View style={styles.field}>
          <Pressable
            testID={`${testID}-more-options`}
            accessibilityRole="button"
            accessibilityLabel={moreOptionsLabel}
            accessibilityState={{ expanded: showMore }}
            onPress={() => setShowMore((prev) => !prev)}
            style={styles.moreToggle}
          >
            <Text style={[styles.moreLabel, { color: colors.accentText }]}>
              {moreOptionsLabel}
            </Text>
          </Pressable>
          {showMore
            ? deferredFields.map((field) => (
                <Fragment key={field}>{renderField(field)}</Fragment>
              ))
            : null}
        </View>
      ) : null}

      <OptionSheet
        visible={openSheet === "channel"}
        title="Channel"
        options={channels}
        selected={value.channel}
        onSelect={(v) => set("channel", v)}
        onRequestClose={() => setOpenSheet(null)}
      />
      <OptionSheet
        visible={openSheet === "direction"}
        title="Direction"
        options={DIRECTION_SHEET_OPTIONS}
        selected={value.direction}
        onSelect={(v) => set("direction", v)}
        onRequestClose={() => setOpenSheet(null)}
      />
      <OptionSheet
        visible={openSheet === "tone"}
        title="Tone"
        options={TONE_SHEET_OPTIONS}
        selected={value.quality}
        onSelect={(v) => set("quality", v)}
        onRequestClose={() => setOpenSheet(null)}
      />

      {showDatePicker ? (
        <DateTimePicker
          testID={`${testID}-date-picker`}
          value={seed}
          mode="date"
          // No day after today (38.14 D-24); the time guard covers today.
          maximumDate={parseLocalDateTime(now)}
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
    minHeight: MIN_TOUCH_TARGET,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  hint: {
    fontSize: 13,
  },
  moreToggle: {
    minHeight: 44,
    justifyContent: "center",
  },
  moreLabel: {
    fontSize: 15,
    fontWeight: "600",
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
