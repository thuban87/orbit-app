import { create } from "zustand";

export interface DashboardSelectionStore {
  mode: boolean;
  selectedIds: Set<number>;
  frozenUniverse: number[];
  enterSelection: (universe: number[], seedId?: number) => void;
  toggle: (id: number) => void;
  selectAll: () => void;
  removeFromUniverse: (ids: number[]) => void;
  exitSelection: () => void;
}

/** Returns the active selection count without exposing Set implementation details. */
export function selectDashboardSelectionCount(
  state: Pick<DashboardSelectionStore, "selectedIds">,
): number {
  return state.selectedIds.size;
}

/**
 * Ephemeral Dashboard multi-select state. The result universe is intentionally
 * frozen at entry so later query refreshes cannot alter which contacts may be
 * selected during an active bulk-management operation.
 */
export const useDashboardSelectionStore = create<DashboardSelectionStore>()(
  (set) => ({
    mode: false,
    selectedIds: new Set(),
    frozenUniverse: [],
    enterSelection: (universe, seedId) => {
      set((state) => {
        if (state.mode) return state;

        return {
          mode: true,
          frozenUniverse: [...universe],
          selectedIds: seedId == null ? new Set() : new Set([seedId]),
        };
      });
    },
    toggle: (id) => {
      set((state) => {
        if (!state.frozenUniverse.includes(id)) return state;

        const selectedIds = new Set(state.selectedIds);
        if (selectedIds.has(id)) {
          selectedIds.delete(id);
        } else {
          selectedIds.add(id);
        }
        return { selectedIds };
      });
    },
    selectAll: () => set((state) => ({ selectedIds: new Set(state.frozenUniverse) })),
    removeFromUniverse: (ids) => {
      const idsToRemove = new Set(ids);
      set((state) => ({
        frozenUniverse: state.frozenUniverse.filter((id) => !idsToRemove.has(id)),
        selectedIds: new Set(
          [...state.selectedIds].filter((id) => !idsToRemove.has(id)),
        ),
      }));
    },
    exitSelection: () =>
      set({ mode: false, selectedIds: new Set(), frozenUniverse: [] }),
  }),
);
