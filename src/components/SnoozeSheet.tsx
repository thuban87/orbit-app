// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
/**
 * The shared snooze sheet (38.11 D-45): one sheet, modelled on the Profile
 * card sheet, for the Profile Overview Snooze tile, the Profile ⋯ "Snooze…"
 * entry, the Contacts card snooze and Contacts bulk snooze. It offers the
 * three presets, "Until I turn it off" (38.12 D-96: the indefinite snooze,
 * written as `INDEFINITE_SNOOZE_UNTIL` through `onUntil`, so Undo and every
 * reader treat it like a dated snooze, D-98), Choose date, Unsnooze when
 * allowed, and Close (D-15). The custom date defaults to and starts at
 * tomorrow, is capped at ten years so it never equals the sentinel (38.12-01
 * only), and Cancel collapses the date picker (D-37). Every snooze-end display
 * goes through `snoozeUntilLabel`, so no surface prints the year 9999.
 *
 * It owns no DAO. Each choice calls the host's `onPreset` / `onUntil` /
 * `onUnsnooze`, which reject on failure. The sheet settles them through the
 * shared relationship-sheet runner (38.3 RG-025): pending, the existing error
 * copy and Retry of the last operation; Retry re-runs that same operation
 * closure, so a host operation must read anything it consumes (e.g. a bulk
 * claim) at call time. A resolved operation closes the sheet.
 *
 * Close while pending (38.11 review V-08; precedent
 * `ProfileRelationshipSheets.close`): the Close button and the Sheet's
 * `onRequestClose` (scrim, system Back) go through one `close()` that returns
 * early while an operation runs, so a failure is never lost. Hosts clear their
 * state only from `onClose`.
 *
 * Confirmation (38.9 D-39 feedback rule, D-46 copy; 38.11 review V-03): when
 * `confirmName` is set (single-contact hosts; bulk keeps its own count
 * snackbar), a resolved operation shows one success snackbar naming the person.
 * Snooze is reversible, so it carries Undo, which restores the person's
 * previous EFFECTIVE snooze state captured when the operation started
 * (`snoozedUntil`, review W-01): not snoozed → `onRestore(null)`, snoozed
 * until D → `onRestore(D)`. The expiry is re-checked once, here, against the
 * wall clock when Undo is tapped (review Y-01): a D that is no longer in the
 * future restores to not snoozed. Undo confirms with "Snooze undone for
 * {name}"; an Undo failure shows an error snackbar. Copy is draft, "this plan
 * only" (38.11-10).
 *
 * Sizing (38.13 D-87, amending D-71): with `sizeToContent` (the Contacts bulk
 * Snooze only) the sheet opens at the smallest size that holds its heading,
 * choices, Unsnooze and Close, through the bulk Set Category sheet's rule
 * (`snoozeSheetVariantFor` → `sizedSheetVariantFor`, D-85). Without it the
 * sheet stays compact, as before, for every other host.
 *
 * No colour literal (check:colors).
 */
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useRef, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  SNOOZE_CHOICE_BORDER_WIDTH,
  SNOOZE_CHOICE_MIN_HEIGHT,
  SNOOZE_CHOICE_PADDING_HORIZONTAL,
  SNOOZE_CLOSE_MARGIN_TOP,
  SNOOZE_SHEET_GAP,
  SNOOZE_SHEET_PADDING_BOTTOM,
  snoozeSheetVariantFor,
} from "@/components/bulk-sheet-fit";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useSheetFitEnvironment } from "@/components/use-sheet-fit-environment";
import { INDEFINITE_SNOOZE_UNTIL, type SnoozePreset } from "@/db/snooze-dao";
import {
  type RelationshipSheetAction,
  type RelationshipSheetState,
  relationshipSheetReducer,
  SNOOZE_CHOICES,
  type SnoozeOutcome,
  snoozeConfirmationLabel,
  snoozeCustomDateDefault,
  snoozeCustomDateMaximum,
  snoozeUndoneLabel,
  snoozeUntilLabel,
  validateCustomSnoozeDate,
} from "@/profile/relationship-sheet-model";
import {
  createRelationshipSheetRunner,
  type RelationshipSheetRunner,
} from "@/profile/relationship-sheet-runner";
import { showSnackbar } from "@/stores/snackbar-store";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import {
  formatDisplayDateOrFallback,
  formatLocalDate,
  isSnoozed,
  parseLocalMs,
} from "@/utils/dates";
import { Logger } from "@/utils/logger";

