// biome-ignore-all lint/a11y/useValidAriaRole: AppText uses semantic typography roles.
import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  findNodeHandle,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Icon } from "@/components/icons/Icon";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { GlassSurface } from "@/components/ui/GlassSurface";
import type { OrrerySystemState } from "@/stores/orrery-system-store";
import { shellTransientStore } from "@/stores/shell-transient-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import {
  buildSystemChoices,
  registerSystemSelectorTransient,
  systemSelectorLabel,
} from "./orrery-controls-logic";

export function OrrerySystemSelector({
  state,
  availableHeight,
  enabled,
}: {
  state: OrrerySystemState;
  availableHeight: number;
  enabled: boolean;
}) {
  const { colors } = useTheme();
  const focused = useIsFocused();
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(44);
  const trigger = useRef<View>(null);
  const heading = useRef<View>(null);
  const dismiss = useCallback(() => setOpen(false), []);
  const latest = useRef(dismiss);
  latest.current = dismiss;
  const busy = state.status === "initial" || state.status === "loading";
  const rows = buildSystemChoices(state.categories);
  useEffect(() => {
    if (!open) return;
    // Only one Orrery popup owns the screen; shell Back still dismisses its top entry.
    const registry = shellTransientStore.getState();
    registry.entries
      .find((entry) => entry.id === "orrery-view-options")
      ?.dismiss();
    const cleanup = registerSystemSelectorTransient(registry, latest, () => {
      const node = findNodeHandle(trigger.current);
      if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
    });
    const frame = requestAnimationFrame(() => {
      const node = findNodeHandle(heading.current);
      if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
    });
    return () => {
      cancelAnimationFrame(frame);
      cleanup();
    };
  }, [open]);
  useEffect(() => {
    if (!focused) dismiss();
  }, [focused, dismiss]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (value) => {
      if (value !== "active") dismiss();
    });
    return () => subscription.remove();
  }, [dismiss]);
  const top = SPACING.base + height + SPACING.sm;
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.root,
        { zIndex: open ? 30 : 10, elevation: open ? 30 : 10 },
      ]}
    >
      {open ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close System selector"
          onPress={dismiss}
        />
      ) : null}
      <View
        style={styles.trigger}
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
      >
        <GlassSurface density="dense">
          <Pressable
            ref={trigger}
            style={styles.triggerRow}
            disabled={!enabled}
            accessibilityRole="button"
            accessibilityLabel={systemSelectorLabel(state.requested.name)}
            accessibilityState={{ expanded: open, busy, disabled: !enabled }}
            onPress={() => setOpen((value) => !value)}
          >
            <AppText
              role="label"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={styles.name}
            >
              {state.requested.name}
            </AppText>
            <Icon name="chevron-down" size="sm" />
          </Pressable>
        </GlassSurface>
      </View>
      {open ? (
        <View style={[styles.panel, { top }]} accessibilityViewIsModal>
          <GlassSurface density="dense">
            <ScrollView
              style={{
                maxHeight: Math.max(44, availableHeight - top - SPACING.base),
              }}
              contentContainerStyle={styles.content}
            >
              <View
                ref={heading}
                collapsable={false}
                accessible
                accessibilityRole="header"
                accessibilityLabel="Choose System"
              >
                <AppText role="heading">Choose System</AppText>
              </View>
              {rows.map((row) => {
                const selected = row.id === state.requested.id;
                return (
                  <Pressable
                    key={row.id}
                    accessibilityRole="radio"
                    accessibilityLabel={row.name}
                    accessibilityState={{
                      checked: selected,
                      busy: selected && busy,
                    }}
                    style={[
                      styles.row,
                      {
                        borderWidth: 1,
                        borderColor: selected ? colors.accent : colors.border,
                      },
                    ]}
                    onPress={() => {
                      void state.select(row.ref, row.name);
                      dismiss();
                    }}
                  >
                    <AppText role="label">
                      {row.name}
                      {selected ? " — Selected" : ""}
                    </AppText>
                  </Pressable>
                );
              })}
              {busy ? (
                <AppText accessibilityLiveRegion="polite">
                  Loading contacts…
                </AppText>
              ) : null}
              {state.status === "error" || state.status === "stale" ? (
                <>
                  <AppText>
                    {state.status === "stale"
                      ? "Couldn't refresh this System. Showing the last loaded contacts."
                      : "Couldn't load this System. Try loading it again."}
                  </AppText>
                  <Button
                    role="secondary"
                    label="Reload System"
                    onPress={() => void state.reload()}
                  />
                </>
              ) : null}
              <Button
                role="secondary"
                label="Close System selector"
                onPress={dismiss}
              />
            </ScrollView>
          </GlassSurface>
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
  trigger: {
    position: "absolute",
    top: SPACING.base,
    left: SPACING.base,
    maxWidth: "44%",
  },
  triggerRow: {
    minHeight: 44,
    minWidth: 44,
    padding: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  name: { flexShrink: 1 },
  panel: {
    position: "absolute",
    left: SPACING.base,
    width: 320,
    maxWidth: "90%",
  },
  row: { minHeight: 44, minWidth: 44, padding: SPACING.md },
  content: { padding: SPACING.base, gap: SPACING.sm },
});
