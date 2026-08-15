/**
 * Numeric value widget (FLD-04). RN rewrite of the plugin `FormRenderer`
 * `number` case. Uses `keyboardType="numeric"` but writes the RAW string —
 * the number parser canonicalises to `String(n)` on read/sort (§14.4). Never
 * coerces on keystroke (T-03-04: no data loss). Colours via `useTheme()`.
 */
import { StyleSheet, TextInput } from "react-native";
import { useTheme } from "@/theme";
import type { FieldWidgetProps } from "./types";

export function NumberFieldWidget({
  value,
  onChange,
  label,
  testID,
}: FieldWidgetProps) {
  const { colors } = useTheme();
  return (
    <TextInput
      testID={testID}
      accessibilityLabel={label}
      value={value ?? ""}
      onChangeText={onChange}
      keyboardType="numeric"
      placeholderTextColor={colors.textSecondary}
      style={[
        styles.input,
        {
          color: colors.textPrimary,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
});
