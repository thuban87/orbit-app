/**
 * Boolean toggle value widget (FLD-04). RN rewrite of the plugin `FormRenderer`
 * `toggle` case, drawn with the Orbit switch (38.9 D-47). Maps on↔"1" / off↔"0" — the canonical
 * toggle storage the parser expects so `CAST(col AS INTEGER)` groups correctly
 * (§14.4). Colours resolve inside OrbitSwitch (CLAUDE.md).
 */
import { StyleSheet, View } from "react-native";
import { OrbitSwitch } from "@/components/ui";
import type { FieldWidgetProps } from "./types";

export function ToggleFieldWidget({
  value,
  onChange,
  label,
  testID,
}: FieldWidgetProps) {
  const on = value === "1";
  return (
    <View style={styles.row}>
      <OrbitSwitch
        testID={testID}
        accessibilityLabel={label}
        value={on}
        onValueChange={(next) => onChange(next ? "1" : "0")}
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
