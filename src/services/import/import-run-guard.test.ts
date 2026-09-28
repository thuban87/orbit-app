import { describe, expect, it } from "vitest";
import {
  followImportRun,
  ImportRunActiveError,
  isImportRunActive,
  withImportRun,
} from "./import-run-guard";

/**
 * 38.4 D-74 (owner): one bulk import pass per session at a time. A second
 * caller never starts another pass over the same pending rows; it can only
 * follow the pass already in flight.
 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("import run guard (D-74)", () => {
  it("refuses a second pass for a session while one is in flight", async () => {
    const gate = deferred<string>();
    const first = withImportRun(101, () => gate.promise);
    expect(isImportRunActive(101)).toBe(true);
    let secondStarted = false;
    await expect(
      withImportRun(101, async () => {
        secondStarted = true;
        return "second";
      }),
    ).rejects.toBeInstanceOf(ImportRunActiveError);
    expect(secondStarted).toBe(false);
    gate.resolve("first");
    await expect(first).resolves.toBe("first");
    expect(isImportRunActive(101)).toBe(false);
  });

  it("marks the run active synchronously, before its work first awaits", () => {
    const gate = deferred<void>();
    void withImportRun(102, () => gate.promise);
    expect(isImportRunActive(102)).toBe(true);
    gate.resolve();
  });

  it("does not block a different session", async () => {
    const gate = deferred<void>();
    const first = withImportRun(103, () => gate.promise);
    await expect(withImportRun(104, async () => "other")).resolves.toBe(
      "other",
    );
    gate.resolve();
    await first;
  });

  it("releases the session after a failed pass, so a later pass can start", async () => {
    await expect(
      withImportRun(105, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(isImportRunActive(105)).toBe(false);
    await expect(withImportRun(105, async () => "again")).resolves.toBe(
      "again",
    );
  });

  it("lets a later screen follow the pass in flight and see its progress", async () => {
    const gate = deferred<void>();
    let report: ((done: number, total: number) => void) | undefined;
    const first = withImportRun(106, (onReport) => {
      report = onReport;
      return gate.promise;
    });
    report?.(2, 10);
    const seen: Array<[number, number]> = [];
    const following = followImportRun(106, (done, total) =>
      seen.push([done, total]),
    );
    expect(following).not.toBeNull();
    report?.(3, 10);
    gate.resolve();
    await first;
    await following;
    // The last known progress first, then each later report.
    expect(seen).toEqual([
      [2, 10],
      [3, 10],
    ]);
  });

  it("follow returns null when no pass is in flight", () => {
    expect(followImportRun(107)).toBeNull();
  });

  it("a follower sees the in-flight pass's failure", async () => {
    const gate = deferred<void>();
    const first = withImportRun(108, () => gate.promise);
    const following = followImportRun(108);
    gate.reject(new Error("fatal"));
    await expect(first).rejects.toThrow("fatal");
    await expect(following).rejects.toThrow("fatal");
    expect(isImportRunActive(108)).toBe(false);
  });
});
