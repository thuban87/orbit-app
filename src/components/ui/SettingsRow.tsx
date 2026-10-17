// biome-ignore-all lint/a11y/useValidAriaRole: AppText role is a typography role.

/**
 * SettingsRow (38.12 D-119) — the one row every Settings sub-page draws inside a
 * `SettingsSectionCard`: a title, an optional subtitle under it, an optional
 * right-aligned value, and a trailing slot.
 *
 *   opens something  `onPress` set: a Pressable button with the `forward`
 *                    chevron at the end (unless a `trailing` control, e.g. an
 *                    `OrbitSwitch`, takes that place) and a pressed state.
 *   info-only        no `onPress`: a plain View — no chevron, no pressed state,
 *                    no button role — so it reads as non-tappable (D-119).
 *   disabled         dimmed; a pressable row also ignores presses and reports
 *                    `disabled` to accessibility (38.9 D-26, carried as 38.12
 *                    D-06).
 *
 * `children` render under the title line for a row's secondary content (inline
 * permission buttons, a chip group); a row with children is never grouped into
 * one accessibility element, so those controls stay reachable.
 *
 * The row draws no surface of its own: the section card owns the background,
 * border and dividers. `testID` passes straight through — Settings tests pin row
 * testIDs (38.12 RESEARCH §5). Colours via `useTheme()`; spacing and radii via
 * the theme tokens; text via `AppText` roles (CLAUDE.md / check:colors).
 */
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Icon } from "@/components/icons/Icon";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { AppText } from "./AppText";
import { MIN_TOUCH_TARGET } from "./button-roles";

/** Dim for a disabled row (the shared `Button` uses the same value). */
export const SETTINGS_ROW_DISABLED_OPACITY = 0.5;
/** Feedback while a pressable row is held down. */
export const SETTINGS_ROW_PRESSED_OPACITY = 0.7;

export interface SettingsRowProps {
  title: string;
  /** A secondary line under the title. */
  subtitle?: string | null;
  /** A right-aligned current value (e.g. the chosen region). */
  value?: string | null;
  /** Set only when the row opens or does something; adds the chevron. */
  onPress?: () => void;
  /** A trailing control (e.g. `OrbitSwitch`); replaces the chevron. */
  trailing?: ReactNode;
  /** Secondary content under the title line (inline buttons, chips). */
  children?: ReactNode;
  testID?: string;
  /** testID for the subtitle text, where a test reads it. */
  subtitleTestID?: string;
  /** Defaults to the title (with the value spoken as the a11y value). */
  accessibilityLabel?: string;
  disabled?: boolean;
}

export function SettingsRow({
  title,
  subtitle,
  value,
  onPress,
  trailing,
  children,
  testID,
  subtitleTestID,
  accessibilityLabel,
  disabled = false,
}: SettingsRowProps) {
  const { colors } = useTheme();
  const hasValue = value !== undefined && value !== null && value !== "";
  const hasSubtitle =
    subtitle !== undefined && subtitle !== null && subtitle !== "";
  const showChevron = onPress !== undefined && trailing === undefined;

  const body = (
    <>
      <View style={styles.main}>
        <View style={styles.copy}>
          <AppText role="body" style={{ color: colors.textPrimary }}>
            {title}
          </AppText>
          {hasSubtitle ? (
            <AppText
              role="caption"
              testID={subtitleTestID}
              style={{ color: colors.textSecondary }}
            >
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {hasValue ? (
          <AppText
            role="body"
            style={[styles.value, { color: colors.textSecondary }]}
          >
            {value}
          </AppText>
        ) : null}
        {trailing}
        {showChevron ? (
          <Icon name="forward" tone="textSecondary" size="sm" />
        ) : null}
      </View>
      {children}
    </>
  );

  if (onPress === undefined) {
    // Info-only (or control-carrying) row: no button role, no pressed state.
    // Group it into one spoken element only when nothing inside is focusable.
    const groupable = children === undefined && trailing === undefined;
    return (
      <View
        testID={testID}
        accessible={groupable ? true : undefined}
        accessibilityLabel={
          groupable
            ? (accessibilityLabel ??
              [title, hasValue ? value : null, hasSubtitle ? subtitle : null]
                .filter((part): part is string => part !== null)
                .join(", "))
            : accessibilityLabel
        }
        style={[styles.row, disabled ? styles.disabled : null]}
      >
        {body}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityValue={
        accessibilityLabel === undefined && hasValue
          ? { text: value ?? undefined }
          : undefined
      }
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        disabled
          ? styles.disabled
          : pressed
            ? { opacity: SETTINGS_ROW_PRESSED_OPACITY }
            : null,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
  },
  main: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  copy: { flex: 1, gap: SPACING.xs },
  value: { flexShrink: 1, textAlign: "right" },
  disabled: { opacity: SETTINGS_ROW_DISABLED_OPACITY },
});