const LOG_SCOPE = "snooze-sheet";

type SnoozeSheetState = RelationshipSheetState<string | null>;

const IDLE: SnoozeSheetState = {
  committed: null,
  draft: null,
  pending: false,
  error: null,
};

export interface SnoozeSheetProps {
  visible: boolean;
  /** e.g. "Snooze Ann Lee" or "Snooze 3 contacts". */
  title: string;
  /**
   * The person's EFFECTIVE snooze end (`isSnoozed(raw, today) ? raw : null`,
   * review W-01): an expired `snooze_until` is passed as null. Shows the
   * "Snoozed until …" line and is Undo's previous state.
   */
  snoozedUntil: string | null;
  /** Show Unsnooze (needs `onUnsnooze`). */
  showUnsnooze: boolean;
  /** Today as a local `YYYY-MM-DD`; Choose date starts the day after. */
  todayLocal: string;
  onPreset: (preset: SnoozePreset) => Promise<void>;
  onUntil: (until: string) => Promise<void>;
  onUnsnooze?: () => Promise<void>;
  /**
   * The person's name: a resolved operation shows one confirmation naming
   * them, with Undo when `onRestore` is given. Omitted for bulk.
   */
  confirmName?: string;
  /** Undo's write: null clears the snooze, a date snoozes until it. */
  onRestore?: (previousUntil: string | null) => Promise<void>;
  /** Called by the guarded close and after a resolved operation. */
  onClose: () => void;
  /**
   * Open sized to the sheet's rows (38.13 D-87; the Contacts bulk Snooze
   * only). Default false: compact.
   */
  sizeToContent?: boolean;
}

/** A local Date at noon for a `YYYY-MM-DD` (never a UTC parse). */
function pickerDate(localDate: string): Date {
  const date = new Date(parseLocalMs(localDate));
  date.setHours(12, 0, 0, 0);
  return date;
}

/** Undo restores the previous effective state, re-checked at tap time. */
function undoSnoozeChange(
  name: string,
  previousUntil: string | null,
  onRestore: (previousUntil: string | null) => Promise<void>,
): void {
  const today = formatLocalDate(new Date());
  const target =
    previousUntil !== null && isSnoozed(previousUntil, today)
      ? previousUntil
      : null;
  void (async () => {
    try {
      await onRestore(target);
    } catch (cause) {
      Logger.error(LOG_SCOPE, "failed to undo a snooze change", cause);
      showSnackbar({
        kind: "error",
        label: `Couldn't undo the snooze change for ${name}. Try again.`,
      });
      return;
    }
    const label = snoozeUndoneLabel(name);
    AccessibilityInfo.announceForAccessibility(label);
    showSnackbar({ kind: "success", label });
  })();
}

/** The one single-contact confirmation after a resolved operation. */
function confirmSnoozeChange(
  name: string,
  outcome: SnoozeOutcome,
  previousUntil: string | null,
  onRestore: ((previousUntil: string | null) => Promise<void>) | undefined,
): void {
  const label = snoozeConfirmationLabel(name, outcome);
  AccessibilityInfo.announceForAccessibility(label);
  showSnackbar(
    onRestore
      ? {
          kind: "success",
          label,
          action: {
            label: "Undo",
            accessibilityLabel: `Undo snooze change for ${name}`,
            onPress: () => undoSnoozeChange(name, previousUntil, onRestore),
          },
        }
      : { kind: "success", label },
  );
}

