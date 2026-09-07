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
  Switch,
  View,
} from "react-native";
import { AppText } from "@/components/ui/AppText";
import { Button } from "@/components/ui/Button";
import { GlassSurface } from "@/components/ui/GlassSurface";
import { ORRERY_DENSITIES } from "@/db/app-settings-dao";
import { getExecutor } from "@/db/database";
import { useOrreryPreferencesStore } from "@/stores/orrery-preferences-store";
import { shellTransientStore } from "@/stores/shell-transient-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { OrreryObstacle } from "./OrreryObstacle";

const LABELS = {
  spacious: "Spacious",
  balanced: "Balanced",
  compact: "Compact",
};
const TRANSIENT_ID = "orrery-view-options";

/** Orrery-specific top-right panel; its scroll height follows the measured canvas. */
export function OrreryViewOptions({
  availableHeight,
}: {
  availableHeight: number;
}) {
  const preferences = useOrreryPreferencesStore();
  const { colors } = useTheme();
  const focused = useIsFocused();
  const blocked = shellTransientStore((store) =>
    store.entries.some((entry) => entry.id !== TRANSIENT_ID),
  );
  const [open, setOpen] = useState(false);
  const [triggerHeight, setTriggerHeight] = useState(44);
  const trigger = useRef<View>(null);
  const heading = useRef<View>(null);
  const dismiss = useCallback(() => setOpen(false), []);
  const latestDismiss = useRef(dismiss);
  latestDismiss.current = dismiss;
  useEffect(() => {
    if (!open) return;
    shellTransientStore
      .getState()
      .entries.find((entry) => entry.id === "orrery-system-selector")
      ?.dismiss();
    shellTransientStore
      .getState()
      .openTransient(TRANSIENT_ID, () => latestDismiss.current());
    const frame = requestAnimationFrame(() => {
      const handle = findNodeHandle(heading.current);
      if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
    });
    return () => {
      cancelAnimationFrame(frame);
      shellTransientStore.getState().closeTransient(TRANSIENT_ID);
      const handle = findNodeHandle(trigger.current);
      if (handle != null) AccessibilityInfo.setAccessibilityFocus(handle);
    };
  }, [open]);
  useEffect(() => {
    if (!focused) dismiss();
  }, [focused, dismiss]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") dismiss();
    });
    return () => subscription.remove();
  }, [dismiss]);
  const busy = preferences.hydration === "loading" || preferences.saving;
  const disabled = busy || !preferences.hydrated;
  const panelTop = SPACING.base + triggerHeight + SPACING.sm;
  return (
    <View
      pointerEvents={blocked ? "none" : "box-none"}
      importantForAccessibility={blocked ? "no-hide-descendants" : "auto"}
      accessibilityElementsHidden={blocked}
      style={styles.root}
    >
      {open ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close view options"
          onPress={dismiss}
        />
      ) : null}
      <OrreryObstacle
        obstacleId="orrery-view-trigger"
        style={styles.trigger}
        onLayout={(event) => setTriggerHeight(event.nativeEvent.layout.height)}
      >
        <GlassSurface density="dense">
          <Pressable
            ref={trigger}
            onPress={() => setOpen((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel="View options"
            accessibilityState={{ expanded: open }}
            style={styles.row}
          >
            <AppText role="label">View options</AppText>
          </Pressable>
        </GlassSurface>
      </OrreryObstacle>
      {open ? (
        <OrreryObstacle
          obstacleId="orrery-view-panel"
          style={[styles.panel, { top: panelTop }]}
          accessibilityViewIsModal
        >
          <GlassSurface density="dense">
            <ScrollView
              style={{
                maxHeight: Math.max(
                  44,
                  availableHeight - panelTop - SPACING.base,
                ),
              }}
              contentContainerStyle={styles.content}
            >
              <View
                ref={heading}
                accessible
                accessibilityRole="header"
                accessibilityLabel="View options"
                collapsable={false}
              >
                <AppText role="heading">View options</AppText>
              </View>
              <AppText role="label">Density</AppText>
              {ORRERY_DENSITIES.map((density) => {
                const selected = preferences.committed.density === density;
                return (
                  <Pressable
                    key={density}
                    accessibilityRole="radio"
                    accessibilityLabel={LABELS[density]}
                    accessibilityState={{ checked: selected, disabled, busy }}
                    disabled={disabled}
                    style={[
                      styles.row,
                      {
                        borderColor: selected ? colors.accent : colors.border,
                        borderWidth: 1,
                      },
                    ]}
                    onPress={() =>
                      void preferences.save(getExecutor(), { density })
                    }
                  >
                    <AppText role="label">
                      {LABELS[density]}
                      {selected ? " — Selected" : ""}
                    </AppText>
                  </Pressable>
                );
              })}
              <AppText role="label">Relationship Satellites</AppText>
              <AppText>Show unlinked people around their contact.</AppText>
              <View style={styles.toggle}>
                <AppText>
                  {preferences.committed.satellitesEnabled ? "On" : "Off"}
                </AppText>
                <Switch
                  accessibilityLabel="Relationship Satellites"
                  accessibilityState={{ busy, disabled }}
                  disabled={disabled}
                  value={preferences.committed.satellitesEnabled === 1}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.textPrimary}
                  onValueChange={(enabled) =>
                    void preferences.save(getExecutor(), {
                      satellitesEnabled: enabled ? 1 : 0,
                    })
                  }
                />
              </View>
              {busy ? (
                <AppText accessibilityLiveRegion="polite">
                  {preferences.saving
                    ? "Saving view options…"
                    : "Loading view options…"}
                </AppText>
              ) : null}
              {preferences.hydration === "error" ? (
                <AppText accessibilityLiveRegion="polite">
                  Couldn't load your view options. Try loading them again.
                </AppText>
              ) : null}
              {preferences.saveError ? (
                <AppText accessibilityLiveRegion="polite">
                  Couldn't save your view options. Try that change again.
                </AppText>
              ) : null}
              {preferences.hydration === "error" || preferences.saveError ? (
                <View accessibilityState={{ busy }}>
                  <Button
                    role="secondary"
                    label={
                      preferences.hydration === "error"
                        ? "Reload view options"
                        : "Retry view change"
                    }
                    disabled={busy}
                    onPress={() => void preferences.retry(getExecutor())}
                  />
                </View>
              ) : null}
              <Button
                role="secondary"
                label="Close view options"
                onPress={dismiss}
              />
            </ScrollView>
          </GlassSurface>
        </OrreryObstacle>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
  },
  trigger: {
    position: "absolute",
    top: SPACING.base,
    right: SPACING.base,
    maxWidth: "44%",
  },
  panel: {
    position: "absolute",
    right: SPACING.base,
    width: 320,
    maxWidth: "90%",
  },
  content: { padding: SPACING.base, gap: SPACING.md },
  row: { minHeight: 44, minWidth: 44, padding: SPACING.md },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    gap: SPACING.sm,
  },
});
