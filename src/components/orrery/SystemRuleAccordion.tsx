// biome-ignore-all lint/a11y/useValidAriaRole: AppText/Button semantic roles are domain props.
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  RULE_FAMILY_OPTIONS,
  type RuleDraft,
  SYSTEM_RULE_FAMILIES,
  type SystemRuleFamily,
  summarizeFamily,
} from "@/components/orrery/system-builder-logic";
import { AppText } from "@/components/ui/AppText";
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

/** Eight closed predicate families; Birthday deliberately is not a System rule. */
export function SystemRuleAccordion({
  rules,
  categories,
  disabled = false,
  onChange,
}: SystemRuleAccordionProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState<SystemRuleFamily | null>(null);
  return (
    <View style={styles.root}>
      {SYSTEM_RULE_FAMILIES.map((family) => {
        const open = expanded === family;
        const selected = selectedValues(rules, family);
        const options =
          family === "category" ? categories : RULE_FAMILY_OPTIONS[family];
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
                {options.map((option) => {
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
});
