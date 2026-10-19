import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { listCategories } from "@/db/contact-read";
import { getExecutor } from "@/db/database";
import {
  nextPopulations,
  type PopulationPanelKey,
  samePopulations,
} from "@/logic/dashboard-population-toggle";
import type {
  DashboardFilterFamily,
  DashboardSortMode,
} from "@/logic/dashboard-query-logic";
import {
  type DashboardQueryAxis,
  useDashboardQueryStore,
} from "@/stores/dashboard-query-store";
import { useShellRefresh } from "@/stores/shell-refresh-store";
import { useTheme } from "@/theme";
import { controlTriggerBacking } from "@/theme/art-treatments";
import { useArtTreatment } from "@/theme/use-art-treatment";
import {
  AXIS_DEFAULT_LABELS,
  CONTROL_AXIS_LABELS,
  defaultSortLabel,
  POPULATION_LABELS,
  sortModeLabel,
} from "./control-labels";
import { collapseSummary } from "./control-summary";
import { dashboardPanelStore } from "./dashboard-panel-store";
import { FilterPanelContent } from "./FilterPanelContent";
import { selectedFilterLabels } from "./filter-summary";
import { PopulationPanelContent } from "./PopulationPanelContent";
import { openIfStillFocused } from "./panel-open-guard";
import { SortPanelContent } from "./SortPanelContent";
import { controlTriggerLook } from "./trigger-look";

/**
 * D-27 pending state (look is this plan's choice): a write still pending after
 * this many ms shows a small spinner inside its trigger. Taps are never dropped
 * meanwhile; the store already shows the new choice.
 */
const PENDING_INDICATOR_DELAY_MS = 250;

const PANEL_ID = "dashboard-population";
const FILTER_PANEL_ID = "dashboard-filters";
const SORT_PANEL_ID = "dashboard-sort";

/** True once `axis` has had a write pending for PENDING_INDICATOR_DELAY_MS. */
function useSlowPending(axis: DashboardQueryAxis): boolean {
  const pending = useDashboardQueryStore(
    (state) => state.pendingAxes[axis] > 0,
  );
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), PENDING_INDICATOR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [pending]);
  return slow;
}

