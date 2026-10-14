import { create } from "zustand";

/**
 * Which screens currently SHOW a section Add FAB (Phase 38.10 D-131, D-132).
 *
 * A page registers while its section FAB is on screen (focused, its Add bar
 * scrolled off, no form open, the keyboard down) and unregisters when it hides,
 * blurs or unmounts. The root snackbar reads `selectSectionFabPresent` for its
 * narrower centred width when the section FAB is also present (D-132, plan 23).
 * Keyed by owner id so two mounted pages can never clear each other's entry.
 *
 * Runtime-only and in-memory, like `snackbar-store.ts`.
 */
interface SectionFabStore {
  owners: ReadonlySet<string>;
  register: (id: string) => void;
  unregister: (id: string) => void;
}

export const useSectionFabStore = create<SectionFabStore>()((set) => ({
  owners: new Set<string>(),
  register: (id) => {
    set((state) =>
      state.owners.has(id) ? state : { owners: new Set([...state.owners, id]) },
    );
  },
  unregister: (id) => {
    set((state) => {
      if (!state.owners.has(id)) return state;
      const owners = new Set(state.owners);
      owners.delete(id);
      return { owners };
    });
  },
}));

/** Whether any section FAB is on screen now. */
export function selectSectionFabPresent(state: {
  owners: ReadonlySet<string>;
}): boolean {
  return state.owners.size > 0;
}

export const registerSectionFab = (id: string): void =>
  useSectionFabStore.getState().register(id);

export const unregisterSectionFab = (id: string): void =>
  useSectionFabStore.getState().unregister(id);
