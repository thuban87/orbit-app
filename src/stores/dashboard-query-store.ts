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
    hydrate: async (exec) => set(parseStoredState(await getAppSettings(exec))),
    setViewMode: async (exec, viewMode) => {
      await updateAppSettings(
        exec,
        { dashboardViewMode: viewMode },
        localDateTime(),
      );
      set({ viewMode });
    },
    setPopulations: async (exec, populations) => {
      await updateAppSettings(
        exec,
        { dashboardPopulations: JSON.stringify(populations) },
        localDateTime(),
      );
      set({ populations });
    },
    setFilters: async (exec, filters) => {
      await updateAppSettings(
        exec,
        { dashboardFilters: JSON.stringify(filters) },
        localDateTime(),
      );
      set({ filters });
    },
    setSort: async (exec, sort) => {
      await updateAppSettings(exec, { dashboardSort: sort }, localDateTime());
      set({ sort });
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
      set(next);
    },
  }),
);
