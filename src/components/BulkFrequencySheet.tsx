// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.
/**
 * The bulk Change Contact Frequency sheet (38.13 D-39, audit A-12): the same
 * `FrequencyPicker` the Profile uses (presets plus Custom…), in a compact
 * sheet, instead of a raw days field.
 *
 * A mixed selection has no single current frequency, so the picker starts on
 * the Monthly preset (`FREQUENCY_DAYS.Monthly`, 30 days; this plan only) and
 * is reset to it each time the sheet opens. The picker owns its inline error
 * (no snackbar is used for validation); Continue is blocked while it reports
 * an invalid Custom… entry. Continue only hands the interval back: the host
 * still shows its confirm dialog before anything is written (D-18, D-75).
 *
 * Every bulk sheet opens at the same compact size (D-71). No colour literal
 * (check:colors).
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { FrequencyPicker } from "@/components/FrequencyPicker";
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
  // Bumped on every open; it keys the picker so its Custom… text and unit
  // (transient state the picker owns) start fresh too.
  const [openCount, setOpenCount] = useState(0);
  const [shownVisible, setShownVisible] = useState(visible);
  if (visible !== shownVisible) {
    setShownVisible(visible);
    if (visible) {
      setIntervalDays(BULK_FREQUENCY_START_DAYS);
      setValid(true);
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
          onChange={setIntervalDays}
          onValidityChange={setValid}
        />
        <Button
          testID="bulk-frequency-continue"
          role="primary"
          label="Continue"
          accessibilityLabel="Confirm frequency"
          disabled={!valid}
          onPress={() => {
            if (!valid) return;
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
