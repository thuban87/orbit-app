import { create } from "zustand";

interface FocusedRouteStore {
  routeName: string | undefined;
  setRouteName: (routeName: string | undefined) => void;
}

/** Runtime-only deepest navigator route shared with the shell background host. */
export const useFocusedRouteStore = create<FocusedRouteStore>()((set) => ({
  routeName: undefined,
  setRouteName: (routeName) => {
    set((state) => (state.routeName === routeName ? state : { routeName }));
  },
}));

export const setFocusedRouteName = (routeName: string | undefined): void =>
  useFocusedRouteStore.getState().setRouteName(routeName);
