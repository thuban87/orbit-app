import { describe, expect, it, vi } from "vitest";
import { createCategoryCatalogRefreshCoordinator } from "./use-category-catalog-refresh";

type Category = { id: number; name: string };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("category catalog refresh coordinator", () => {
  it.each([
    ["initial then focus", "initial", "focus"],
    ["focus then initial", "focus", "initial"],
  ] as const)("publishes only the latest request: %s", async (_label, first, second) => {
    const pending = [deferred<Category[]>(), deferred<Category[]>()];
    const commit = vi.fn();
    const coordinator = createCategoryCatalogRefreshCoordinator({
      read: vi.fn().mockReturnValueOnce(pending[0].promise).mockReturnValueOnce(pending[1].promise),
      commit,
    });

    const older = coordinator.request(first);
    const newer = coordinator.request(second);
    pending[1].resolve([{ id: 2, name: "Newest" }]);
    await newer;
    pending[0].resolve([{ id: 1, name: "Stale" }]);
    await older;

    expect(commit).toHaveBeenCalledOnce();
    expect(commit).toHaveBeenCalledWith([{ id: 2, name: "Newest" }]);
  });

  it.each(["initial", "focus"] as const)(
    "catches a rejected %s request without publishing",
    async (source) => {
      const commit = vi.fn();
      const coordinator = createCategoryCatalogRefreshCoordinator({
        read: () => Promise.reject(new Error("read failed")),
        commit,
      });
      await expect(coordinator.request(source)).resolves.toBeUndefined();
      expect(commit).not.toHaveBeenCalled();
    },
  );

  it.each(["blur", "unmount"] as const)(
    "invalidates a completion after %s",
    async (lifecycle) => {
      const pending = deferred<Category[]>();
      const commit = vi.fn();
      const coordinator = createCategoryCatalogRefreshCoordinator({
        read: () => pending.promise,
        commit,
      });
      const request = coordinator.request("focus");
      coordinator.invalidate(lifecycle);
      pending.resolve([{ id: 1, name: "Stale" }]);
      await request;
      expect(commit).not.toHaveBeenCalled();
    },
  );
});
