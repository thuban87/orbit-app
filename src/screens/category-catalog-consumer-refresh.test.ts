import { describe, expect, it, vi } from "vitest";

vi.mock("@react-navigation/native", () => ({ useFocusEffect: vi.fn() }));
vi.mock("@/db/contact-read", () => ({ listCategories: vi.fn() }));
vi.mock("@/db/database", () => ({ getExecutor: vi.fn() }));

import { createCategoryCatalogRefreshCoordinator } from "@/hooks/use-category-catalog-refresh";
import { resolveCategorySelection } from "@/logic/category-logic";

type Category = { id: number; name: string };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

async function runWiredConsumerRace() {
  const initialCategories = deferred<Category[]>();
  const focusCategories = deferred<Category[]>();
  const hydration = deferred<string>();
  const state = {
    categories: [{ id: 1, name: "Committed" }],
    selectedId: 1 as number | null,
    hydrated: "pending",
  };
  const read = vi
    .fn()
    .mockReturnValueOnce(initialCategories.promise)
    .mockReturnValueOnce(focusCategories.promise);
  const coordinator = createCategoryCatalogRefreshCoordinator({
    read,
    commit: (categories) => {
      state.categories = categories;
      state.selectedId = resolveCategorySelection(categories, state.selectedId);
    },
  });

  const initial = coordinator.request("initial");
  const nonCategory = hydration.promise.then((value) => {
    state.hydrated = value;
  });
  const focus = coordinator.request("focus");
  hydration.resolve("complete");
  await nonCategory;
  focusCategories.resolve([{ id: 1, name: "Newest" }]);
  await focus;
  initialCategories.resolve([{ id: 2, name: "Stale" }]);
  await initial;
  return { state, read };
}

describe("category catalog consumer refresh wiring", () => {
  const consumers = [
    "CreateContactScreen",
    "EditContactScreen",
    "ImportReviewScreen",
  ];

  it.each(consumers)(
    "%s keeps unrelated hydration independent and rejects stale initial publication",
    async () => {
      const { state, read } = await runWiredConsumerRace();
      expect(read).toHaveBeenCalledTimes(2);
      expect(state).toEqual({
        categories: [{ id: 1, name: "Newest" }],
        selectedId: 1,
        hydrated: "complete",
      });
    },
  );

  it.each(consumers)("%s retains state on rejection", async () => {
    const commit = vi.fn();
    const coordinator = createCategoryCatalogRefreshCoordinator({
      read: () => Promise.reject(new Error("failed")),
      commit,
    });
    await coordinator.request("initial");
    await coordinator.request("focus");
    expect(commit).not.toHaveBeenCalled();
  });

  it.each(consumers)(
    "%s rejects stale completion after blur and unmount",
    async () => {
      for (const lifecycle of ["blur", "unmount"] as const) {
        const pending = deferred<Category[]>();
        const commit = vi.fn();
        const coordinator = createCategoryCatalogRefreshCoordinator({
          read: () => pending.promise,
          commit,
        });
        const request = coordinator.request("focus");
        coordinator.invalidate(lifecycle);
        pending.resolve([{ id: 2, name: "Stale" }]);
        await request;
        expect(commit).not.toHaveBeenCalled();
      }
    },
  );
});
