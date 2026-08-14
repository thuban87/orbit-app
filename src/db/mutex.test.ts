/**
 * Unit tests for the single shared write-serialization mutex (DATA-04).
 *
 * The mutex is the anti-transaction-capture primitive: every `last_contact`
 * write — foreground and, from Phases 11/12, headless widget/notification taps —
 * runs through it so only one hand-rolled DAO transaction is ever in flight on
 * the shared expo-sqlite connection (RESEARCH Pitfall P4). These tests prove the
 * three properties the DAO leans on: strict serialization, rejection isolation,
 * and value/error pass-through.
 */
import { describe, expect, it } from "vitest";
import { withMutex } from "@/db/mutex";

/** A promise plus its externally callable resolve/reject — used to hold an
 * in-flight operation open so we can observe that the next one has NOT started. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("withMutex — shared write serialization", () => {
  it("runs queued operations strictly one after another", async () => {
    const log: string[] = [];
    const gate = deferred<void>();

    const first = withMutex(async () => {
      log.push("1:start");
      await gate.promise; // hold the mutex open
      log.push("1:end");
    });
    const second = withMutex(async () => {
      log.push("2:start");
      log.push("2:end");
    });

    // Flush microtasks: op1 has started, op2 must NOT have started yet.
    await Promise.resolve();
    await Promise.resolve();
    expect(log).toEqual(["1:start"]);

    gate.resolve();
    await Promise.all([first, second]);

    // op2 begins only after op1 fully settles.
    expect(log).toEqual(["1:start", "1:end", "2:start", "2:end"]);
  });

  it("keeps the chain alive after a rejected operation", async () => {
    const failing = withMutex(async () => {
      throw new Error("boom");
    });
    await expect(failing).rejects.toThrow("boom");

    // A later operation still runs — the rejection did not break the chain.
    const after = withMutex(async () => 42);
    await expect(after).resolves.toBe(42);
  });

  it("still serializes the operation queued after a rejection", async () => {
    const log: string[] = [];
    const gate = deferred<void>();

    const failing = withMutex(async () => {
      log.push("fail:start");
      await gate.promise;
      throw new Error("boom");
    });
    const next = withMutex(async () => {
      log.push("next:start");
      log.push("next:end");
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(log).toEqual(["fail:start"]); // next has not started

    gate.resolve();
    await expect(failing).rejects.toThrow("boom");
    await next;
    expect(log).toEqual(["fail:start", "next:start", "next:end"]);
  });

  it("propagates the resolved value to the caller", async () => {
    await expect(withMutex(async () => "ok")).resolves.toBe("ok");
  });

  it("propagates the rejection error to the caller", async () => {
    await expect(
      withMutex(async () => {
        throw new Error("nope");
      }),
    ).rejects.toThrow("nope");
  });
});