export function DashboardControlRow() {
  const { colors } = useTheme();
  // 38.5-01 gap H-3, ruled by the owner as D-46: an ACTIVE trigger reads its
  // backing from the art treatment table (production: the solid fill, like an
  // inactive one) and shows its state through the accent border and text. An
  // inactive trigger keeps its fixed solid fill (D-04); the menus are never
  // table-driven. The colours live in ONE place, `controlTriggerLook`, which
  // also records the owner's inverted alternative.
  const activeTriggerBacking =
    useArtTreatment("contactsTopButtons")?.activeTriggerBacking ?? null;
  const triggerLook = (isActive: boolean) =>
    controlTriggerLook(
      isActive,
      controlTriggerBacking(isActive, activeTriggerBacking) === "full",
      colors,
    );
  const populations = useDashboardQueryStore((state) => state.populations);
  const filters = useDashboardQueryStore((state) => state.filters);
  const sort = useDashboardQueryStore((state) => state.sort);
  const [shellRevision, setShellRevision] = useState(0);
  useShellRefresh(() => setShellRevision((revision) => revision + 1));
  const activePanelId = dashboardPanelStore((state) => state.request?.id);
  const panelIsOpen = activePanelId === PANEL_ID;
  // D-50: read at measure-callback time, so a blur between the tap and the
  // callback stops the panel opening on a hidden Contacts screen. It asks the
  // navigator directly (38.13 review A-IN-03): a render-time ref could still
  // read true if the callback lands after the blur but before the re-render.
  const navigation = useNavigation();
  const stillFocused = useCallback(() => navigation.isFocused(), [navigation]);
  const triggerRef = useRef<View>(null);
  const filtersTriggerRef = useRef<View>(null);
  const sortTriggerRef = useRef<View>(null);
  const populationsSlow = useSlowPending("populations");
  const filtersSlow = useSlowPending("filters");
  const sortSlow = useSlowPending("sort");
  const [writeError, setWriteError] = useState(false);
  const [filterWriteError, setFilterWriteError] = useState(false);
  const [sortWriteError, setSortWriteError] = useState(false);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>(
    [],
  );

  useFocusEffect(
    useCallback(() => {
      void shellRevision;
      let cancelled = false;
      const loadCategories = async () => {
        try {
          const next = await listCategories(getExecutor());
          if (!cancelled) {
            setCategories(next);
            const current = useDashboardQueryStore.getState().filters;
            const selected = current.category ?? [];
            const validIds = new Set(
              next.map((category) => String(category.id)),
            );
            const reconciled = selected.filter(
              (token) => token === "uncategorized" || validIds.has(token),
            );
            if (reconciled.length !== selected.length) {
              const filters = { ...current };
              if (reconciled.length) filters.category = reconciled;
              else delete filters.category;
              await useDashboardQueryStore
                .getState()
                .setFilters(getExecutor(), filters);
            }
          }
        } catch {
          if (!cancelled) setCategories([]);
        }
      };
      void loadCategories();
      return () => {
        cancelled = true;
      };
    }, [shellRevision]),
  );

  // Owner dismissal: the trigger re-tap toggle and the request's onDismiss both
  // route here. Home derives its inertness from the panel store (RG-020), so
  // closing is all that is needed; closing an already-closed store is a no-op.
  const dismiss = useCallback(() => {
    dashboardPanelStore.getState().close();
  }, []);

  const togglePopulation = useCallback(async (key: PopulationPanelKey) => {
    // D-23/D-58: the pure toggle owns exclusivity; "active" stores [].
    // D-27: computed from the store's current (optimistic) state, so a quick
    // second tap builds on the first; the store queues both writes in order.
    const current = useDashboardQueryStore.getState().populations;
    const next = nextPopulations(current, key);
    // Review R1-16: re-tapping the selected row writes and reloads nothing.
    if (samePopulations(next, current)) return;
    setWriteError(false);
    try {
      await useDashboardQueryStore
        .getState()
        .setPopulations(getExecutor(), next);
    } catch {
      setWriteError(true);
    }
  }, []);

  const toggleFilter = useCallback(
    async (family: DashboardFilterFamily, value: string) => {
      setFilterWriteError(false);
      const current = useDashboardQueryStore.getState().filters;
      const values = current[family] ?? [];
      const nextValues = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];
      const next = { ...current };
      if (nextValues.length > 0) next[family] = nextValues;
      else delete next[family];
      try {
        await useDashboardQueryStore.getState().setFilters(getExecutor(), next);
      } catch {
        setFilterWriteError(true);
      }
    },
    [],
  );

  const clearFilters = useCallback(async () => {
    setFilterWriteError(false);
    try {
      await useDashboardQueryStore.getState().setFilters(getExecutor(), {});
    } catch {
      setFilterWriteError(true);
    }
  }, []);

  const selectSort = useCallback(async (mode: DashboardSortMode) => {
    setSortWriteError(false);
    try {
      await useDashboardQueryStore.getState().setSort(getExecutor(), mode);
    } catch {
      setSortWriteError(true);
    }
  }, []);

  const open = useCallback(() => {
    if (dashboardPanelStore.getState().request?.id === PANEL_ID) {
      dismiss();
      return;
    }
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      openIfStillFocused(stillFocused, () =>
        dashboardPanelStore.getState().open({
          id: PANEL_ID,
          anchorRect: { x, y, width, height },
          size: "medium",
          content: (
            <PopulationPanelContent
              state={useDashboardQueryStore.getState()}
              onTogglePopulation={togglePopulation}
            />
          ),
          onDismiss: dismiss,
        }),
      );
    });
  }, [dismiss, stillFocused, togglePopulation]);

  const openFilters = useCallback(() => {
    if (dashboardPanelStore.getState().request?.id === FILTER_PANEL_ID) {
      dismiss();
      return;
    }
    filtersTriggerRef.current?.measureInWindow((x, y, width, height) => {
      openIfStillFocused(stillFocused, () =>
        dashboardPanelStore.getState().open({
          id: FILTER_PANEL_ID,
          anchorRect: { x, y, width, height },
          size: "large",
          content: (
            <FilterPanelContent
              state={useDashboardQueryStore.getState()}
              categories={categories}
              onToggleFilter={toggleFilter}
              onClearFilters={clearFilters}
            />
          ),
          onDismiss: dismiss,
        }),
      );
    });
  }, [categories, clearFilters, dismiss, stillFocused, toggleFilter]);

  const openSort = useCallback(() => {
    if (dashboardPanelStore.getState().request?.id === SORT_PANEL_ID) {
      dismiss();
      return;
    }
    sortTriggerRef.current?.measureInWindow((x, y, width, height) => {
      openIfStillFocused(stillFocused, () =>
        dashboardPanelStore.getState().open({
          id: SORT_PANEL_ID,
          anchorRect: { x, y, width, height },
          size: "compact",
          content: (
            <SortPanelContent
              state={useDashboardQueryStore.getState()}
              onSelectSort={selectSort}
            />
          ),
          onDismiss: dismiss,
        }),
      );
    });
  }, [dismiss, selectSort, stillFocused]);

  // The host owns the presentation node, so refresh the pure content props as
  // store state changes without coupling the content component to persistence.
  useEffect(() => {
    void populations;
    const request = dashboardPanelStore.getState().request;
    if (request?.id !== PANEL_ID) return;
    dashboardPanelStore.getState().open({
      ...request,
      content: (
        <PopulationPanelContent
          state={useDashboardQueryStore.getState()}
          onTogglePopulation={togglePopulation}
        />
      ),
    });
  }, [populations, togglePopulation]);

  useEffect(() => {
    void filters;
    const request = dashboardPanelStore.getState().request;
    if (request?.id !== FILTER_PANEL_ID) return;
    dashboardPanelStore.getState().open({
      ...request,
      content: (
        <FilterPanelContent
          state={useDashboardQueryStore.getState()}
          categories={categories}
          onToggleFilter={toggleFilter}
          onClearFilters={clearFilters}
        />
      ),
    });
  }, [categories, clearFilters, filters, toggleFilter]);

  useEffect(() => {
    void sort;
    const request = dashboardPanelStore.getState().request;
    if (request?.id !== SORT_PANEL_ID) return;
    dashboardPanelStore.getState().open({
      ...request,
      content: (
        <SortPanelContent
          state={useDashboardQueryStore.getState()}
          onSelectSort={selectSort}
        />
      ),
    });
  }, [selectSort, sort]);

  const labels = populations.map((population) => POPULATION_LABELS[population]);
  const summary = collapseSummary(labels, 2) || AXIS_DEFAULT_LABELS.population;
  const active = populations.length > 0;
  const filterLabel = CONTROL_AXIS_LABELS.filters;
  const filterSummary =
    collapseSummary(selectedFilterLabels(filters, categories), 2) ||
    AXIS_DEFAULT_LABELS.filters;
  const filtersActive = Object.values(filters).some((values) => values?.length);
  const sortLabel = CONTROL_AXIS_LABELS.sort;
  const sortSummary =
    sort === "default" ? defaultSortLabel(populations) : sortModeLabel(sort);
  const sortActive = sort !== "default";
  const populationLook = triggerLook(active);
  const filtersLook = triggerLook(filtersActive);
  const sortLook = triggerLook(sortActive);

  return (
    <View style={styles.wrapper}>
      <View style={styles.row}>
        <Pressable
          ref={triggerRef}
          testID="dashboard-population-control"
          accessibilityRole="button"
          accessibilityState={{
            expanded: panelIsOpen,
            selected: active,
            busy: populationsSlow,
          }}
          accessibilityLabel={`Population, ${summary}`}
          onPress={open}
          style={[
            styles.trigger,
            {
              borderColor: populationLook.border,
              backgroundColor: populationLook.fill ?? undefined,
            },
          ]}
        >
          <Text style={[styles.label, { color: populationLook.label }]}>
            Population
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.summary, { color: populationLook.summary }]}
          >
            {summary}
          </Text>
          {populationsSlow ? (
            <PendingSpinner color={colors.accentText} />
          ) : null}
        </Pressable>
        <Pressable
          ref={filtersTriggerRef}
          testID="dashboard-filters-control"
          accessibilityRole="button"
          accessibilityState={{
            expanded: activePanelId === FILTER_PANEL_ID,
            selected: filtersActive,
            busy: filtersSlow,
          }}
          accessibilityLabel={`${filterLabel}, ${filterSummary}`}
          onPress={openFilters}
          style={[
            styles.trigger,
            {
              borderColor: filtersLook.border,
              backgroundColor: filtersLook.fill ?? undefined,
            },
          ]}
        >
          <Text style={[styles.label, { color: filtersLook.label }]}>
            {filterLabel}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.summary, { color: filtersLook.summary }]}
          >
            {filterSummary}
          </Text>
          {filtersSlow ? <PendingSpinner color={colors.accentText} /> : null}
        </Pressable>
        <Pressable
          ref={sortTriggerRef}
          testID="dashboard-sort-control"
          accessibilityRole="button"
          accessibilityState={{
            expanded: activePanelId === SORT_PANEL_ID,
            selected: sortActive,
            busy: sortSlow,
          }}
          accessibilityLabel={`${sortLabel}, ${sortSummary}`}
          onPress={openSort}
          style={[
            styles.trigger,
            {
              borderColor: sortLook.border,
              backgroundColor: sortLook.fill ?? undefined,
            },
          ]}
        >
          <Text style={[styles.label, { color: sortLook.label }]}>
            {sortLabel}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.summary, { color: sortLook.summary }]}
          >
            {sortSummary}
          </Text>
          {sortSlow ? <PendingSpinner color={colors.accentText} /> : null}
        </Pressable>
      </View>
      {writeError ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.error, { color: colors.danger }]}
        >
          Couldn&apos;t save population.
        </Text>
      ) : null}
      {filterWriteError ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.error, { color: colors.danger }]}
        >
          Couldn&apos;t save filters.
        </Text>
      ) : null}
      {sortWriteError ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.error, { color: colors.danger }]}
        >
          Couldn&apos;t save sort.
        </Text>
      ) : null}
    </View>
  );
}

/** Absolutely positioned inside its trigger: no element joins the row's flow. */
function PendingSpinner({ color }: { color: string }) {
  return (
    <ActivityIndicator
      size="small"
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.pending}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: { zIndex: 20, elevation: 20 },
  row: { flexDirection: "row", gap: 8 },
  trigger: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  label: { fontSize: 14, fontWeight: "600" },
  summary: { fontSize: 14, fontWeight: "400" },
  error: { fontSize: 14, marginTop: 4 },
  pending: { position: "absolute", top: 6, right: 6 },
});
