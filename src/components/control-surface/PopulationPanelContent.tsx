import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PopulationPanelKey } from "@/logic/dashboard-population-toggle";
import type {
  DashboardPopulation,
  DashboardQueryState,
} from "@/logic/dashboard-query-logic";
import { useTheme } from "@/theme";
import { AXIS_DEFAULT_LABELS, POPULATION_LABELS } from "./control-labels";

const POPULATION_ORDER: DashboardPopulation[] = [
  "all-contacts",
  "favourites",
  "birthdays",
  "not-contacted",
  "snoozed",
];

export interface PopulationPanelContentProps {
  state: DashboardQueryState;
  onTogglePopulation: (key: PopulationPanelKey) => void;
  disabled?: boolean;
}

/** Presentation-only option content; persistence remains with the trigger owner. */
export function PopulationPanelContent({
  state,
  onTogglePopulation,
  disabled = false,
}: PopulationPanelContentProps) {
  const { colors } = useTheme();
  // D-23: Active Contacts is a listed row, first, selected whenever nothing
  // else is (the stored Active state stays []; "active" is panel-only).
  const rows: {
    key: PopulationPanelKey;
    testID: string;
    label: string;
    selected: boolean;
  }[] = [
    {
      key: "active",
      testID: "dashboard-population-option-active",
      label: AXIS_DEFAULT_LABELS.population,
      selected: state.populations.length === 0,
    },
    ...POPULATION_ORDER.map((key) => ({
      key,
      testID: `dashboard-population-option-${key}`,
      label: POPULATION_LABELS[key],
      selected: state.populations.includes(key),
    })),
  ];
  return (
    <View testID="dashboard-population-panel" style={styles.content}>
      {rows.map(({ key, testID, label, selected }) => (
        <Pressable
          key={key}
          testID={testID}
          accessibilityRole="button"
          accessibilityState={{ selected, disabled }}
          accessibilityLabel={label}
          disabled={disabled}
          onPress={() => onTogglePopulation(key)}
          style={[
            styles.option,
            selected
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
            style={[
              styles.label,
              { color: selected ? colors.onAccent : colors.textPrimary },
            ]}
          >
            {label}
          </Text>
          <Text
            accessibilityElementsHidden
            style={[
              styles.selection,
              { color: selected ? colors.onAccent : colors.textSecondary },
            ]}
          >
            {selected ? "Selected" : ""}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 8 },
  option: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  label: { fontSize: 16, fontWeight: "400" },
  selection: { fontSize: 14, fontWeight: "600" },
});
