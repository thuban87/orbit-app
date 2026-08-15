/**
 * Date value widget (FLD-04). RN rewrite of the plugin `FormRenderer` `date`
 * case. v1 is a `YYYY-MM-DD`-constrained `TextInput` with ZERO dependencies —
 * the native calendar picker (`@react-native-community/datetimepicker`) is
 * deferred; Phase 4 may add it when it embeds the contact form. The date parser
 * canonicalises the stored TEXT to `YYYY-MM-DD` on read. Colours via `useTheme()`.
 */
import { StyleSheet, TextInput } from "react-native";
import { useTheme } from "@/theme";
import type { FieldWidgetProps } from "./types";

export function DateFieldWidget({
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
      placeholder="YYYY-MM-DD"
      autoCapitalize="none"
      autoCorrect={false}
      maxLength={10}
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
