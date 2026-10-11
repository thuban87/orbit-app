import { create } from "zustand";

/**
 * Open-overlay registry (38.9 D-24).
 *
 * Every open overlay WINDOW reports itself here while it is visible: BaseOverlay
 * sheets and dialogs, the imperative DialogHost dialog, and every raw RN
 * `Modal` (all of them go through `RegisteredModal`). Entries are kept in open
 * order, so the last entry is the topmost window.
 *
 * Consumers:
 *   - the Snackbar hosts, so a snackbar renders inside the topmost overlay
 *     window instead of under it (D-40, D-51);
 *   - Phase 39 D-58/D-97, which reads "a dialog or sheet is open" from
 *     `selectAnyOverlayOpen`.
 *
 * Deliberately SEPARATE from `shellTransientStore`, and deliberately holds NO
 * close/dismiss callbacks: the shell dismiss stack (`dismissTop()`, run on
 * header Back, system Back and tab retap) must never be able to close an
 * overlay through this registry, above all a non-dismissable destructive
 * confirm (D-24, ADR-086). An overlay closes only through its own
 * `onRequestClose` / buttons.
 */
export type OverlayKind = "sheet" | "dialog" | "modal";

export interface OverlayEntry {
  id: string;
  kind: OverlayKind;
}

interface OverlayRegistryState {
  entries: OverlayEntry[];
  register: (id: string, kind: OverlayKind) => void;
  unregister: (id: string) => void;
}

export const overlayRegistryStore = create<OverlayRegistryState>()((set) => ({
  entries: [],
  register: (id, kind) => {
    set((state) => {
      const existingIndex = state.entries.findIndex((entry) => entry.id === id);
      // Re-registering an open overlay keeps its layer position.
      if (existingIndex >= 0) {
        return {
          entries: state.entries.map((entry, index) =>
            index === existingIndex ? { id, kind } : entry,
          ),
        };
      }
      return { entries: [...state.entries, { id, kind }] };
    });
  },
  unregister: (id) => {
    set((state) => {
      if (!state.entries.some((entry) => entry.id === id)) return state;
      return { entries: state.entries.filter((entry) => entry.id !== id) };
    });
  },
}));

export const registerOverlay = (id: string, kind: OverlayKind) =>
  overlayRegistryStore.getState().register(id, kind);

export const unregisterOverlay = (id: string) =>
  overlayRegistryStore.getState().unregister(id);

/** True while any overlay window is open (the Phase 39 D-58/D-97 signal). */
export const selectAnyOverlayOpen = (state: { entries: OverlayEntry[] }) =>
  state.entries.length > 0;

/** The topmost open overlay window's id, or null when none is open. */
export const selectTopOverlayId = (state: {
  entries: OverlayEntry[];
}): string | null => state.entries.at(-1)?.id ?? null;
