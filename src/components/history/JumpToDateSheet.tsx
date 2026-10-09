// biome-ignore-all lint/a11y/useValidAriaRole: Orbit's Button/AppText `role` is a domain prop, not ARIA.
/**
 * JumpToDateSheet (38.8 D-17, D-18, D-48..D-52) — the History stream's
 * 'Jump to date' picker: a compact bottom sheet with a year stepper
 * (◀ YYYY ▶) above a 3×4 month grid. A month tap jumps (the parent resolves it
 * against the stream); future months are disabled; a month holding a record of
 * any family shows a small dot, and its accessible label says so, so the dot is
 * never the only signal (D-49, D-52, D-07).
 *
 * Presentational over the pure `pickerModel`: the displayed year is the
 * sheet's own per-open state, reset to the opening month's year each time it
 * opens, never persisted (D-18, D-62).
 *
 * The sheet is an opaque surface and this host reads its colours ABOVE the
 * overlay's UnscopedTheme boundary, so it reads the ROOT palette through
 * `useUnscopedTheme()` (overlay-host contract, Lane B2 WR-01) — it opens from
 * the Profile History glass card. No colour literal. No ScrollView of its own:
 * the compact Sheet body already scrolls at large text (D-06).
 */
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@/components/icons/Icon";
import { AppText, Sheet } from "@/components/ui";
import { useUnscopedTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { pickerModel, type StreamModel } from "./history-stream-logic";

/** Minimum month-cell and stepper target (D-06 reach). */
const PICKER_TARGET_DP = 44;

export interface JumpToDateSheetProps {
  visible: boolean;
  onRequestClose: () => void;
  model: StreamModel;
  /** `YYYY-MM` the picker opens on (its year is shown first). */
  initialMonthKey: string;
  /** A choosable month was tapped. */
  onSelectMonth: (monthKey: string) => void;
}

export function JumpToDateSheet({
  visible,
  onRequestClose,
  model,
  initialMonthKey,
  onSelectMonth,
}: JumpToDateSheetProps) {
  const { colors } = useUnscopedTheme();
  const initialYear = Number(initialMonthKey.slice(0, 4));
  const [year, setYear] = useState(initialYear);
  // Each opening starts on the opening month's year (per-open view state).
  useEffect(() => {
    if (visible) setYear(initialYear);
  }, [visible, initialYear]);
  const picker = pickerModel({
    model,
    year,
    selectedMonthKey: initialMonthKey,
  });
  return (
    <Sheet visible={visible} onRequestClose={onRequestClose} variant="compact">
      <View style={styles.content} testID="history-jump-sheet">
        <AppText role="heading">Jump to</AppText>
        <View style={styles.stepper}>
          <Pressable
            testID="history-jump-prev-year"
            accessibilityRole="button"
            accessibilityLabel="Previous year"
            accessibilityState={{ disabled: !picker.canPrev }}
            disabled={!picker.canPrev}
            hitSlop={8}
            onPress={() => setYear(picker.year - 1)}
            style={styles.stepButton}
          >
            <Icon
              name="back"
              tone={picker.canPrev ? "textSecondary" : "border"}
              size="md"
            />
          </Pressable>
          <AppText
            role="label"
            testID="history-jump-year"
            style={[styles.year, { color: colors.textPrimary }]}
          >
            {String(picker.year)}
          </AppText>
          <Pressable
            testID="history-jump-next-year"
            accessibilityRole="button"
            accessibilityLabel="Next year"
            accessibilityState={{ disabled: !picker.canNext }}
            disabled={!picker.canNext}
            hitSlop={8}
            onPress={() => setYear(picker.year + 1)}
            style={styles.stepButton}
          >
            <Icon
              name="forward"
              tone={picker.canNext ? "textSecondary" : "border"}
              size="md"
            />
          </Pressable>
        </View>
        <View style={styles.grid}>
          {picker.months.map((month) => (
            <Pressable
              key={month.monthKey}
              testID={`history-jump-month-${month.monthKey}`}
              accessibilityRole="button"
              accessibilityLabel={month.accessibilityLabel}
              accessibilityState={{ disabled: month.disabled }}
              disabled={month.disabled}
              onPress={() => onSelectMonth(month.monthKey)}
              style={[
                styles.month,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
            >
              <AppText role="label" style={{ color: colors.textPrimary }}>
                {month.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: SPACING.md },
  stepper: {
    alignItems: "center",
    flexDirection: "row",
    gap: SPACING.base,
    justifyContent: "center",
  },
  stepButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: PICKER_TARGET_DP,
    minWidth: PICKER_TARGET_DP,
  },
  year: { fontVariant: ["tabular-nums"] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  month: {
    alignItems: "center",
    borderRadius: RADII.md,
    borderWidth: 1,
    flexBasis: "30%",
    flexGrow: 1,
    justifyContent: "center",
    minHeight: PICKER_TARGET_DP,
    paddingVertical: SPACING.sm,
  },
});
