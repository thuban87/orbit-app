import { beforeEach, describe, expect, it } from "vitest";
import { useDashboardSelectionStore } from "@/stores/dashboard-selection-store";

describe("useDashboardSelectionStore", () => {
  beforeEach(() => {
    useDashboardSelectionStore.setState({
      mode: false,
      selectedIds: new Set(),
      frozenUniverse: [],
    });
  });

  it("snapshots the universe and seeds selection when entering selection mode", () => {
    useDashboardSelectionStore.getState().enterSelection([1, 2, 3], 2);

    expect(useDashboardSelectionStore.getState()).toMatchObject({
      mode: true,
      frozenUniverse: [1, 2, 3],
      selectedIds: new Set([2]),
    });
  });
});
