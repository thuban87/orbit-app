import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DashboardFilter, DashboardSort } from "@/db/dashboard-read";

/**
 * Persisted dashboard preferences store (DASH-02/07).
 *
 * Holds ONLY the last-used `sort` + `filter` — a device-local UI preference, NOT
 * contact data. It is therefore AsyncStorage, not a SQLite row and not a migration
 * (08-RESEARCH Architectural Responsibility Map; threat T-08-11: only the enum
 * values persist, no contact content, no network).
 *
 * Copies the shipped `theme-store` Zustand `persist` shape verbatim
 * (createJSONStorage(AsyncStorage) + version + partialize + warn-on-rehydrate).
 * Defaults mirror the dashboard-read defaults: sort="status", filter="all".
 */
interface DashboardPrefsStore {
  sort: DashboardSort;
  filter: DashboardFilter;
  setSort: (sort: DashboardSort) => void;
  setFilter: (filter: DashboardFilter) => void;
}

export const useDashboardPrefs = create<DashboardPrefsStore>()(
  persist(
    (set) => ({
      sort: "status",
      filter: "all",
      setSort: (sort) => set({ sort }),
      setFilter: (filter) => set({ filter }),
    }),
    {
      name: "orbit-dashboard-prefs",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // Persist only the last-used selection — nothing derived, nothing sensitive.
      partialize: (state) => ({
        sort: state.sort,
        filter: state.filter,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.warn("[dashboard-prefs] Rehydration error:", error);
        }
      },
    },
  ),
);
