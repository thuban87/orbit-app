import { describe, expect, it } from "vitest";
import {
  bulkWriteIds,
  lifecycleFromRows,
  lifecycleMapFrom,
  type SelectionLifecycleMap,
  SELECTION_INCLUDES_UNBOUND,
  selectAllLabelFor,
  selectionApplicability,
  selectionUniverseIds,
  shouldApplyLifecycleRefresh,
  withFavouriteOverlay,
} from "@/logic/dashboard-selection-applicability";
import { useDashboardSelectionStore } from "@/stores/dashboard-selection-store";

const BOUND = { bound: true, favourite: false };
const BOUND_FAV = { bound: true, favourite: true };
const UNBOUND = { bound: false, favourite: false };

function map(
  entries: Record<number, { bound: boolean; favourite: boolean }>,
): SelectionLifecycleMap {
  return new Map(
    Object.entries(entries).map(([id, value]) => [Number(id), value]),
  );
}

describe("SELECTION_INCLUDES_UNBOUND (38.13 D-77, owner 2026-10-19)", () => {
  it("is true: Unbound people shown on screen can join a selection", () => {
    expect(SELECTION_INCLUDES_UNBOUND).toBe(true);
  });
});

describe("selectionUniverseIds (D-77; ADR-102 frozen universe)", () => {
  const rows = [
    { id: 1, trackingEnabled: 1 },
    { id: 2, trackingEnabled: 0 },
    { id: 3, trackingEnabled: 1 },
  ];
  it("includes every row id when Unbound people are included", () => {
    expect(selectionUniverseIds(rows, true)).toEqual([1, 2, 3]);
  });
  it("omits Unbound ids when they are not", () => {
    expect(selectionUniverseIds(rows, false)).toEqual([1, 3]);
  });
});

describe("selectionApplicability (D-40, D-74, D-75, D-77)", () => {
  it("disables every action when nothing is selected", () => {
    const result = selectionApplicability(new Set(), 3, map({ 1: BOUND }));
    expect(result).toMatchObject({
      canQuickLog: false,
      canSnooze: false,
      canAddFavorites: false,
      showRemoveFavorites: false,
      canLogInteraction: false,
      canSetCategory: false,
      canChangeFrequency: false,
      canMoveToBin: false,
      canOpenMore: false,
      selectAllLabel: "Select All",
    });
  });

  it("enables the unrestricted actions whenever anything is selected, Unbound included (D-77)", () => {
    const result = selectionApplicability(new Set([2]), 3, map({ 2: UNBOUND }));
    expect(result).toMatchObject({
      canQuickLog: true,
      canLogInteraction: true,
      canSetCategory: true,
      canChangeFrequency: true,
      canMoveToBin: true,
      canOpenMore: true,
    });
  });

  it("an all-Unbound selection disables Favorite and Snooze and hides Remove from Favorites (R1-03)", () => {
    const result = selectionApplicability(
      new Set([2, 4]),
      4,
      map({ 2: UNBOUND, 4: { bound: false, favourite: true } }),
    );
    expect(result.canAddFavorites).toBe(false);
    expect(result.canSnooze).toBe(false);
    expect(result.showRemoveFavorites).toBe(false);
  });

  it("favourites + Unbound: Favorite disabled, Remove from Favorites shown, Snooze enabled", () => {
    const result = selectionApplicability(
      new Set([1, 2]),
      3,
      map({ 1: BOUND_FAV, 2: UNBOUND }),
    );
    expect(result.canAddFavorites).toBe(false);
    expect(result.showRemoveFavorites).toBe(true);
    expect(result.canSnooze).toBe(true);
  });

  it("a Bound non-favourite + Unbound: Favorite enabled (Favorite never flips, D-74)", () => {
    const result = selectionApplicability(
      new Set([1, 2]),
      3,
      map({ 1: BOUND, 2: UNBOUND }),
    );
    expect(result.canAddFavorites).toBe(true);
    expect(result.showRemoveFavorites).toBe(false);
  });

  it("an id absent from the lifecycle map is unknown and never counts as Bound (R1-04)", () => {
    const result = selectionApplicability(new Set([9]), 3, new Map());
    expect(result.canAddFavorites).toBe(false);
    expect(result.canSnooze).toBe(false);
    expect(result.showRemoveFavorites).toBe(false);
    expect(result.canQuickLog).toBe(true);
  });

  it("reads Deselect all only when the whole non-empty universe is selected (D-40; R5-03)", () => {
    const lifecycle = map({ 1: BOUND, 2: BOUND });
    expect(
      selectionApplicability(new Set([1, 2]), 2, lifecycle).selectAllLabel,
    ).toBe("Deselect all");
    expect(
      selectionApplicability(new Set([1]), 2, lifecycle).selectAllLabel,
    ).toBe("Select All");
    // A partial universe with nothing selected.
    expect(selectionApplicability(new Set(), 2, lifecycle).selectAllLabel).toBe(
      "Select All",
    );
  });

  it("an empty universe with nothing selected reads Select All and disables every action (R5-03)", () => {
    const result = selectionApplicability(new Set(), 0, new Map());
    expect(result.selectAllLabel).toBe("Select All");
    expect(result.canToggleSelectAll).toBe(false);
    expect(
      [
        result.canQuickLog,
        result.canSnooze,
        result.canAddFavorites,
        result.showRemoveFavorites,
        result.canLogInteraction,
        result.canSetCategory,
        result.canChangeFrequency,
        result.canMoveToBin,
        result.canOpenMore,
      ].every((value) => value === false),
    ).toBe(true);
  });

  it("Select All then Move to Bin of everyone leaves an empty universe that reads Select All (store + R5-03)", () => {
    const store = useDashboardSelectionStore;
    store.setState({
      mode: false,
      sessionId: 0,
      selectedIds: new Set(),
      frozenUniverse: [],
    });
    store.getState().enterSelection([1, 2, 3]);
    store.getState().selectAll();
    store.getState().removeFromUniverse([1, 2, 3]);
    const state = store.getState();
    expect(state.mode).toBe(true);
    const result = selectionApplicability(
      state.selectedIds,
      state.frozenUniverse.length,
      new Map(),
    );
    expect(result.selectAllLabel).toBe("Select All");
    expect(result.canQuickLog).toBe(false);
    expect(result.canMoveToBin).toBe(false);
  });

  it("selectAllLabelFor is the one label rule", () => {
    expect(selectAllLabelFor(0, 0)).toBe("Select All");
    expect(selectAllLabelFor(2, 2)).toBe("Deselect all");
    expect(selectAllLabelFor(1, 2)).toBe("Select All");
  });
});

