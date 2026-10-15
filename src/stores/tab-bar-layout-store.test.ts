import { beforeEach, describe, expect, it } from "vitest";
import { setTabBarHeight, useTabBarLayoutStore } from "./tab-bar-layout-store";

describe("tab-bar-layout-store shown height (38.10 D-151)", () => {
  beforeEach(() => {
    useTabBarLayoutStore.setState({ tabBarHeight: 0, shownTabBarHeight: 0 });
  });

  it("tracks the measured height and its last on-screen value", () => {
    setTabBarHeight(80);
    expect(useTabBarLayoutStore.getState()).toMatchObject({
      tabBarHeight: 80,
      shownTabBarHeight: 80,
    });
  });

  it("keeps the last on-screen height while the bar hides (measured 0)", () => {
    setTabBarHeight(80);
    setTabBarHeight(0);
    expect(useTabBarLayoutStore.getState()).toMatchObject({
      tabBarHeight: 0,
      shownTabBarHeight: 80,
    });
    setTabBarHeight(96);
    expect(useTabBarLayoutStore.getState().shownTabBarHeight).toBe(96);
  });

  it("an unchanged measure keeps the same state", () => {
    setTabBarHeight(80);
    const before = useTabBarLayoutStore.getState();
    setTabBarHeight(80);
    expect(useTabBarLayoutStore.getState()).toBe(before);
  });
});
