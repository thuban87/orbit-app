import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getExecutor } from "@/db/database";
import type { DashboardPopulation } from "@/logic/dashboard-query-logic";
import { useDashboardQueryStore } from "@/stores/dashboard-query-store";
import { useTheme } from "@/theme";
import { collapseSummary } from "./control-summary";
import { AXIS_DEFAULT_LABELS, POPULATION_LABELS } from "./control-labels";
import { dashboardPanelStore } from "./DashboardOverlayHost";
import { PopulationPanelContent } from "./PopulationPanelContent";

const PANEL_ID = "dashboard-population";

export function DashboardControlRow({ onPanelOpenChange }: { onPanelOpenChange?: (open: boolean) => void }) {
  const { colors } = useTheme();
  const populations = useDashboardQueryStore((state) => state.populations);
  const panelIsOpen = dashboardPanelStore((state) => state.request?.id === PANEL_ID);
  const triggerRef = useRef<View>(null);
  const [pending, setPending] = useState(false);
  const [writeError, setWriteError] = useState(false);

  const dismiss = useCallback(() => {
    dashboardPanelStore.getState().close();
    onPanelOpenChange?.(false);
  }, [onPanelOpenChange]);

  const togglePopulation = useCallback(async (key: DashboardPopulation) => {
    if (pending) return;
    setPending(true);
    setWriteError(false);
    const current = useDashboardQueryStore.getState().populations;
    const next = current.includes(key) ? current.filter((value) => value !== key) : [...current, key];
    try {
      await useDashboardQueryStore.getState().setPopulations(getExecutor(), next);
    } catch {
      setWriteError(true);
    } finally {
      setPending(false);
    }
  }, [pending]);

  const open = useCallback(() => {
    if (dashboardPanelStore.getState().request?.id === PANEL_ID) {
      dismiss();
      return;
    }
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      dashboardPanelStore.getState().open({
        id: PANEL_ID,
        anchorRect: { x, y, width, height },
        size: "medium",
        content: <PopulationPanelContent state={useDashboardQueryStore.getState()} onTogglePopulation={togglePopulation} disabled={pending} />,
        onDismiss: dismiss,
      });
      onPanelOpenChange?.(true);
    });
  }, [dismiss, onPanelOpenChange, pending, togglePopulation]);

  // The host owns the presentation node, so refresh the pure content props as
  // store state changes without coupling the content component to persistence.
  useEffect(() => {
    const request = dashboardPanelStore.getState().request;
    if (request?.id !== PANEL_ID) return;
    dashboardPanelStore.getState().open({
      ...request,
      content: <PopulationPanelContent state={useDashboardQueryStore.getState()} onTogglePopulation={togglePopulation} disabled={pending} />,
    });
  }, [pending, populations, togglePopulation]);

  const labels = populations.map((population) => POPULATION_LABELS[population]);
  const summary = collapseSummary(labels, 2) || AXIS_DEFAULT_LABELS.population;
  const active = populations.length > 0;

  return (
    <View style={styles.wrapper}>
      <Pressable
        ref={triggerRef}
        testID="dashboard-population-control"
        accessibilityRole="button"
        accessibilityState={{ expanded: panelIsOpen, selected: active }}
        accessibilityLabel={`Population, ${summary}`}
        onPress={open}
        style={[styles.trigger, active ? { borderColor: colors.accent } : { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <Text style={[styles.label, { color: active ? colors.accent : colors.textPrimary }]}>Population</Text>
        <Text numberOfLines={1} style={[styles.summary, { color: active ? colors.accent : colors.textSecondary }]}>{summary}</Text>
      </Pressable>
      {writeError ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.danger }]}>Couldn&apos;t save population.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { zIndex: 20, elevation: 20 },
  trigger: { minHeight: 52, borderWidth: 1, borderRadius: 10, justifyContent: "center", paddingHorizontal: 12 },
  label: { fontSize: 14, fontWeight: "600" },
  summary: { fontSize: 14, fontWeight: "400" },
  error: { fontSize: 14, marginTop: 4 },
});
