/**
 * SegmentedControl (ORR-02) — a thin, purely PRESENTATIONAL two-(or-more-)segment
 * toggle in the shipped filled-accent chip idiom (reused from `FilterChipRow`).
 *
 * Deliberately NOT an overload of `FilterChipRow`: that control is keyed to the
 * dashboard's `DashboardFilter` union and scrolls horizontally, whereas the orrery
 * view toggle is a fixed, equal-width two-segment control over a generic value
 * (RESEARCH OQ-3 — Claude's discretion). It shares only the VISUAL treatment:
 *
 *   - active segment  → `accent` fill / `borderStrong` outline / `background` label
 *     (the shipped filled-accent idiom — dark text on the accent fill);
 *   - inactive segment → `surface` fill / `border` outline / `textSecondary` label;
 *   - the shipped 44 / 10 / 12 / 16-600 dimensions.
 *
 * Fully controlled: the parent (OrreryScreen) owns the active value and reacts to
 * `onChange`. NO DB, NO navigation, NO local selection state. Every colour resolves
 * through `useTheme().colors.*` — no hex/named literal (CLAUDE.md / check:colors).
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/icon-registry";
import { useTheme } from "@/theme";

/**
 * Tunables for the opt-in `density="compact"` row (38.8 D-24): tighter gaps and
 * segment padding so four labels such as "Cycles / 7 Days / Month / Year" read
 * in full on a phone-width Profile section. Applied ONLY when a caller asks for
 * compact; the default ("regular") styles below are unchanged (Pitfall 11).
 */
const COMPACT_SEGMENT = {
  gap: 6,
  paddingHorizontal: 4,
  fontSize: 16,
} as const;

/**
 * One selectable segment — a display label paired with its value, and an
 * OPTIONAL semantic icon. When `icon` is present the segment renders the
 * semantic `Icon` (filled when active, outline when inactive) instead of the
 * visible text, keeping `label` as the accessibilityLabel; label-only options
 * (the Orrery view toggle) render the `<Text>` exactly as before. The field is
 * typed `IconName` — NOT a bare string — so `tsc --noEmit` rejects an
 * unregistered icon name at the SegmentedControl CALL SITE, not only inside
 * Icon.tsx.
 */
export interface SegmentedControlOption<V extends string> {
  label: string;
  value: V;
  icon?: IconName;
  /**
   * Optional small caption under a text label (38.14 D-36: "cycles" under the
   * History preset numbers). Absent → the segment renders exactly as before.
   */
  caption?: string;
  /**
   * Optional spoken label when the visible label alone does not say what the
   * segment is (38.14 D-36: "Last 5 cycles"). Absent → `label` (unchanged).
   */
  accessibilityLabel?: string;
}

export interface SegmentedControlProps<V extends string> {
  /** The segments to render, in order. */
  options: SegmentedControlOption<V>[];
  /** The active value — the parent owns this state. */
  value: V;
  /** Called with the tapped segment's value; the parent updates `value`. */
  onChange: (value: V) => void;
  /**
   * The container testID (each segment is `${testID}-${value}`). Defaults to the
   * orrery view toggle's id; overridable so the control stays reusable elsewhere.
   */
  testID?: string;
  /**
   * Row density. `"regular"` (the default) is the shipped look every existing
   * caller uses. `"compact"` narrows the gaps and segment padding
   * (`COMPACT_SEGMENT`) so more label width fits per segment; it is opt-in and
   * currently used only by the History lens row (38.8 D-24).
   */
  density?: "regular" | "compact";
  /**
   * Hold every segment (a save in flight, 38.12 D-88): presses are ignored, the
   * row dims and each segment announces disabled. Absent → false.
   */
  disabled?: boolean;
}

/** Opacity of a held row (the shared switch's disabled dim, D-26). */
export const SEGMENTED_DISABLED_OPACITY = 0.5;

export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  testID = "orrery-view-toggle",
  density = "regular",
  disabled = false,
}: SegmentedControlProps<V>) {
  const { colors } = useTheme();
  const compact = density === "compact";

  return (
    <View
      testID={testID}
      style={[
        styles.row,
        compact ? { gap: COMPACT_SEGMENT.gap } : null,
        disabled ? { opacity: SEGMENTED_DISABLED_OPACITY } : null,
      ]}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={`${testID}-${option.value}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive, disabled }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            disabled={disabled}
            onPress={() => {
              if (disabled) return;
              onChange(option.value);
            }}
            style={[
              styles.segment,
              compact
                ? { paddingHorizontal: COMPACT_SEGMENT.paddingHorizontal }
                : null,
              isActive
                ? {
                    backgroundColor: colors.accent,
                    borderColor: colors.borderStrong,
                  }
                : {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
            ]}
          >
            {option.icon ? (
              <Icon
                name={option.icon}
                state={isActive ? "active" : "default"}
                tone={isActive ? "onAccent" : "textSecondary"}
                size="md"
              />
            ) : (
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  compact ? { fontSize: COMPACT_SEGMENT.fontSize } : null,
                  {
                    color: isActive ? colors.onAccent : colors.textSecondary,
                  },
                ]}
              >
                {option.label}
              </Text>
            )}
            {!option.icon && option.caption ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.caption,
                  {
                    color: isActive ? colors.onAccent : colors.textSecondary,
                  },
                ]}
              >
                {option.caption}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
  caption: {
    fontSize: 12,
    fontWeight: "500",
  },
});
