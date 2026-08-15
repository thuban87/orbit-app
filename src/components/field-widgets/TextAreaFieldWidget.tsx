/**
 * Multi-line text value widget (FLD-04). RN rewrite of the plugin
 * `FormRenderer` `textarea` case — a multiline `TextInput` writing the raw
 * string. Colours resolve through `useTheme().colors.*` (CLAUDE.md).
 */
import { StyleSheet, TextInput } from "react-native";
import { useTheme } from "@/theme";
import type { FieldWidgetProps } from "./types";

export function TextAreaFieldWidget({
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
      multiline
      numberOfLines={4}
      textAlignVertical="top"
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
    minHeight: 96,
  },
});
