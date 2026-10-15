import { create } from "zustand";

/**
 * Which screens currently SHOW a section Add FAB (Phase 38.10 D-131, D-143),
 * and which focused screens CAN show one (D-151).
 *
 * - `owners`: a page registers while its section FAB is on screen (focused,
 *   its Add bar scrolled off, no form open, the keyboard down) and unregisters
 *   when it hides, blurs or unmounts. The root snackbar reads
 *   `selectSectionFabPresent` to sit full width above the FAB row (D-143).
 * - `available`: a focused page whose section FAB is mounted registers here
 *   whether or not the FAB is showing, because the scroll morph can bring it
 *   up at any moment. The root snackbar holds its position for a message's
 *   life (D-151), so it reads `selectSectionFabAvailable` to sit clear of a
 *   section FAB that may appear under it.
 *
 * Keyed by owner id so two mounted pages can never clear each other's entry.
 * Runtime-only and in-memory, like `snackbar-store.ts`.
 */
interface SectionFabStore {
  owners: ReadonlySet<string>;
  available: ReadonlySet<string>;
  register: (id: string) => void;
  unregister: (id: string) => void;
  registerAvailable: (id: string) => void;
  unregisterAvailable: (id: string) => void;
}

function withOwner(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  return set.has(id) ? set : new Set([...set, id]);
}

function withoutOwner(
  set: ReadonlySet<string>,
  id: string,
): ReadonlySet<string> {
  if (!set.has(id)) return set;
  const next = new Set(set);
  next.delete(id);
  return next;
}

export const useSectionFabStore = create<SectionFabStore>()((set) => ({
  owners: new Set<string>(),
  available: new Set<string>(),
  register: (id) => {
    set((state) => {
      const owners = withOwner(state.owners, id);
      return owners === state.owners ? state : { owners };
    });
  },
  unregister: (id) => {
    set((state) => {
      const owners = withoutOwner(state.owners, id);
      return owners === state.owners ? state : { owners };
    });
  },
  registerAvailable: (id) => {
    set((state) => {
      const available = withOwner(state.available, id);
      return available === state.available ? state : { available };
    });
  },
  unregisterAvailable: (id) => {
    set((state) => {
      const available = withoutOwner(state.available, id);
      return available === state.available ? state : { available };
    });
  },
}));

/** Whether any section FAB is on screen now. */
export function selectSectionFabPresent(state: {
  owners: ReadonlySet<string>;
}): boolean {
  return state.owners.size > 0;
}

/** Whether a focused screen has a section FAB that can appear (D-151). */
export function selectSectionFabAvailable(state: {
  available: ReadonlySet<string>;
}): boolean {
  return state.available.size > 0;
}

export const registerSectionFab = (id: string): void =>
  useSectionFabStore.getState().register(id);

export const unregisterSectionFab = (id: string): void =>
  useSectionFabStore.getState().unregister(id);

export const registerSectionFabAvailable = (id: string): void =>
  useSectionFabStore.getState().registerAvailable(id);

export const unregisterSectionFabAvailable = (id: string): void =>
  useSectionFabStore.getState().unregisterAvailable(id);
