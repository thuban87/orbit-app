// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
/**
 * The bulk Change Contact Frequency sheet (38.13 D-39, audit A-12): the same
 * `FrequencyPicker` the Profile uses (presets plus Custom…), in a compact
 * sheet, instead of a raw days field.
 *
 * A mixed selection has no single current frequency, so the picker starts on
 * the Monthly preset (`FREQUENCY_DAYS.Monthly`, 30 days; this plan only) and
 * is reset to it each time the sheet opens.
 *
 * Validation follows ADR-199 (38.9 D-19; review B-CR-01): Continue stays
 * pressable. The picker's Custom… error renders through `FieldError` (a
 * polite live region) once the user types; pressing Continue on an invalid
 * entry forces that error and announces it, which is this one-field sheet's
 * first-error reveal (the error sits directly under the only field). No
 * snackbar is used for validation. Continue only hands a valid interval back:
 * the host still shows its confirm dialog before anything is written (D-18,
 * D-75).
 *
 * Every bulk sheet opens at the same compact size (D-71). No colour literal
 * (check:colors).
 */
import { useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import { INVALID_INTERVAL_MESSAGE } from "@/components/frequency-picker-logic";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { SPACING } from "@/theme/tokens/spacing";
import { FREQUENCY_DAYS } from "@/types";

/** Where the picker starts for a mixed selection (D-39; this plan only). */
export const BULK_FREQUENCY_START_DAYS = FREQUENCY_DAYS.Monthly;

export interface BulkFrequencySheetProps {
  visible: boolean;
  /** Scrim, system Back: the host closes the sheet and releases its claim. */
  onCancel: () => void;
  /** A valid interval in days; the host opens its confirm dialog with it. */
  onContinue: (intervalDays: number) => void;
}

export function BulkFrequencySheet({
  visible,
  onCancel,
  onContinue,
}: BulkFrequencySheetProps) {
  const [intervalDays, setIntervalDays] = useState(BULK_FREQUENCY_START_DAYS);
  const [valid, setValid] = useState(true);
  // A blocked Continue asks the picker to show its error now (ADR-199).
  const [forceError, setForceError] = useState(false);
  // Bumped on every open; it keys the picker so its Custom… text and unit
  // (transient state the picker owns) start fresh too.
  const [openCount, setOpenCount] = useState(0);
  const [shownVisible, setShownVisible] = useState(visible);
  if (visible !== shownVisible) {
    setShownVisible(visible);
    if (visible) {
      setIntervalDays(BULK_FREQUENCY_START_DAYS);
      setValid(true);
      setForceError(false);
      setOpenCount((count) => count + 1);
    }
  }

  return (
    <Sheet visible={visible} onRequestClose={onCancel} variant="compact">
      <View style={styles.content}>
        <AppText role="heading" accessibilityRole="header">
          Change Contact Frequency
        </AppText>
        <FrequencyPicker
          key={openCount}
          testID="bulk-frequency-picker"
          value={intervalDays}
          onChange={(days) => {
            setIntervalDays(days);
            setForceError(false);
          }}
          onValidityChange={setValid}
          errorAfterTyping
          errorForced={forceError}
          errorAsFieldError
        />
        <Button
          testID="bulk-frequency-continue"
          role="primary"
          label="Continue"
          accessibilityLabel="Confirm frequency"
          onPress={() => {
            if (!valid) {
              setForceError(true);
              AccessibilityInfo.announceForAccessibility(
                INVALID_INTERVAL_MESSAGE,
              );
              return;
            }
            onContinue(intervalDays);
          }}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACING.base, paddingBottom: SPACING.base },
});
