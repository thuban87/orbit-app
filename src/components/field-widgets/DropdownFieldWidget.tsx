/**
 * Dropdown value widget (FLD-04). RN rewrite of the plugin `FormRenderer`
 * `dropdown` case WITHOUT a picker dependency — a `Pressable` trigger opening a
 * `Modal` + `FlatList` of options (zero new deps).
 *
 * Out-of-list preservation (CONTEXT): if the current value is NOT in `options`
 * (e.g. an options edit dropped it), it is STILL rendered as a selectable raw
 * entry so no data is lost. `CustomFieldValue` surfaces such a value as the
 * SAME tap-to-fix error state via `isValueInOptions`. Colours via `useTheme()`.
 *
 * Accessibility (38.4 RG-030, ui-accessibility/AUD-UIA-005): the trigger names
 * the field AND exposes the current value (`selectorAccessibilityValue`); the
 * selected option carries `accessibilityState.selected` plus a filled `select`
 * glyph, so selection never depends on colour alone. The out-of-list prepend
 * lives in the shared `selectorItems` helper (behavior unchanged).
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
import { Icon } from "@/components/icons/Icon";
import {
  selectorAccessibilityValue,
  selectorItems,
} from "@/components/selector-a11y";
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
  const items = selectorItems(selected, options);

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={selectorAccessibilityValue(selected)}
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text
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
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                    style={[styles.option, { borderColor: colors.border }]}
                  >
                    <Text
                      style={[
                        styles.optionLabel,
                        {
                          color: isSelected
                            ? colors.accentText
                            : colors.textPrimary,
                        },
                      ]}
                    >
                      {item}
                    </Text>
                    {isSelected ? (
                      <Icon name="select" state="active" tone="accentText" />
                    ) : null}
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
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: {
    flex: 1,
  },
});
