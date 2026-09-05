import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { listCategories } from "@/db/contact-read";
import { getExecutor } from "@/db/database";
import type { DashboardFilterFamily, DashboardPopulation } from "@/logic/dashboard-query-logic";
import { useDashboardQueryStore } from "@/stores/dashboard-query-store";
import { useTheme } from "@/theme";
import { collapseSummary } from "./control-summary";
import { AXIS_DEFAULT_LABELS, POPULATION_LABELS } from "./control-labels";
import { dashboardPanelStore } from "./DashboardOverlayHost";
import { FilterPanelContent } from "./FilterPanelContent";
import { selectedFilterLabels } from "./filter-summary";
import { PopulationPanelContent } from "./PopulationPanelContent";

const PANEL_ID = "dashboard-population";
const FILTER_PANEL_ID = "dashboard-filters";

export function DashboardControlRow({ onPanelOpenChange }: { onPanelOpenChange?: (open: boolean) => void }) {
  const { colors } = useTheme();
  const populations = useDashboardQueryStore((state) => state.populations);
  const filters = useDashboardQueryStore((state) => state.filters);
  const panelIsOpen = dashboardPanelStore((state) => state.request?.id === PANEL_ID);
  const triggerRef = useRef<View>(null);
  const filtersTriggerRef = useRef<View>(null);
  const [pending, setPending] = useState(false);
  const [filtersPending, setFiltersPending] = useState(false);
  const [writeError, setWriteError] = useState(false);
  const [filterWriteError, setFilterWriteError] = useState(false);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    const loadCategories = async () => {
      try {
        const next = await listCategories(getExecutor());
        if (!cancelled) setCategories(next);
      } catch {
        if (!cancelled) setCategories([]);
      }
    };
    void loadCategories();
    return () => { cancelled = true; };
  }, []));

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

  const toggleFilter = useCallback(async (family: DashboardFilterFamily, value: string) => {
    if (filtersPending) return;
    setFiltersPending(true);
    setFilterWriteError(false);
    const current = useDashboardQueryStore.getState().filters;
    const values = current[family] ?? [];
    const nextValues = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
    const next = { ...current };
    if (nextValues.length > 0) next[family] = nextValues;
    else delete next[family];
    try {
      await useDashboardQueryStore.getState().setFilters(getExecutor(), next);
    } catch {
      setFilterWriteError(true);
    } finally {
      setFiltersPending(false);
    }
  }, [filtersPending]);

  const clearFilters = useCallback(async () => {
    if (filtersPending) return;
    setFiltersPending(true);
    setFilterWriteError(false);
    try {
      await useDashboardQueryStore.getState().setFilters(getExecutor(), {});
    } catch {
      setFilterWriteError(true);
    } finally {
      setFiltersPending(false);
    }
  }, [filtersPending]);

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

  const openFilters = useCallback(() => {
    if (dashboardPanelStore.getState().request?.id === FILTER_PANEL_ID) {
      dismiss();
      return;
    }
    filtersTriggerRef.current?.measureInWindow((x, y, width, height) => {
      dashboardPanelStore.getState().open({
        id: FILTER_PANEL_ID,
        anchorRect: { x, y, width, height },
        size: "large",
        content: <FilterPanelContent state={useDashboardQueryStore.getState()} categories={categories} onToggleFilter={toggleFilter} onClearFilters={clearFilters} disabled={filtersPending} />,
        onDismiss: dismiss,
      });
      onPanelOpenChange?.(true);
    });
  }, [categories, clearFilters, dismiss, filtersPending, onPanelOpenChange, toggleFilter]);

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

  useEffect(() => {
    const request = dashboardPanelStore.getState().request;
    if (request?.id !== FILTER_PANEL_ID) return;
    dashboardPanelStore.getState().open({
      ...request,
      content: <FilterPanelContent state={useDashboardQueryStore.getState()} categories={categories} onToggleFilter={toggleFilter} onClearFilters={clearFilters} disabled={filtersPending} />,
    });
  }, [categories, clearFilters, filters, filtersPending, toggleFilter]);

  const labels = populations.map((population) => POPULATION_LABELS[population]);
  const summary = collapseSummary(labels, 2) || AXIS_DEFAULT_LABELS.population;
  const active = populations.length > 0;
  const filterLabel = AXIS_DEFAULT_LABELS.filters;
  const filterSummary = collapseSummary(selectedFilterLabels(filters, categories), 2) || AXIS_DEFAULT_LABELS.filters;
  const filtersActive = Object.values(filters).some((values) => values?.length);

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
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
        <Pressable
          ref={filtersTriggerRef}
          testID="dashboard-filters-control"
          accessibilityRole="button"
          accessibilityState={{ expanded: dashboardPanelStore.getState().request?.id === FILTER_PANEL_ID, selected: filtersActive }}
          accessibilityLabel={`${filterLabel}, ${filterSummary}`}
          onPress={openFilters}
          style={[styles.trigger, filtersActive ? { borderColor: colors.accent } : { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Text style={[styles.label, { color: filtersActive ? colors.accent : colors.textPrimary }]}>{filterLabel}</Text>
          <Text numberOfLines={1} style={[styles.summary, { color: filtersActive ? colors.accent : colors.textSecondary }]}>{filterSummary}</Text>
        </Pressable>
      </View>
      {writeError ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.danger }]}>Couldn&apos;t save population.</Text> : null}
      {filterWriteError ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.danger }]}>Couldn&apos;t save filters.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { zIndex: 20, elevation: 20 },
  row: { flexDirection: "row", gap: 8 },
  trigger: { flex: 1, minHeight: 52, borderWidth: 1, borderRadius: 10, justifyContent: "center", paddingHorizontal: 12 },
  label: { fontSize: 14, fontWeight: "600" },
  summary: { fontSize: 14, fontWeight: "400" },
  error: { fontSize: 14, marginTop: 4 },
});