export function SnoozeSheet({
  visible,
  title,
  snoozedUntil,
  showUnsnooze,
  todayLocal,
  onPreset,
  onUntil,
  onUnsnooze,
  confirmName,
  onRestore,
  onClose,
  sizeToContent = false,
}: SnoozeSheetProps) {
  const { colors } = useTheme();
  const sheetFit = useSheetFitEnvironment();
  const variant = sizeToContent
    ? snoozeSheetVariantFor({
        ...sheetFit,
        title,
        showCurrent: snoozedUntil !== null,
        choiceLabels: SNOOZE_CHOICES.map((choice) => choice.label),
        showUnsnooze: showUnsnooze && onUnsnooze !== undefined,
      })
    : "compact";
  const [state, setState] = useState<SnoozeSheetState>(IDLE);
  const [customOpen, setCustomOpen] = useState(false);
  const [customDate, setCustomDate] = useState(() =>
    snoozeCustomDateDefault(todayLocal),
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  // Synchronous mirror so the runner's pending check never reads a stale
  // render; every state change goes through `apply`.
  const stateRef = useRef<SnoozeSheetState>(state);
  const apply = (update: (current: SnoozeSheetState) => SnoozeSheetState) => {
    const next = update(stateRef.current);
    stateRef.current = next;
    setState(next);
  };
  const latestOnClose = useRef(onClose);
  latestOnClose.current = onClose;

  const runnerRef = useRef<RelationshipSheetRunner | null>(null);
  if (runnerRef.current === null) {
    runnerRef.current = createRelationshipSheetRunner({
      dispatch: (_owner, action) =>
        apply((current) =>
          relationshipSheetReducer(
            current,
            action as RelationshipSheetAction<string | null>,
          ),
        ),
      isPending: () => stateRef.current.pending,
      // A resolved operation closes the sheet.
      onClose: () => {
        setCustomOpen(false);
        setPickerOpen(false);
        latestOnClose.current();
      },
    });
  }
  const runner = runnerRef.current;
  const pending = state.pending;

  const close = () => {
    if (stateRef.current.pending) return;
    apply((current) => relationshipSheetReducer(current, { type: "dismiss" }));
    runner.clear();
    setCustomOpen(false);
    setPickerOpen(false);
    onClose();
  };

  // The operation closure is retained for Retry; it captures the previous
  // state and the confirmation inputs of the render the user acted on.
  const submit = (operation: () => Promise<void>, outcome: SnoozeOutcome) => {
    const previousUntil = snoozedUntil;
    const name = confirmName;
    const restore = onRestore;
    void runner.submit("snooze", null, async () => {
      await operation();
      if (name !== undefined) {
        confirmSnoozeChange(name, outcome, previousUntil, restore);
      }
    });
  };

  const minimumDate = snoozeCustomDateDefault(todayLocal);
  const maximumDate = snoozeCustomDateMaximum(todayLocal);
  const customValid = validateCustomSnoozeDate(customDate, todayLocal).valid;
  const customDisplay = formatDisplayDateOrFallback(customDate);

  const openCustom = () => {
    setCustomDate(minimumDate);
    setCustomOpen(true);
    setPickerOpen(true);
  };
  const collapseCustom = () => {
    setCustomOpen(false);
    setPickerOpen(false);
  };
  const onPickerChange = (event: DateTimePickerEvent, date?: Date) => {
    setPickerOpen(false);
    if (event.type === "set" && date) setCustomDate(formatLocalDate(date));
  };

  const content = (
    <View style={styles.content}>
      <AppText role="heading" accessibilityRole="header">
        {title}
      </AppText>
      {snoozedUntil ? (
        <AppText role="body" testID="snooze-sheet-current">
          {`Snoozed ${snoozeUntilLabel(snoozedUntil)}`}
        </AppText>
      ) : null}
      {SNOOZE_CHOICES.map((choice) => {
        const id = choice.kind === "preset" ? choice.preset : choice.kind;
        return (
          <Pressable
            key={id}
            testID={`snooze-sheet-${id}`}
            accessibilityRole="button"
            accessibilityLabel={choice.accessibilityLabel}
            accessibilityState={{
              disabled: pending,
              ...(choice.kind === "custom" ? { expanded: customOpen } : {}),
            }}
            disabled={pending}
            onPress={() => {
              if (choice.kind === "preset") {
                const preset = choice.preset;
                submit(() => onPreset(preset), { kind: "preset", preset });
              } else if (choice.kind === "indefinite") {
                const until = INDEFINITE_SNOOZE_UNTIL;
                submit(() => onUntil(until), { kind: "until", until });
              } else if (!customOpen) {
                openCustom();
              }
            }}
            style={[styles.choice, { borderColor: colors.border }]}
          >
            <AppText role="body">{choice.label}</AppText>
          </Pressable>
        );
      })}
      {customOpen ? (
        <View style={styles.custom}>
          <Pressable
            testID="snooze-sheet-date"
            accessibilityRole="button"
            accessibilityLabel={`Snooze until ${customDisplay}. Change date`}
            accessibilityState={{ disabled: pending }}
            disabled={pending}
            onPress={() => setPickerOpen(true)}
            style={[
              styles.choice,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <AppText role="body">{`Until ${customDisplay}`}</AppText>
          </Pressable>
          <Button
            testID="snooze-sheet-set"
            role="primary"
            label="Set snooze"
            disabled={!customValid || pending}
            onPress={() => {
              const until = customDate;
              submit(() => onUntil(until), { kind: "until", until });
            }}
          />
          <Button
            testID="snooze-sheet-cancel-date"
            role="tertiary"
            label="Cancel"
            accessibilityLabel="Cancel choosing a date"
            disabled={pending}
            onPress={collapseCustom}
          />
        </View>
      ) : null}
      {pickerOpen ? (
        <DateTimePicker
          testID="snooze-sheet-picker"
          value={pickerDate(customDate)}
          mode="date"
          minimumDate={pickerDate(minimumDate)}
          maximumDate={pickerDate(maximumDate)}
          onChange={onPickerChange}
        />
      ) : null}
      {showUnsnooze && onUnsnooze ? (
        <Button
          testID="snooze-sheet-unsnooze"
          role="secondary"
          label="Unsnooze"
          disabled={pending}
          onPress={() => submit(() => onUnsnooze(), { kind: "unsnooze" })}
        />
      ) : null}
      {pending ? <AppText role="caption">Saving…</AppText> : null}
      {state.error ? (
        <AppText role="caption" testID="snooze-sheet-error">
          {state.error}
        </AppText>
      ) : null}
      {state.error && runner.canRetry() ? (
        <Button
          testID="snooze-sheet-retry"
          role="secondary"
          label="Retry"
          onPress={() => void runner.retry()}
        />
      ) : null}
      <View style={styles.close}>
        <Button
          testID="snooze-sheet-close"
          role="tertiary"
          label="Close"
          onPress={close}
        />
      </View>
    </View>
  );

  // 38.13 D-87: an expanded Sheet's body does not scroll; its consumer owns
  // the scroll (Sheet.tsx), so the expanded size renders its own ScrollView.
  return variant === "expanded" ? (
    <Sheet visible={visible} onRequestClose={close} variant="expanded">
      <ScrollView testID="snooze-sheet-scroll" style={styles.scroll}>
        {content}
      </ScrollView>
    </Sheet>
  ) : (
    <Sheet
      visible={visible}
      onRequestClose={close}
      variant={variant === "compact" ? "compact" : "detail"}
    >
      {content}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: SNOOZE_SHEET_GAP,
    paddingBottom: SNOOZE_SHEET_PADDING_BOTTOM,
  },
  choice: {
    minHeight: SNOOZE_CHOICE_MIN_HEIGHT,
    justifyContent: "center",
    borderWidth: SNOOZE_CHOICE_BORDER_WIDTH,
    borderRadius: RADII.md,
    paddingHorizontal: SNOOZE_CHOICE_PADDING_HORIZONTAL,
  },
  custom: { gap: SPACING.sm },
  close: { marginTop: SNOOZE_CLOSE_MARGIN_TOP },
  scroll: { flex: 1 },
});
