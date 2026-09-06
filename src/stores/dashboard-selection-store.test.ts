import { beforeEach, describe, expect, it } from "vitest";
import {
  selectDashboardSelectionCount,
  useDashboardSelectionStore,
} from "@/stores/dashboard-selection-store";

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

    const state = useDashboardSelectionStore.getState();
    expect(state).toMatchObject({
      mode: true,
      frozenUniverse: [1, 2, 3],
      selectedIds: new Set([2]),
    });
    expect(selectDashboardSelectionCount(state)).toBe(1);
  });

  it("does not resnapshot or replace selection when already active", () => {
    useDashboardSelectionStore.getState().enterSelection([1, 2, 3], 2);
    useDashboardSelectionStore.getState().enterSelection([9], 9);

    expect(useDashboardSelectionStore.getState()).toMatchObject({
      mode: true,
      frozenUniverse: [1, 2, 3],
      selectedIds: new Set([2]),
    });
  });

  it("toggles in-universe contacts idempotently and fences outsiders", () => {
    useDashboardSelectionStore.getState().enterSelection([1, 2, 3]);
    useDashboardSelectionStore.getState().toggle(1);
    useDashboardSelectionStore.getState().toggle(99);

    expect(useDashboardSelectionStore.getState().selectedIds).toEqual(
      new Set([1]),
    );

    useDashboardSelectionStore.getState().toggle(1);
    expect(useDashboardSelectionStore.getState().selectedIds).toEqual(new Set());
  });

  it("selects precisely the frozen universe, including an empty universe", () => {
    useDashboardSelectionStore.getState().enterSelection([1, 2, 3]);
    useDashboardSelectionStore.getState().selectAll();
    useDashboardSelectionStore.getState().selectAll();
    expect(useDashboardSelectionStore.getState().selectedIds).toEqual(
      new Set([1, 2, 3]),
    );

    useDashboardSelectionStore.getState().exitSelection();
    useDashboardSelectionStore.getState().enterSelection([]);
    useDashboardSelectionStore.getState().selectAll();
    expect(useDashboardSelectionStore.getState().selectedIds).toEqual(new Set());
  });

  it("removes archived contacts from selection and its frozen universe", () => {
    useDashboardSelectionStore.getState().enterSelection([1, 2, 3]);
    useDashboardSelectionStore.getState().selectAll();
    useDashboardSelectionStore.getState().removeFromUniverse([2]);

    expect(useDashboardSelectionStore.getState()).toMatchObject({
      selectedIds: new Set([1, 3]),
      frozenUniverse: [1, 3],
    });
  });

  it("exits selection mode and resets all ephemeral state", () => {
    useDashboardSelectionStore.getState().enterSelection([1, 2, 3], 2);
    useDashboardSelectionStore.getState().exitSelection();

    expect(useDashboardSelectionStore.getState()).toMatchObject({
      mode: false,
      selectedIds: new Set(),
      frozenUniverse: [],
    });
    expect(selectDashboardSelectionCount(useDashboardSelectionStore.getState())).toBe(
      0,
    );
  });
});
