/**
 * CustomFieldValue — read-time display of one custom field's value on a profile
 * (FLD-07), with the tap-to-fix error state.
 *
 * FLAGGED CONDITION (HANDOFF §14.4):
 *   !parsers[field.type](value).ok
 *   || (field.type === "dropdown" && !isValueInOptions(field, value))
 *
 * The second clause is what makes the out-of-list dropdown error REACHABLE:
 * `parsers.dropdown` is identity, so a value excluded by a later options edit
 * would otherwise stop being visibly wrong. Both a type-change-unconvertible
 * value AND an out-of-list dropdown value render the SAME tap-to-fix affordance
 * (CONTEXT consistency), whose press calls `onFix` — the host wires that to open
 * the field's `FieldValueInput` widget.
 *
 * A clean value renders through a type-appropriate presentation (toggle→On/Off,
 * date/number→canonical form, others→raw). No value is ever coerced or cleared
 * here — this is display only (T-03-04). There is NO dedicated `error` theme
 * token this phase, so error emphasis is composed from existing tokens
 * (`accent` text on a `borderStrong` outline); the owner may add an `error`
 * token at the --to 3 gate. Every colour resolves through `useTheme()`.
 */
import { Pressable, StyleSheet, Text, View } from "react-native";
import { isValueInOptions, parsers } from "@/db/field-parsers";
import type { CustomFieldDef } from "@/db/field-types";
import type { FieldType } from "@/schemas/types";
import { useTheme } from "@/theme";

/** The minimal DEFS shape read at display time. */
type FieldSpec = Pick<CustomFieldDef, "type" | "label" | "options">;

export interface CustomFieldValueProps {
  field: FieldSpec;
  value: string | null;
  /** Opens the field's widget so the user can correct a flagged value. */
  onFix: () => void;
  testID?: string;
}

/** Presents a CLEAN (canonical) value for display. Absent → an em dash. */
function presentValue(type: FieldType, canonical: string | null): string {
  if (canonical == null || canonical === "") return "—";
  if (type === "toggle") return canonical === "1" ? "On" : "Off";
  return canonical;
}

export function CustomFieldValue({
  field,
  value,
  onFix,
  testID,
}: CustomFieldValueProps) {
  const { colors } = useTheme();

  const parsed = parsers[field.type](value);
  const flagged =
    !parsed.ok ||
    (field.type === "dropdown" && !isValueInOptions(field, value));

  if (flagged) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${field.label}: unrecognized value ${value ?? ""} — tap to fix`}
        onPress={onFix}
        style={[
          styles.errorRow,
          { backgroundColor: colors.surface, borderColor: colors.borderStrong },
        ]}
      >
        <View style={styles.errorBody}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {field.label}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.rawValue, { color: colors.textPrimary }]}
          >
            {value ?? ""}
          </Text>
        </View>
        <Text style={[styles.fixAffordance, { color: colors.accent }]}>
          Tap to fix
        </Text>
      </Pressable>
    );
  }

  const display = presentValue(field.type, parsed.ok ? parsed.value : value);
  return (
    <View testID={testID} style={styles.row}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {field.label}
      </Text>
      <Text style={[styles.value, { color: colors.textPrimary }]}>
        {display}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 2,
    paddingVertical: 6,
  },
  label: {
    fontSize: 13,
  },
  value: {
    fontSize: 15,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorBody: {
    flex: 1,
    gap: 2,
  },
  rawValue: {
    fontSize: 15,
  },
  fixAffordance: {
    fontSize: 13,
    fontWeight: "600",
  },
});
