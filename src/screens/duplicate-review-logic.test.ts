import { describe, expect, it, vi } from "vitest";
import {
  duplicateReviewView,
  runBulkResolveThenRecover,
  runResolveThenRecover,
} from "./duplicate-review-logic";

describe("duplicateReviewView (RG-035, D-24)", () => {
  it("is loading while the read runs", () => {
    expect(duplicateReviewView({ loading: true })).toBe("loading");
  });

  it("is an error, never empty, after a failed read with no items", () => {
    expect(
      duplicateReviewView({ loading: false, loadError: true, itemCount: 0 }),
    ).toBe("error");
  });

  it("is an error after a failed read even when stale items exist", () => {
    expect(
      duplicateReviewView({ loading: false, loadError: true, itemCount: 4 }),
    ).toBe("error");
  });

  it("is empty only after a successful read with nothing to review", () => {
    expect(
      duplicateReviewView({ loading: false, loadError: false, itemCount: 0 }),
    ).toBe("empty");
  });

  it("shows items after a successful read", () => {
    expect(
      duplicateReviewView({ loading: false, loadError: false, itemCount: 2 }),
    ).toBe("items");
  });
});

function rejects(message: string) {
  return vi.fn(async () => {
    throw new Error(message);
  });
}

describe("runResolveThenRecover — link path (D-04)", () => {
  it("treats a committed write as done when finalize rejects", async () => {
    const onWriteError = vi.fn();
    const onWritten = vi.fn();
    const onRecoveryError = vi.fn();
    const reread = vi.fn(async () => undefined);
    const outcome = await runResolveThenRecover({
      write: vi.fn(async () => undefined),
      onWritten,
      finalize: rejects("finalize failed"),
      reread,
      onWriteError,
      onRecoveryError,
    });
    expect(outcome).toEqual({ writeOk: true, recoveryError: true });
    expect(onWritten).toHaveBeenCalledTimes(1);
    expect(onWriteError).not.toHaveBeenCalled();
    expect(onRecoveryError).toHaveBeenCalledTimes(1);
    expect(reread).not.toHaveBeenCalled();
  });

  it("treats a committed write as done when the re-read rejects", async () => {
    const onWriteError = vi.fn();
    const outcome = await runResolveThenRecover({
      write: vi.fn(async () => undefined),
      finalize: vi.fn(async () => undefined),
      reread: rejects("read failed"),
      onWriteError,
    });
    expect(outcome).toEqual({ writeOk: true, recoveryError: true });
    expect(onWriteError).not.toHaveBeenCalled();
  });

  it("reports a rejected write and never finalizes or re-reads", async () => {
    const finalize = vi.fn(async () => undefined);
    const reread = vi.fn(async () => undefined);
    const onWritten = vi.fn();
    const onWriteError = vi.fn();
    const outcome = await runResolveThenRecover({
      write: rejects("link failed"),
      onWritten,
      finalize,
      reread,
      onWriteError,
    });
    expect(outcome).toEqual({ writeOk: false });
    expect(onWriteError).toHaveBeenCalledTimes(1);
    expect(onWritten).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
    expect(reread).not.toHaveBeenCalled();
  });

  it("succeeds cleanly when every step resolves", async () => {
    const outcome = await runResolveThenRecover({
      write: vi.fn(async () => undefined),
      finalize: vi.fn(async () => undefined),
      reread: vi.fn(async () => undefined),
    });
    expect(outcome).toEqual({ writeOk: true, recoveryError: false });
  });
});

describe("runBulkResolveThenRecover — bulk path (D-04)", () => {
  it("never reports a resolve failure when only finalize rejects", async () => {
    const onRowError = vi.fn();
    const onRecoveryError = vi.fn();
    const writeOne = vi.fn(async (_id: number) => undefined);
    const outcome = await runBulkResolveThenRecover({
      entries: [1, 2],
      writeOne,
      onRowError,
      finalize: rejects("finalize failed"),
      reread: vi.fn(async () => undefined),
      onRecoveryError,
    });
    expect(outcome).toEqual({ failed: [], recoveryError: true });
    expect(writeOne).toHaveBeenCalledTimes(2);
    expect(onRowError).not.toHaveBeenCalled();
    expect(onRecoveryError).toHaveBeenCalledTimes(1);
  });

  it("isolates a failed row write and still recovers once", async () => {
    const onRowError = vi.fn();
    const finalize = vi.fn(async () => undefined);
    const reread = vi.fn(async () => undefined);
    const outcome = await runBulkResolveThenRecover({
      entries: [1, 2, 3],
      writeOne: async (id: number) => {
        if (id === 2) throw new Error("row write failed");
      },
      onRowError,
      finalize,
      reread,
    });
    expect(outcome).toEqual({ failed: [2], recoveryError: false });
    expect(onRowError).toHaveBeenCalledTimes(1);
    expect(onRowError.mock.calls[0][0]).toBe(2);
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(reread).toHaveBeenCalledTimes(1);
  });
});
