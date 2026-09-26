import { describe, expect, it, vi } from "vitest";
import {
  importCompleteRetryState,
  runImportCompleteAction,
} from "./import-complete-logic";

describe("importCompleteRetryState (RG-035, D-26)", () => {
  it("offers Retry for pending rows left by a fatal stop", () => {
    const state = importCompleteRetryState({
      failed: 0,
      pending: 3,
      photoRows: 0,
    });
    expect(state.visible).toBe(true);
    expect(state.message).toBe("Some contacts haven't been imported yet.");
  });

  it("keeps the failed-rows message", () => {
    expect(
      importCompleteRetryState({ failed: 2, pending: 0, photoRows: 0 }),
    ).toEqual({
      visible: true,
      message: "Some contacts couldn't be imported.",
    });
  });

  it("keeps the unfinished-photos message", () => {
    expect(
      importCompleteRetryState({ failed: 0, pending: 0, photoRows: 2 }),
    ).toEqual({
      visible: true,
      message: "Some contact photos still need to be added.",
    });
  });

  it("is hidden when nothing is left to retry", () => {
    expect(
      importCompleteRetryState({ failed: 0, pending: 0, photoRows: 0 }),
    ).toEqual({ visible: false, message: null });
  });

  it("prefers failed, then pending, then photos", () => {
    expect(
      importCompleteRetryState({ failed: 1, pending: 1, photoRows: 1 }).message,
    ).toBe("Some contacts couldn't be imported.");
    expect(
      importCompleteRetryState({ failed: 0, pending: 1, photoRows: 1 }).message,
    ).toBe("Some contacts haven't been imported yet.");
  });
});

describe("runImportCompleteAction (38.3 review B-WR-03 / B-WR-04, D-04)", () => {
  it("a failed write is reported as a write failure and still re-reads the summary read-only", async () => {
    const order: string[] = [];
    const onWriteFailed = vi.fn(() => order.push("write-failed"));
    const outcome = await runImportCompleteAction(
      { current: false },
      {
        write: () => Promise.reject(new Error("batch")),
        refresh: async () => {
          order.push("refresh");
        },
        onWriteFailed,
      },
    );
    expect(outcome).toBe("write-failed");
    expect(onWriteFailed).toHaveBeenCalledTimes(1);
    // The summary is re-read so counts show what DID commit before the failure.
    expect(order).toEqual(["write-failed", "refresh"]);
  });

  it("a committed write refreshes once and never reports a write failure", async () => {
    const refresh = vi.fn(async () => {});
    const onWriteFailed = vi.fn();
    const outcome = await runImportCompleteAction(
      { current: false },
      { write: async () => {}, refresh, onWriteFailed },
    );
    expect(outcome).toBe("committed");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onWriteFailed).not.toHaveBeenCalled();
  });

  it("drops a same-tick second call so the write runs once", async () => {
    const latch = { current: false };
    let release = () => {};
    const write = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const steps = { write, refresh: async () => {}, onWriteFailed: vi.fn() };
    const first = runImportCompleteAction(latch, steps);
    const second = runImportCompleteAction(latch, steps);
    expect(await second).toBe("dropped");
    release();
    expect(await first).toBe("committed");
    expect(write).toHaveBeenCalledTimes(1);
  });
});
