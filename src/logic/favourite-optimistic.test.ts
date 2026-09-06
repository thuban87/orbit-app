import { describe, expect, it, vi } from "vitest";
import type { DashboardRow } from "@/db/dashboard-read";
import {
  applyCommittedMembership,
  createFavouriteOptimisticStore,
} from "@/logic/favourite-optimistic";

describe("favourite optimistic reconciliation", () => {
  it("keeps a newer overlay when an older mutation settles", () => {
    const store = createFavouriteOptimisticStore();
    const first = store.begin(4, true);
    const second = store.begin(4, false);

    expect(store.resolve(4, first, "failure")).toBe("stale");
    expect(store.overlayFor(4)).toBe(false);
    expect(store.resolve(4, second, "failure")).toBe("applied");
    expect(store.overlayFor(4)).toBeUndefined();
  });

  it("overlays an in-flight choice across a stale base reload", () => {
    const store = createFavouriteOptimisticStore();
    const generation = store.begin(9, true);

    expect(store.overlayFor(9)).toBe(true);
    expect(store.resolve(9, generation, "success")).toBe("applied");
    expect(store.overlayFor(9)).toBeUndefined();
  });

  it("notifies subscribers with a new snapshot for begin and latest resolve", () => {
    const store = createFavouriteOptimisticStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const initial = store.getSnapshot();

    const generation = store.begin(2, true);
    const pending = store.getSnapshot();
    store.resolve(2, generation, "success");
    const settled = store.getSnapshot();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(pending).not.toBe(initial);
    expect(settled).not.toBe(pending);
    unsubscribe();
  });

  it("patches committed membership immutably so success remains visible without reload", () => {
    const rows = [{ id: 8, favourite_rank: null }] as DashboardRow[];
    const store = createFavouriteOptimisticStore();
    const generation = store.begin(8, true);

    const committed = applyCommittedMembership(rows, 8, true);
    expect(committed).not.toBe(rows);
    expect(committed[0]).not.toBe(rows[0]);
    expect(rows[0].favourite_rank).toBeNull();
    expect(committed[0].favourite_rank).not.toBeNull();
    expect(store.resolve(8, generation, "success")).toBe("applied");
    expect(store.overlayFor(8) ?? (committed[0].favourite_rank !== null)).toBe(true);

    expect(applyCommittedMembership(committed, 8, false)[0].favourite_rank).toBeNull();
  });
});
