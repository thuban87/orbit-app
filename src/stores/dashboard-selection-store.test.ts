import { beforeEach, describe, expect, it } from "vitest";
import {
  selectDashboardSelectionCount,
  useDashboardSelectionStore,
} from "@/stores/dashboard-selection-store";

describe("useDashboardSelectionStore", () => {
  beforeEach(() => {
    useDashboardSelectionStore.setState({
      mode: false,
      sessionId: 0,
      selectedIds: new Set(),
      frozenUniverse: [],
    });
  });

  it("snapshots the universe and seeds selection when entering selection mode", () => {
    useDashboardSelectionStore.getState().enterSelection([1, 2, 3], 2);

    const state = useDashboardSelectionStore.getState();
    expect(state).toMatchObject({
      mode: true,
      sessionId: 1,
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
      sessionId: 1,
      frozenUniverse: [1, 2, 3],
      selectedIds: new Set([2]),
    });
  });

  it("deduplicates the frozen universe and rejects an out-of-universe seed", () => {
    useDashboardSelectionStore.getState().enterSelection([1, 2, 2, 3], 99);

    expect(useDashboardSelectionStore.getState()).toMatchObject({
      frozenUniverse: [1, 2, 3],
      selectedIds: new Set(),
    });

    useDashboardSelectionStore.getState().exitSelection();
    useDashboardSelectionStore.getState().enterSelection([1, 2, 2, 3], 2);
    expect(useDashboardSelectionStore.getState().selectedIds).toEqual(
      new Set([2]),
    );
  });

  it("toggles in-universe contacts idempotently and fences outsiders", () => {
    useDashboardSelectionStore.getState().enterSelection([1, 2, 3]);
    useDashboardSelectionStore.getState().toggle(1);
    useDashboardSelectionStore.getState().toggle(99);

    expect(useDashboardSelectionStore.getState().selectedIds).toEqual(
      new Set([1]),
    );

    useDashboardSelectionStore.getState().toggle(1);
    expect(useDashboardSelectionStore.getState().selectedIds).toEqual(
      new Set(),
    );
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
    expect(useDashboardSelectionStore.getState().selectedIds).toEqual(
      new Set(),
    );
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
    expect(
      selectDashboardSelectionCount(useDashboardSelectionStore.getState()),
    ).toBe(0);
  });

  // 38.13 D-40: the bar's Select All becomes Deselect all.
  it("deselectAll empties the selection and keeps mode, sessionId and the frozen universe", () => {
    useDashboardSelectionStore.getState().enterSelection([1, 2, 3]);
    useDashboardSelectionStore.getState().selectAll();
    const before = useDashboardSelectionStore.getState();
    useDashboardSelectionStore.getState().deselectAll();

    expect(useDashboardSelectionStore.getState()).toMatchObject({
      mode: true,
      sessionId: before.sessionId,
      frozenUniverse: [1, 2, 3],
      selectedIds: new Set(),
    });
  });

  // Review R5-03: Select All, then Move to Bin of everyone.
  it("removing the whole universe after Select All leaves universe and selection empty with mode on", () => {
    useDashboardSelectionStore.getState().enterSelection([1, 2, 3]);
    useDashboardSelectionStore.getState().selectAll();
    useDashboardSelectionStore.getState().removeFromUniverse([1, 2, 3]);

    expect(useDashboardSelectionStore.getState()).toMatchObject({
      mode: true,
      frozenUniverse: [],
      selectedIds: new Set(),
    });
  });
});
