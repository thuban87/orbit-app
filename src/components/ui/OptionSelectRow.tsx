/**
 * OptionSelectRow (38.9 D-28) — the themed trigger for an `OptionSheet`: the
 * current value's label and a chevron, at least 44dp tall. It replaces the
 * native spinner's closed state at every single-choice site.
 *
 * Accessibility (38.4 RG-030, C5-M2): a button named by the field (`label`)
 * that announces the current value through `selectorAccessibilityValue`, so
 * the field and its value are both spoken. The visible field label, when a
 * screen shows one, stays the screen's own text above the row.
 *
 * Colours via `useTheme()` (the row sits in its screen's scope). No colour
 * literal (check:colors).
 */
import { Pressable, StyleSheet } from "react-native";
import { Icon } from "@/components/icons/Icon";
import { selectorAccessibilityValue } from "@/components/selector-a11y";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";
import { AppText } from "./AppText";
import { MIN_TOUCH_TARGET } from "./button-roles";

export interface OptionSelectRowProps {
  /** The field name, spoken as the button's label. */
  label: string;
  /** The current value's label; empty shows `placeholder`. */
  currentLabel: string | null | undefined;
  /** Shown (muted) when there is no current value. */
  placeholder?: string;
  onPress: () => void;
  /** Locks the row (announced as disabled), e.g. while a restore applies. */
  disabled?: boolean;
  testID?: string;
}

export function OptionSelectRow({
  label,
  currentLabel,
  placeholder = "Select…",
  onPress,
  disabled = false,
  testID,
}: OptionSelectRowProps) {
  const { colors } = useTheme();
  const hasValue = Boolean(currentLabel);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={selectorAccessibilityValue(currentLabel)}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
        disabled ? styles.disabled : null,
      ]}
    >
      <AppText
        style={[
          styles.value,
          { color: hasValue ? colors.textPrimary : colors.textSecondary },
        ]}
      >
        {hasValue ? currentLabel : placeholder}
      </AppText>
      <Icon name="chevron-down" tone="textSecondary" size="sm" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  value: { flex: 1 },
  disabled: { opacity: 0.6 },
});
