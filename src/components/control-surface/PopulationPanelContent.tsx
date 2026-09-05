import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DashboardPopulation, DashboardQueryState } from "@/logic/dashboard-query-logic";
import { useTheme } from "@/theme";
import { POPULATION_LABELS } from "./control-labels";

const POPULATION_ORDER: DashboardPopulation[] = [
  "all-contacts",
  "favourites",
  "birthdays",
  "not-contacted",
  "snoozed",
];

export interface PopulationPanelContentProps {
  state: DashboardQueryState;
  onTogglePopulation: (key: DashboardPopulation) => void;
  disabled?: boolean;
}

/** Presentation-only option content; persistence remains with the trigger owner. */
export function PopulationPanelContent({ state, onTogglePopulation, disabled = false }: PopulationPanelContentProps) {
  const { colors } = useTheme();
  return (
    <View testID="dashboard-population-panel" style={styles.content}>
      {POPULATION_ORDER.map((key) => {
        const selected = state.populations.includes(key);
        return (
          <Pressable
            key={key}
            testID={`dashboard-population-option-${key}`}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={POPULATION_LABELS[key]}
            disabled={disabled}
            onPress={() => onTogglePopulation(key)}
            style={[
              styles.option,
              selected
                ? { backgroundColor: colors.accent, borderColor: colors.borderStrong }
                : { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.label, { color: selected ? colors.background : colors.textPrimary }]}>
              {POPULATION_LABELS[key]}
            </Text>
            <Text accessibilityElementsHidden style={[styles.selection, { color: selected ? colors.background : colors.textSecondary }]}>
              {selected ? "Selected" : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 8 },
  option: { minHeight: 44, borderRadius: 10, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  label: { fontSize: 16, fontWeight: "400" },
  selection: { fontSize: 14, fontWeight: "600" },
});
