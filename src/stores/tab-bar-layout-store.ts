import { create } from "zustand";

interface TabBarLayoutStore {
  tabBarHeight: number;
  setTabBarHeight: (height: number) => void;
}

/** Runtime-only tab-bar geometry shared by tab descendants and shell siblings. */
export const useTabBarLayoutStore = create<TabBarLayoutStore>()((set) => ({
  tabBarHeight: 0,
  setTabBarHeight: (height) => {
    set((state) =>
      state.tabBarHeight === height ? state : { tabBarHeight: height },
    );
  },
}));

export const useMeasuredTabBarHeight = (): number =>
  useTabBarLayoutStore((state) => state.tabBarHeight);

export const setTabBarHeight = (height: number): void =>
  useTabBarLayoutStore.getState().setTabBarHeight(height);
