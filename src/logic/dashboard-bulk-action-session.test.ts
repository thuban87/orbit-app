import { describe, expect, it, vi } from "vitest";
import { createBulkActionGate } from "@/logic/dashboard-bulk-action-session";

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
