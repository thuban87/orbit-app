import { create } from "zustand";
import { getAppSettings, updateAppSettings } from "@/db/app-settings-dao";
import { localDateTime } from "@/db/database";
import type { SqlExecutor } from "@/db/types";
import {
  type DashboardFilters,
  type DashboardPopulation,
  type DashboardQueryState,
  type DashboardSortMode,
  type DashboardViewMode,
  parseDashboardFilters,
  parseDashboardPopulations,
  resetDashboardView,
} from "@/logic/dashboard-query-logic";

interface DashboardQueryStore extends DashboardQueryState {
  /** Hydration is complete, including a deliberately discarded stale snapshot. */
  hydrated: boolean;
  hydrate: (exec: SqlExecutor) => Promise<void>;
  setViewMode: (
    exec: SqlExecutor,
    viewMode: DashboardViewMode,
  ) => Promise<void>;
  setPopulations: (
    exec: SqlExecutor,
    populations: DashboardPopulation[],
  ) => Promise<void>;
  setFilters: (exec: SqlExecutor, filters: DashboardFilters) => Promise<void>;
  setSort: (exec: SqlExecutor, sort: DashboardSortMode) => Promise<void>;
  resetDashboardView: (exec: SqlExecutor) => Promise<void>;
  /** Internal write/hydration ordering guard; not a presentation setting. */
  generation: number;
}

function parseStoredState(settings: {
  dashboardViewMode: DashboardViewMode;
  dashboardPopulations: string;
  dashboardFilters: string;
  dashboardSort: DashboardSortMode;
}): DashboardQueryState {
  let populations: DashboardPopulation[] = [];
  let filters: DashboardFilters = {};
  try {
    populations =
      parseDashboardPopulations(JSON.parse(settings.dashboardPopulations)) ??
      [];
    filters =
      parseDashboardFilters(JSON.parse(settings.dashboardFilters)) ?? {};
  } catch {
    console.warn(
      "Dashboard preferences were malformed; using empty query axes.",
    );
  }
  return {
    viewMode: settings.dashboardViewMode,
    populations,
    filters,
    sort: settings.dashboardSort,
  };
}

export const useDashboardQueryStore = create<DashboardQueryStore>()(
  (set, get) => ({
    viewMode: "list",
    populations: [],
    filters: {},
    sort: "default",
    hydrated: false,
    generation: 0,
    hydrate: async (exec) => {
      const generation = get().generation;
      const stored = parseStoredState(await getAppSettings(exec));
      set((state) =>
        state.generation === generation
          ? { ...stored, hydrated: true }
          : { hydrated: true },
      );
    },
    setViewMode: async (exec, viewMode) => {
      // Idempotency guard (cross-AI review CYCLE-4 #3): re-selecting the already
      // active view must not persist, set(), or bump the generation — so a no-op
      // toggle never thrashes SQLite or triggers a Dashboard reload.
      if (viewMode === get().viewMode) return;
      await updateAppSettings(
        exec,
        { dashboardViewMode: viewMode },
        localDateTime(),
      );
      set((state) => ({ viewMode, generation: state.generation + 1 }));
    },
    setPopulations: async (exec, populations) => {
      await updateAppSettings(
        exec,
        { dashboardPopulations: JSON.stringify(populations) },
        localDateTime(),
      );
      set((state) => ({ populations, generation: state.generation + 1 }));
    },
    setFilters: async (exec, filters) => {
      await updateAppSettings(
        exec,
        { dashboardFilters: JSON.stringify(filters) },
        localDateTime(),
      );
      set((state) => ({ filters, generation: state.generation + 1 }));
    },
    setSort: async (exec, sort) => {
      await updateAppSettings(exec, { dashboardSort: sort }, localDateTime());
      set((state) => ({ sort, generation: state.generation + 1 }));
    },
    resetDashboardView: async (exec) => {
      const next = resetDashboardView(get());
      await updateAppSettings(
        exec,
        {
          dashboardPopulations: JSON.stringify(next.populations),
          dashboardFilters: JSON.stringify(next.filters),
          dashboardSort: next.sort,
        },
        localDateTime(),
      );
      set((state) => ({ ...next, generation: state.generation + 1 }));
    },
  }),
);
