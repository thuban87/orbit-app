/**
 * FilterChipRow (DASH-02) — the SINGLE-ACTIVE, purely PRESENTATIONAL chip control
 * the dashboard controls render above the card list. NO DB, NO navigation: the
 * parent (Plan 09) owns the active state, wires categories/batteries into the chip
 * list, and reacts to `onSelect`.
 *
 * v1 is SINGLE active filter (08-UI-SPEC § Interaction States — not multi-select).
 * The chip keys mirror `DashboardFilter` (all · needs-attention · category-{id} ·
 * battery-{value} · favourites · snoozed); the snoozed / favourites chips carry
 * their count in the label.
 *
 * Active chip = `accent` fill / `borderStrong` outline with a `background` label
 * (the shipped filled-accent idiom — dark text on the accent fill). Inactive =
 * `surface` fill / `border` outline with a `textSecondary` label. Every colour
 * resolves through `useTheme().colors.*` — no hex/named literal (CLAUDE.md /
 * check:colors).
 */
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import type { DashboardFilter } from "@/db/dashboard-read";
import { useTheme } from "@/theme";

export interface FilterChip {
  /** The filter key — mirrors `DashboardFilter`; drives the testID + onSelect. */
  key: DashboardFilter;
  /** The chip's display label. */
  label: string;
  /** An optional count rendered in parentheses (snoozed / favourites). */
  count?: number;
}

export interface FilterChipRowProps {
  /** The chips to render, in order (the parent composes categories/batteries in). */
  chips: FilterChip[];
  /** The single active filter key. */
  active: DashboardFilter;
  /** Called with the tapped chip's key — the parent owns the active state. */
  onSelect: (key: DashboardFilter) => void;
}

export function FilterChipRow({ chips, active, onSelect }: FilterChipRowProps) {
  const { colors } = useTheme();

  return (
    <ScrollView
      testID="dashboard-filter-chip-row"
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {chips.map((chip) => {
        const isActive = chip.key === active;
        const label =
          chip.count != null ? `${chip.label} (${chip.count})` : chip.label;
        return (
          <Pressable
            key={chip.key}
            testID={`dashboard-filter-chip-${chip.key}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
            onPress={() => onSelect(chip.key)}
            style={[
              styles.chip,
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
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});