describe("bulkWriteIds (D-77, D-74, D-75; ADR-233; R1-04)", () => {
  const lifecycle = map({
    1: BOUND,
    2: UNBOUND,
    3: BOUND_FAV,
    4: { bound: false, favourite: true },
  });
  const ids = [1, 2, 3, 4, 9];

  it("add-favorites writes only Bound people who are not yet favourites", () => {
    expect(bulkWriteIds("add-favorites", ids, lifecycle)).toEqual([1]);
  });
  it("remove-favorites writes only Bound favourites", () => {
    expect(bulkWriteIds("remove-favorites", ids, lifecycle)).toEqual([3]);
  });
  it("snooze writes only Bound people", () => {
    expect(bulkWriteIds("snooze", ids, lifecycle)).toEqual([1, 3]);
  });
  it("an id absent from the map is never written by a restricted action", () => {
    expect(bulkWriteIds("snooze", [9], lifecycle)).toEqual([]);
    expect(bulkWriteIds("add-favorites", [9], lifecycle)).toEqual([]);
  });
  it.each([
    "quick-log",
    "log-interaction",
    "set-category",
    "frequency",
    "archive",
  ] as const)("%s returns the ids unchanged", (action) => {
    expect(bulkWriteIds(action, ids, lifecycle)).toEqual(ids);
  });

  it("an Unbound person whose row has left the results is still skipped: the action-time read decides, not the rows", () => {
    // Entry rows had both people; after Set Category the Unbound row is gone
    // from `rows`, but the database read still classifies it.
    const currentRows = [{ id: 1, trackingEnabled: 1, favourite_rank: null }];
    expect(currentRows.some((row) => row.id === 2)).toBe(false);
    const actionTime = lifecycleMapFrom([
      { id: 1, bound: true, favourite: false },
      { id: 2, bound: false, favourite: false },
    ]);
    expect(bulkWriteIds("snooze", [1, 2], actionTime)).toEqual([1]);
    expect(bulkWriteIds("add-favorites", [1, 2], actionTime)).toEqual([1]);
  });
});

describe("lifecycle maps", () => {
  it("lifecycleFromRows captures Bound and favourite for the frozen universe", () => {
    const result = lifecycleFromRows(
      [
        { id: 1, trackingEnabled: 1, favourite_rank: 0 },
        { id: 2, trackingEnabled: 0, favourite_rank: null },
        { id: 3, trackingEnabled: 1, favourite_rank: null },
      ],
      [1, 2],
    );
    expect([...result.entries()]).toEqual([
      [1, { bound: true, favourite: true }],
      [2, { bound: false, favourite: false }],
    ]);
  });

  it("withFavouriteOverlay lets an individual star override the favourite flag", () => {
    const base = map({ 1: BOUND, 2: BOUND_FAV });
    const result = withFavouriteOverlay(
      base,
      new Map([
        [1, true],
        [2, false],
        [7, true],
      ]),
    );
    expect(result.get(1)).toEqual({ bound: true, favourite: true });
    expect(result.get(2)).toEqual({ bound: true, favourite: false });
    // An overlay never invents an unknown id.
    expect(result.has(7)).toBe(false);
    // No overlay: the same map back.
    expect(withFavouriteOverlay(base, new Map())).toBe(base);
  });
});

describe("shouldApplyLifecycleRefresh (review R5-02)", () => {
  const base = {
    requestToken: 4,
    currentToken: 4,
    requestSessionId: 2,
    currentSessionId: 2,
    selectionMode: true,
  };
  it("applies a late refresh in the same session with the latest token", () => {
    expect(shouldApplyLifecycleRefresh(base)).toBe(true);
  });
  it("drops a refresh started in a previous selection session", () => {
    expect(shouldApplyLifecycleRefresh({ ...base, currentSessionId: 3 })).toBe(
      false,
    );
  });
  it("drops a refresh resolving after selection exit", () => {
    expect(shouldApplyLifecycleRefresh({ ...base, selectionMode: false })).toBe(
      false,
    );
  });
  it("drops a refresh superseded by a newer request in the same session", () => {
    expect(shouldApplyLifecycleRefresh({ ...base, currentToken: 5 })).toBe(
      false,
    );
  });
});
