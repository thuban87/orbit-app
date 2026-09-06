import { describe, expect, it, vi } from "vitest";
import {
  createBulkActionGate,
  getCurrentSelectionIds,
} from "@/logic/dashboard-bulk-action-session";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("createBulkActionGate", () => {
  it("allows one deferred Quick Log, then retains that operation's receipt for its only Undo", async () => {
    const write = deferred<{ batchId: "first-and-only" }>();
    const bulkQuickLog = vi.fn(() => write.promise);
    const snackbars: { undo: () => { batchId: "first-and-only" } }[] = [];
    const gate = createBulkActionGate();

    const startQuickLog = () => {
      if (!gate.tryAcquire()) return;
      void bulkQuickLog()
        .then((receipt) => {
          snackbars.push({ undo: () => receipt });
        })
        .finally(() => gate.release());
    };

    startQuickLog();
    startQuickLog();

    expect(bulkQuickLog).toHaveBeenCalledOnce();
    expect(gate.pending).toBe(true);

    write.resolve({ batchId: "first-and-only" });
    await vi.waitFor(() => expect(snackbars).toHaveLength(1));

    expect(snackbars[0].undo()).toEqual({ batchId: "first-and-only" });
    await vi.waitFor(() => expect(gate.pending).toBe(false));
  });
});

describe("getCurrentSelectionIds", () => {
  it("rejects a category read that resolves after its selection session exits", async () => {
    const categories = deferred<{ id: number; name: string }[]>();
    const bulkSetCategory = vi.fn();
    let selection = {
      mode: true,
      sessionId: 1,
      selectedIds: new Set([1, 2]),
    };

    const openCategoryPicker = async () => {
      const sessionId = selection.sessionId;
      await categories.promise;
      if (!getCurrentSelectionIds(selection, sessionId)) return;
      bulkSetCategory();
    };

    const pending = openCategoryPicker();
    selection = { ...selection, mode: false, selectedIds: new Set() };
    categories.resolve([]);
    await pending;

    expect(bulkSetCategory).not.toHaveBeenCalled();
  });

  it("rejects a stale open picker but uses IDs selected at a valid choice", () => {
    const bulkSetCategory = vi.fn();
    let selection = {
      mode: true,
      sessionId: 1,
      selectedIds: new Set([1, 2]),
    };
    const staleSessionId = selection.sessionId;

    selection = { mode: true, sessionId: 2, selectedIds: new Set([3]) };
    const staleIds = getCurrentSelectionIds(selection, staleSessionId);
    if (staleIds) bulkSetCategory(staleIds);
    expect(bulkSetCategory).not.toHaveBeenCalled();

    selection = { ...selection, selectedIds: new Set([3, 4]) };
    const currentIds = getCurrentSelectionIds(selection, selection.sessionId);
    if (currentIds) bulkSetCategory(currentIds);
    expect(bulkSetCategory).toHaveBeenCalledExactlyOnceWith([3, 4]);
  });
});
