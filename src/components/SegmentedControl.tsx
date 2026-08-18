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
import { useTheme } from "@/theme";

/** One selectable segment — a display label paired with its value. */
export interface SegmentedControlOption<V extends string> {
  label: string;
  value: V;
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
}

export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  testID = "orrery-view-toggle",
}: SegmentedControlProps<V>) {
  const { colors } = useTheme();

  return (
    <View testID={testID} style={styles.row}>
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            testID={`${testID}-${option.value}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
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
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: isActive ? colors.background : colors.textSecondary },
              ]}
            >
              {option.label}
            </Text>
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
});
