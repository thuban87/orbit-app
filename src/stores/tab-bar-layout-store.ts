import { create } from "zustand";

interface TabBarLayoutStore {
  tabBarHeight: number;
  /**
   * The tab bar's height the last time it was on screen (38.10 D-151). The
   * measured height drops to 0 while the bar hides (a focused workflow, or the
   * keyboard: BottomTabBar goes `position: absolute`), but the universal + only
   * shows with the bar, so this is where its row sits whenever it appears.
   */
  shownTabBarHeight: number;
  setTabBarHeight: (height: number) => void;
}

/** Runtime-only tab-bar geometry shared by tab descendants and shell siblings. */
export const useTabBarLayoutStore = create<TabBarLayoutStore>()((set) => ({
  tabBarHeight: 0,
  shownTabBarHeight: 0,
  setTabBarHeight: (height) => {
    set((state) => {
      const shownTabBarHeight = height > 0 ? height : state.shownTabBarHeight;
      return state.tabBarHeight === height &&
        state.shownTabBarHeight === shownTabBarHeight
        ? state
        : { tabBarHeight: height, shownTabBarHeight };
    });
  },
}));

export const useMeasuredTabBarHeight = (): number =>
  useTabBarLayoutStore((state) => state.tabBarHeight);

/** The tab bar's last on-screen height (see `shownTabBarHeight`). */
export const useShownTabBarHeight = (): number =>
  useTabBarLayoutStore((state) => state.shownTabBarHeight);

export const setTabBarHeight = (height: number): void =>
  useTabBarLayoutStore.getState().setTabBarHeight(height);
