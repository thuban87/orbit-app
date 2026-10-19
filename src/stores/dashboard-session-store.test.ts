import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { useDashboardSessionStore } from "@/stores/dashboard-session-store";

describe("useDashboardSessionStore", () => {
  beforeEach(() => {
    useDashboardSessionStore.getState().clearSession();
  });

  it("starts with an empty search", () => {
    expect(useDashboardSessionStore.getInitialState().searchText).toBe("");
  });

  it("holds only the search term and its two actions (38.13 D-31)", () => {
    expect(Object.keys(useDashboardSessionStore.getState()).sort()).toEqual([
      "clearSession",
      "searchText",
      "setSearchText",
    ]);
  });

  it("updates the ephemeral search", () => {
    useDashboardSessionStore.getState().setSearchText("Ada");

    expect(useDashboardSessionStore.getState().searchText).toBe("Ada");
  });

  it("clears the ephemeral session back to an empty search", () => {
    useDashboardSessionStore.setState({ searchText: "Ada" });

    useDashboardSessionStore.getState().clearSession();

    expect(useDashboardSessionStore.getState().searchText).toBe("");
  });

  it("has no durable-storage adapter", () => {
    const source = readFileSync(
      new URL("./dashboard-session-store.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toMatch(
      /@react-native-async-storage\/async-storage|zustand\/middleware/,
    );
  });
});
