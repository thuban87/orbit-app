import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  CONTACT_FREQUENCY_BANDS,
  DASHBOARD_FILTER_FAMILIES,
  NEEDS_ATTENTION_VALUE,
  SOCIAL_BATTERY_VALUES,
  type DashboardFilterFamily,
  type DashboardQueryState,
} from "@/logic/dashboard-query-logic";
import { GRAVITY_TIERS } from "@/services/impact";
import { useTheme } from "@/theme";
import {
  CONTROL_ACTION_LABELS,
  filterFamilyLabel,
  filterOptionLabel,
} from "./control-labels";

type Category = { id: number; name: string };

export interface FilterPanelContentProps {
  state: DashboardQueryState;
  categories: Category[];
  onToggleFilter: (family: DashboardFilterFamily, value: string) => void;
  onClearFilters: () => void;
  disabled?: boolean;
}

/** Presentation-only filter content; the trigger owner serializes persistence. */
export function FilterPanelContent({
  state,
  categories,
  onToggleFilter,
  onClearFilters,
  disabled = false,
}: FilterPanelContentProps) {
  const { colors } = useTheme();
  const optionsFor = (family: DashboardFilterFamily): { value: string; label: string }[] => {
    switch (family) {
      case "category":
        return categories.map((category) => ({ value: String(category.id), label: category.name }));
      case "social-battery":
        return SOCIAL_BATTERY_VALUES.map((value) => ({
          value,
          label: filterOptionLabel("social-battery", value) ?? value,
        }));
      case "needs-attention":
        return [{
          value: NEEDS_ATTENTION_VALUE,
          label: filterOptionLabel("needs-attention", NEEDS_ATTENTION_VALUE) ?? NEEDS_ATTENTION_VALUE,
        }];
      case "gravity":
        return GRAVITY_TIERS.map((tier) => ({
          value: tier.name,
          label: filterOptionLabel("gravity", tier.name) ?? tier.name,
        }));
      case "contact-frequency":
        return Object.keys(CONTACT_FREQUENCY_BANDS).map((value) => ({
          value,
          label: filterOptionLabel("contact-frequency", value) ?? value,
        }));
    }
  };

  return (
    <View testID="dashboard-filters-panel" style={styles.content}>
      {DASHBOARD_FILTER_FAMILIES.map((family) => (
        <View key={family} style={styles.section}>
          <Text
            testID={`dashboard-filter-family-${family}`}
            accessibilityRole="header"
            style={[styles.family, { color: colors.textPrimary }]}
          >
            {filterFamilyLabel(family)}
          </Text>
          {optionsFor(family).map(({ value, label }) => {
            const selected = (state.filters[family] ?? []).includes(value);
            return (
              <Pressable
                key={value}
                testID={`dashboard-filter-option-${family}-${value}`}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                accessibilityLabel={label}
                disabled={disabled}
                onPress={() => onToggleFilter(family, value)}
                style={[
                  styles.option,
                  selected
                    ? { backgroundColor: colors.accent, borderColor: colors.borderStrong }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.optionLabel, { color: selected ? colors.background : colors.textPrimary }]}>{label}</Text>
                <Text accessibilityElementsHidden style={[styles.selection, { color: selected ? colors.background : colors.textSecondary }]}>
                  {selected ? CONTROL_ACTION_LABELS.selected : ""}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      <Pressable
        testID="dashboard-filters-clear"
        accessibilityRole="button"
        accessibilityLabel={CONTROL_ACTION_LABELS.clearFilters}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onClearFilters}
        style={[styles.clear, { borderColor: colors.borderStrong }]}
      >
        <Text style={[styles.clearLabel, { color: colors.accent }]}>{CONTROL_ACTION_LABELS.clearFilters}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  section: { gap: 8 },
  family: { fontSize: 14, fontWeight: "600" },
  option: { minHeight: 44, borderWidth: 1, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  optionLabel: { fontSize: 16, fontWeight: "400" },
  selection: { fontSize: 14, fontWeight: "600" },
  clear: { minHeight: 44, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  clearLabel: { fontSize: 16, fontWeight: "600" },
});
