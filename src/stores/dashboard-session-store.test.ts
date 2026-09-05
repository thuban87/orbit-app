import { beforeEach, describe, expect, it } from "vitest";
import { useDashboardSessionStore } from "@/stores/dashboard-session-store";

describe("useDashboardSessionStore", () => {
  beforeEach(() => {
    useDashboardSessionStore.getState().clearSession();
  });

  it("starts with an empty search and zero scroll offset", () => {
    expect(useDashboardSessionStore.getInitialState()).toMatchObject({
      searchText: "",
      scrollOffset: 0,
    });
  });

  it("updates the ephemeral search and scroll state", () => {
    useDashboardSessionStore.getState().setSearchText("Ada");
    useDashboardSessionStore.getState().setScrollOffset(240);

    expect(useDashboardSessionStore.getState()).toMatchObject({
      searchText: "Ada",
      scrollOffset: 240,
    });
  });

  it("clears the ephemeral session back to defaults", () => {
    useDashboardSessionStore.setState({
      searchText: "Ada",
      scrollOffset: 240,
    });

    useDashboardSessionStore.getState().clearSession();

    expect(useDashboardSessionStore.getState()).toMatchObject({
      searchText: "",
      scrollOffset: 0,
    });
  });
});
