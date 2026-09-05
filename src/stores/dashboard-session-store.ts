import { create } from "zustand";

interface DashboardSessionStore {
  searchText: string;
  scrollOffset: number;
  setSearchText: (searchText: string) => void;
  setScrollOffset: (scrollOffset: number) => void;
  clearSession: () => void;
}

/**
 * Ephemeral Dashboard working state (dossier §M). This store outlives the
 * Dashboard screen so Dashboard → Profile → Back restores search and scroll,
 * while a fresh app process starts from the defaults because nothing writes
 * these values to durable storage.
 *
 * A full Reset Dashboard View combines the query store's resetDashboardView()
 * (population, filter, sort, and view axes) with clearSession() here. Phase 26
 * wires those two transitions through the Control Surface reset action.
 */
export const useDashboardSessionStore = create<DashboardSessionStore>()((set) => ({
  searchText: "",
  scrollOffset: 0,
  setSearchText: (searchText) => set({ searchText }),
  setScrollOffset: (scrollOffset) => set({ scrollOffset }),
  clearSession: () => set({ searchText: "", scrollOffset: 0 }),
}));
