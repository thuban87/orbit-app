import { create } from "zustand";

interface ShellOffsetStore {
  topOffset: number;
  setTopOffset: (height: number) => void;
}

/**
 * Runtime-only height of the in-flow shell content above the tab navigator
 * (the 38.6 D-38 assist banner). When it changes, every screen below moves in
 * the window without its own `onLayout` firing, so window measurements read it
 * as a re-measure trigger (review WR5-01). Never persisted.
 */
export const useShellOffsetStore = create<ShellOffsetStore>()((set) => ({
  topOffset: 0,
  setTopOffset: (height) => {
    const next = Number.isFinite(height) && height > 0 ? height : 0;
    set((state) => (state.topOffset === next ? state : { topOffset: next }));
  },
}));

export const useShellTopOffset = (): number =>
  useShellOffsetStore((state) => state.topOffset);

export const setShellTopOffset = (height: number): void =>
  useShellOffsetStore.getState().setTopOffset(height);
