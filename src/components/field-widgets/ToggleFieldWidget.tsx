/**
 * Boolean toggle value widget (FLD-04). RN rewrite of the plugin `FormRenderer`
 * `toggle` case using a native `Switch`. Maps on↔"1" / off↔"0" — the canonical
 * toggle storage the parser expects so `CAST(col AS INTEGER)` groups correctly
 * (§14.4). Colours via `useTheme().colors.*` (CLAUDE.md).
 */
import { StyleSheet, Switch, View } from "react-native";
import { useTheme } from "@/theme";
import type { FieldWidgetProps } from "./types";

export function ToggleFieldWidget({
  value,
  onChange,
  label,
  testID,
}: FieldWidgetProps) {
  const { colors } = useTheme();
  const on = value === "1";
  return (
    <View style={styles.row}>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        value={on}
        onValueChange={(next) => onChange(next ? "1" : "0")}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={colors.surfaceElevated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
});
