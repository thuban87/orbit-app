import { create } from "zustand";

interface DashboardSessionStore {
  searchText: string;
  setSearchText: (searchText: string) => void;
  clearSession: () => void;
}

/**
 * Ephemeral Contacts working state (dossier §M): the search term. This store
 * outlives the Contacts screen so Contacts → Profile → Back restores the
 * search, while nothing writes it to durable storage. HomeScreen also clears
 * it when it mounts, so a term never carries into a new mount (38.13 D-24).
 *
 * Scroll position is not kept here: the list keeps its own position while it
 * stays mounted, and Reset Dashboard View scrolls both views to the top
 * (38.13 D-31).
 *
 * A full Reset Dashboard View combines the query store's resetDashboardView()
 * (population, filter and sort axes; the view mode is kept, D-04) with
 * clearSession() here.
 */
export const useDashboardSessionStore = create<DashboardSessionStore>()(
  (set) => ({
    searchText: "",
    setSearchText: (searchText) => set({ searchText }),
    clearSession: () => set({ searchText: "" }),
  }),
);
