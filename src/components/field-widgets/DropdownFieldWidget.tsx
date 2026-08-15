/**
 * Dropdown value widget (FLD-04). RN rewrite of the plugin `FormRenderer`
 * `dropdown` case WITHOUT a picker dependency — a `Pressable` trigger opening a
 * `Modal` + `FlatList` of options (zero new deps).
 *
 * Out-of-list preservation (CONTEXT): if the current value is NOT in `options`
 * (e.g. an options edit dropped it), it is STILL rendered as a selectable raw
 * entry so no data is lost. `CustomFieldValue` surfaces such a value as the
 * SAME tap-to-fix error state via `isValueInOptions`. Colours via `useTheme()`.
 */
import { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "@/theme";
import type { FieldWidgetProps } from "./types";

export function DropdownFieldWidget({
  value,
  onChange,
  label,
  options = [],
  testID,
}: FieldWidgetProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = value ?? "";
  // Preserve an out-of-list value by prepending it to the option set.
  const items =
    selected && !options.includes(selected) ? [selected, ...options] : options;

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text
          numberOfLines={1}
          style={{
            color: selected ? colors.textPrimary : colors.textSecondary,
          }}
        >
          {selected || "Select…"}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel={`Dismiss ${label} options`}
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(false)}
          >
            <View
              style={[
                StyleSheet.absoluteFill,
                styles.scrim,
                { backgroundColor: colors.background },
              ]}
            />
          </Pressable>

          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
              },
            ]}
          >
            <FlatList
              data={items}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isSelected = item === selected;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={item}
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                    style={[styles.option, { borderColor: colors.border }]}
                  >
                    <Text
                      style={{
                        color: isSelected ? colors.accent : colors.textPrimary,
                      }}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  scrim: {
    opacity: 0.85,
  },
  sheet: {
    borderWidth: 1,
    borderRadius: 12,
    maxHeight: "60%",
    overflow: "hidden",
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
