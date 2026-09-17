// biome-ignore-all lint/a11y/useValidAriaRole: AppText/Button semantic roles are domain props.
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import {
  RULE_FAMILY_OPTIONS,
  type RuleDraft,
  SYSTEM_RULE_FAMILIES,
  type SystemRuleFamily,
  summarizeFamily,
} from "@/components/orrery/system-builder-logic";
import { AppText } from "@/components/ui/AppText";
import { CATEGORY_SEARCH_THRESHOLD } from "@/logic/category-logic";
import { useTheme } from "@/theme";
import { RADII } from "@/theme/tokens/radii";
import { SPACING } from "@/theme/tokens/spacing";

export interface RuleOption {
  value: string;
  label: string;
}

export interface SystemRuleAccordionProps {
  rules: RuleDraft;
  categories: readonly RuleOption[];
  disabled?: boolean;
  onChange: (next: RuleDraft) => void;
}

const BOOLEAN_FAMILIES = new Set<SystemRuleFamily>([
  "favorite",
  "needs-attention",
  "not-contacted",
  "snoozed",
]);

function selectedValues(rules: RuleDraft, family: SystemRuleFamily): string[] {
  const value = rules[family];
  return Array.isArray(value) ? value : value ? ["on"] : [];
}

export function buildCategoryRuleView(
  categories: readonly RuleOption[],
  selected: readonly string[],
  query: string,
) {
  const available = new Set(categories.map((category) => category.value));
  const selectedValues = selected.filter((value) => available.has(value));
  const key = query.trim().normalize("NFC").toLowerCase();
  const visibleOptions = key
    ? categories.filter((category) =>
        category.label.normalize("NFC").toLowerCase().includes(key),
      )
    : [...categories];
  return {
    searchable: categories.length > CATEGORY_SEARCH_THRESHOLD,
    selectedValues,
    selectedCount: selectedValues.length,
    visibleOptions,
    emptyCopy: categories.length === 0 ? "No categories available" : null,
    noMatchesCopy:
      categories.length > 0 && visibleOptions.length === 0
        ? `No categories match “${query.trim()}”.`
        : null,
  };
}

/** Eight closed predicate families; Birthday deliberately is not a System rule. */
export function SystemRuleAccordion({
  rules,
  categories,
  disabled = false,
  onChange,
}: SystemRuleAccordionProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState<SystemRuleFamily | null>(null);
  const [categoryQuery, setCategoryQuery] = useState("");
  return (
    <View style={styles.root}>
      {SYSTEM_RULE_FAMILIES.map((family) => {
        const open = expanded === family;
        const rawSelected = selectedValues(rules, family);
        const options =
          family === "category" ? categories : RULE_FAMILY_OPTIONS[family];
        const categoryView =
          family === "category"
            ? buildCategoryRuleView(categories, rawSelected, categoryQuery)
            : null;
        const selected = categoryView?.selectedValues ?? rawSelected;
        const visibleOptions = categoryView?.visibleOptions ?? options;
        const labels = Object.fromEntries(
          options.map((option) => [option.value, option.label]),
        );
        return (
          <View
            key={family}
            style={[styles.family, { borderColor: colors.border }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={summarizeFamily(family, selected, labels)}
              accessibilityState={{
                expanded: open,
                selected: selected.length > 0,
                disabled,
              }}
              disabled={disabled}
              onPress={() =>
                setExpanded((current) => (current === family ? null : family))
              }
              style={styles.header}
            >
              <View style={styles.headerCopy}>
                <AppText role="label">
                  {summarizeFamily(family, selected, labels)}
                </AppText>
                <AppText role="caption" style={{ color: colors.textSecondary }}>
                  {selected.length ? `${selected.length} selected` : "Any"}
                </AppText>
              </View>
              <AppText
                role="label"
                style={{
                  color: selected.length ? colors.accent : colors.textSecondary,
                }}
              >
                {open ? "−" : "+"}
              </AppText>
            </Pressable>
            {open && !disabled ? (
              <View style={styles.options}>
                {categoryView?.searchable ? (
                  <TextInput
                    accessibilityLabel="Search categories"
                    placeholder="Search categories"
                    placeholderTextColor={colors.textSecondary}
                    value={categoryQuery}
                    onChangeText={setCategoryQuery}
                    style={[
                      styles.search,
                      {
                        color: colors.textPrimary,
                        borderColor: colors.border,
                        backgroundColor: colors.surface,
                      },
                    ]}
                  />
                ) : null}
                {categoryView?.emptyCopy ? (
                  <AppText
                    role="caption"
                    style={{ color: colors.textSecondary }}
                  >
                    {categoryView.emptyCopy}
                  </AppText>
                ) : null}
                {categoryView?.noMatchesCopy ? (
                  <AppText
                    role="caption"
                    accessibilityLiveRegion="polite"
                    style={{ color: colors.textSecondary }}
                  >
                    {categoryView.noMatchesCopy}
                  </AppText>
                ) : null}
                {visibleOptions.map((option) => {
                  const selectedOption = selected.includes(option.value);
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="checkbox"
                      accessibilityLabel={option.label}
                      accessibilityState={{ checked: selectedOption }}
                      onPress={() => {
                        if (BOOLEAN_FAMILIES.has(family)) {
                          onChange({ ...rules, [family]: !selectedOption });
                          return;
                        }
                        const next = selectedOption
                          ? selected.filter((value) => value !== option.value)
                          : [...selected, option.value];
                        onChange({ ...rules, [family]: next });
                      }}
                      style={styles.option}
                    >
                      <AppText
                        role="body"
                        style={{
                          color: selectedOption
                            ? colors.accent
                            : colors.textPrimary,
                        }}
                      >
                        {option.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: SPACING.sm },
  family: { borderWidth: 1, borderRadius: RADII.md, overflow: "hidden" },
  header: {
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  headerCopy: { flex: 1, gap: SPACING.xs },
  options: { padding: SPACING.md, paddingTop: 0, gap: SPACING.xs },
  option: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: SPACING.sm,
  },
  search: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
});
