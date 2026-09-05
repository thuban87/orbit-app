import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  DASHBOARD_SORT_MODES,
  type DashboardQueryState,
  type DashboardSortMode,
} from "@/logic/dashboard-query-logic";
import { useTheme } from "@/theme";
import { CONTROL_ACTION_LABELS, sortModeLabel } from "./control-labels";

export interface SortPanelContentProps {
  state: DashboardQueryState;
  onSelectSort: (mode: DashboardSortMode) => void;
  disabled?: boolean;
}

/** Presentation-only sort content; the trigger owner serializes persistence. */
export function SortPanelContent({ state, onSelectSort, disabled = false }: SortPanelContentProps) {
  const { colors } = useTheme();
  return (
    <View testID="dashboard-sort-panel" style={styles.content}>
      {DASHBOARD_SORT_MODES.map((mode) => {
        const selected = state.sort === mode;
        const label = sortModeLabel(mode);
        return (
          <Pressable
            key={mode}
            testID={`dashboard-sort-option-${mode}`}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={label}
            disabled={disabled}
            onPress={() => onSelectSort(mode)}
            style={[
              styles.option,
              selected
                ? { backgroundColor: colors.accent, borderColor: colors.borderStrong }
                : { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.label, { color: selected ? colors.background : colors.textPrimary }]}>{label}</Text>
            <Text accessibilityElementsHidden style={[styles.selection, { color: selected ? colors.background : colors.textSecondary }]}>
              {selected ? CONTROL_ACTION_LABELS.selected : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 8 },
  option: { minHeight: 44, borderWidth: 1, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  label: { fontSize: 16, fontWeight: "400" },
  selection: { fontSize: 14, fontWeight: "600" },
});
