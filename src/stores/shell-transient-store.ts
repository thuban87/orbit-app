import { create } from "zustand";

export interface ShellTransientEntry {
  id: string;
  dismiss: () => void;
}

interface ShellTransientStore {
  entries: ShellTransientEntry[];
  openTransient: (id: string, dismiss: () => void) => void;
  closeTransient: (id: string) => void;
  dismissTop: () => boolean;
  isAnyOpen: () => boolean;
}

/**
 * Ephemeral registry for shell-owned overlays such as the universal FAB and
 * contact picker. Entries retain their own close callbacks because a component
 * whose visibility lives in local React state cannot be closed by removing an
 * identifier alone.
 */
export const shellTransientStore = create<ShellTransientStore>()((set, get) => ({
  entries: [],
  openTransient: (id, dismiss) => {
    set((state) => {
      const existingIndex = state.entries.findIndex((entry) => entry.id === id);

      // Keep the original position when an open overlay re-registers after a
      // render; its close callback changes, but its layer ordering does not.
      if (existingIndex >= 0) {
        return {
          entries: state.entries.map((entry, index) =>
            index === existingIndex ? { id, dismiss } : entry,
          ),
        };
      }

      return { entries: [...state.entries, { id, dismiss }] };
    });
  },
  closeTransient: (id) => {
    set((state) => ({
      entries: state.entries.filter((entry) => entry.id !== id),
    }));
  },
  dismissTop: () => {
    const top = get().entries.at(-1);
    if (!top) return false;

    // Remove first so a callback that also calls closeTransient is harmless.
    set((state) => ({ entries: state.entries.slice(0, -1) }));
    top.dismiss();
    return true;
  },
  isAnyOpen: () => get().entries.length > 0,
}));
