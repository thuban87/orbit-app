/**
 * OverflowMenu — the low-emphasis `⋯` action menu on the profile header (UI-SPEC
 * "Component Inventory → Overflow ⋯ menu"). A small `textSecondary` glyph trigger
 * (never accent — it must NOT read as a primary or destructive action) with a
 * 44px hit area opening a `Modal` action sheet.
 *
 * The sheet reuses the `DropdownFieldWidget` pattern verbatim: a `surfaceElevated`
 * sheet over a `background` scrim at 0.85 opacity — no colour literal anywhere
 * (CLAUDE.md / check:colors). Each action is a `Pressable` row.
 *
 * This phase's only action is "Archive" (reversible → deliberately NOT styled
 * destructive; purge lands on the Archived list in Plan 09, never here — the
 * two-stage guarantee keeps the irreversible action off the profile).
 */
import { useRef, useState } from "react";
import {
  AccessibilityInfo,
  findNodeHandle,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "@/theme";

/** One row in the overflow sheet. */
export interface OverflowAction {
  label: string;
  onPress: () => void;
  /** Disabled actions remain visible but cannot dismiss or invoke the menu. */
  disabled?: boolean;
  /** Overrides the accessibility label (defaults to `label`). */
  accessibilityLabel?: string;
  /** testID for the action row. */
  testID?: string;
}

export function OverflowMenu({ actions }: { actions: OverflowAction[] }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<View>(null);

  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => {
      const triggerNode = findNodeHandle(triggerRef.current);
      if (triggerNode !== null) {
        AccessibilityInfo.setAccessibilityFocus(triggerNode);
      }
    });
  };

  return (
    <>
      <Pressable
        ref={triggerRef}
        testID="overflow-menu-trigger"
        accessibilityRole="button"
        accessibilityLabel="More actions"
        hitSlop={16}
        onPress={() => setOpen(true)}
        style={styles.trigger}
      >
        <Text style={[styles.glyph, { color: colors.textSecondary }]}>⋯</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <View accessibilityViewIsModal style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Dismiss actions"
            style={StyleSheet.absoluteFill}
            onPress={close}
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
            {actions.map((action) => (
              <Pressable
                key={action.label}
                testID={action.testID ?? `overflow-action-${action.label}`}
                accessibilityRole="button"
                accessibilityLabel={action.accessibilityLabel ?? action.label}
                accessibilityState={{ disabled: action.disabled === true }}
                disabled={action.disabled}
                onPress={() => {
                  if (action.disabled) return;
                  close();
                  action.onPress();
                }}
                style={[styles.option, { borderColor: colors.border }]}
              >
                <Text
                  style={{
                    color: action.disabled
                      ? colors.textSecondary
                      : colors.textPrimary,
                  }}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {
    fontSize: 24,
    fontWeight: "700",
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
    overflow: "hidden",
  },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
