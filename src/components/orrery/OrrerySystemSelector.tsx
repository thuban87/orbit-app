// biome-ignore-all lint/a11y/useValidAriaRole: AppText uses semantic typography roles.
import { useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
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
import type { SystemCatalogEntry } from "@/db/systems-catalog-read";
import type { RootStackParamList } from "@/navigation/types";
import type { OrrerySystemState } from "@/stores/orrery-system-store";
import { shellTransientStore } from "@/stores/shell-transient-store";
import { useTheme } from "@/theme";
import { SPACING } from "@/theme/tokens/spacing";
import { OrreryObstacle } from "./OrreryObstacle";
import {
  buildSystemChoices,
  registerSystemSelectorTransient,
  systemSelectorLabel,
} from "./orrery-controls-logic";

export function OrrerySystemSelector({
  state,
  availableHeight,
  enabled,
  catalog,
  counts,
  broken,
  onOpenChange,
}: {
  state: OrrerySystemState;
  availableHeight: number;
  enabled: boolean;
  catalog: readonly SystemCatalogEntry[];
  counts: ReadonlyMap<string, number>;
  broken: ReadonlyMap<string, boolean>;
  onOpenChange: (open: boolean, requestId: number) => void;
}) {
  const { colors } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const focused = useIsFocused();
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(44);
  const trigger = useRef<View>(null);
  const heading = useRef<View>(null);
  const requestId = useRef(0);
  const openRef = useRef(false);
  const setSelectorOpen = useCallback(
    (next: boolean) => {
      if (openRef.current === next) return;
      openRef.current = next;
      setOpen(next);
      onOpenChange(next, ++requestId.current);
    },
    [onOpenChange],
  );
  const dismiss = useCallback(() => setSelectorOpen(false), [setSelectorOpen]);
  const latest = useRef(dismiss);
  latest.current = dismiss;
  const busy = state.status === "initial" || state.status === "loading";
  const blocked = shellTransientStore((store) =>
    store.entries.some((entry) => entry.id !== "orrery-system-selector"),
  );
  const rows = buildSystemChoices(catalog, counts, broken);
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
      pointerEvents={blocked ? "none" : "box-none"}
      importantForAccessibility={blocked ? "no-hide-descendants" : "auto"}
      accessibilityElementsHidden={blocked}
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
      <OrreryObstacle
        obstacleId="orrery-system-trigger"
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
            onPress={() => setSelectorOpen(!open)}
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
      </OrreryObstacle>
      {open ? (
        <OrreryObstacle
          obstacleId="orrery-system-panel"
          style={[styles.panel, { top }]}
          accessibilityViewIsModal
        >
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
                const stateLabel =
                  row.severity === "empty"
                    ? ", empty"
                    : row.severity === "broken"
                      ? ", needs attention"
                      : "";
                const indicator =
                  row.severity === "empty"
                    ? {
                        name: "system-empty" as const,
                        tone: "statusWobble" as const,
                      }
                    : row.severity === "broken"
                      ? {
                          name: "system-broken" as const,
                          tone: "danger" as const,
                        }
                      : row.overrides
                        ? {
                            name: "system-overrides" as const,
                            tone: "textSecondary" as const,
                          }
                        : null;
                return (
                  <Pressable
                    key={row.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`${row.name}${stateLabel}`}
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
                      void state.select(row.ref, row.name, true);
                      dismiss();
                    }}
                  >
                    <View style={styles.rowContent}>
                      <View style={styles.rowText}>
                        <AppText
                          role="label"
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={styles.rowName}
                        >
                          {`${row.name} — ${row.count ?? "…"}${selected ? " — Selected" : ""}`}
                        </AppText>
                        {row.severity !== "none" ? (
                          <AppText
                            role="caption"
                            style={{
                              color:
                                row.severity === "broken"
                                  ? colors.danger
                                  : colors.statusWobble,
                            }}
                          >
                            {row.severity === "broken"
                              ? "Needs attention"
                              : "Empty"}
                          </AppText>
                        ) : null}
                      </View>
                      {indicator ? (
                        <Icon
                          name={indicator.name}
                          size="sm"
                          tone={indicator.tone}
                        />
                      ) : null}
                    </View>
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Manage Systems"
                style={[styles.manageRow, { borderColor: colors.border }]}
                onPress={() => {
                  dismiss();
                  navigation.navigate("SystemsManagement");
                }}
              >
                <AppText role="label">Manage Systems</AppText>
                <Icon name="settings" size="sm" tone="textSecondary" />
              </Pressable>
              <Button
                role="secondary"
                label="Close System selector"
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
  rowContent: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  rowText: { flex: 1, flexShrink: 1 },
  rowName: { flexShrink: 1 },
  manageRow: {
    minHeight: 44,
    padding: SPACING.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  content: { padding: SPACING.base, gap: SPACING.sm },
});
