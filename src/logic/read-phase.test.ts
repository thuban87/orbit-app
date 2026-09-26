/**
 * Read-phase tri-state (38.3 RG-035, ui-accessibility/AUD-UIA-012, D-24).
 * Proves loading → loaded / error transitions, that a re-read started from a
 * loaded view keeps it until the re-read settles, and that a stale token's
 * result OR failure never changes the phase (authority-gated, D-23).
 */
import { describe, expect, it } from "vitest";
import {
  loadedData,
  type ReadPhase,
  readFailed,
  readLoaded,
  readLoading,
  readStarted,
  runGatedRead,
} from "@/logic/read-phase";
import { createLatestRequestAuthority } from "@/utils/latest-request";

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: Error) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A tiny setState stand-in: applies functional updates in order. */
function makeHolder<T>(initial: ReadPhase<T>) {
  let phase = initial;
  return {
    get: () => phase,
    publish: (update: (current: ReadPhase<T>) => ReadPhase<T>) => {
      phase = update(phase);
    },
  };
}

describe("ReadPhase constructors and transitions", () => {
  it("builds the three phases and exposes data only from loaded", () => {
    expect(readLoading()).toEqual({ phase: "loading" });
    expect(readLoaded([1])).toEqual({ phase: "loaded", data: [1] });
    expect(readFailed()).toEqual({ phase: "error" });
    expect(loadedData(readLoaded("x"))).toBe("x");
    expect(loadedData(readLoading())).toBeNull();
    expect(loadedData(readFailed())).toBeNull();
  });

  it("a re-read started from loaded keeps the loaded view; otherwise loading", () => {
    const loaded = readLoaded({ n: 1 });
    expect(readStarted(loaded)).toBe(loaded);
    expect(readStarted(readLoading())).toEqual({ phase: "loading" });
    expect(readStarted(readFailed())).toEqual({ phase: "loading" });
  });
});

describe("runGatedRead — authority-gated, never rejects", () => {
  it("loading → loaded on success and seeds only from the current read", async () => {
    const gate = createLatestRequestAuthority();
    const holder = makeHolder<number[]>(readLoading());
    const seeded: number[][] = [];
    const outcome = await runGatedRead({
      gate,
      read: async () => [1, 2],
      publish: holder.publish,
      onLoaded: (rows) => seeded.push(rows),
    });
    expect(holder.get()).toEqual({ phase: "loaded", data: [1, 2] });
    expect(seeded).toEqual([[1, 2]]);
    expect(outcome).toEqual({ phase: "loaded", data: [1, 2] });
  });

  it("loading → error on failure, resolving (not rejecting) and reporting the error", async () => {
    const gate = createLatestRequestAuthority();
    const holder = makeHolder<number[]>(readLoading());
    const logged: unknown[] = [];
    const outcome = await runGatedRead({
      gate,
      read: async () => {
        throw new Error("disk");
      },
      publish: holder.publish,
      onError: (error) => logged.push(error),
    });
    expect(holder.get()).toEqual({ phase: "error" });
    expect(outcome).toEqual({ phase: "error" });
    expect(logged).toHaveLength(1);
  });

  it("a failed re-read from loaded moves to error (no stale known view survives)", async () => {
    const gate = createLatestRequestAuthority();
    const holder = makeHolder<string>(readLoaded("old"));
    const pending = deferred<string>();
    const run = runGatedRead({
      gate,
      read: () => pending.promise,
      publish: holder.publish,
    });
    // While in flight the loaded view is kept (caller never resets to loading).
    expect(holder.get()).toEqual({ phase: "loaded", data: "old" });
    pending.reject(new Error("gone"));
    await run;
    expect(holder.get()).toEqual({ phase: "error" });
  });

  it("an older read resolving after a newer one never overwrites it", async () => {
    const gate = createLatestRequestAuthority();
    const holder = makeHolder<string>(readLoading());
    const older = deferred<string>();
    const newer = deferred<string>();
    const seeded: string[] = [];
    const a = runGatedRead({
      gate,
      read: () => older.promise,
      publish: holder.publish,
      onLoaded: (v) => seeded.push(v),
    });
    const b = runGatedRead({
      gate,
      read: () => newer.promise,
      publish: holder.publish,
      onLoaded: (v) => seeded.push(v),
    });
    newer.resolve("new");
    await b;
    older.resolve("old");
    const staleOutcome = await a;
    expect(holder.get()).toEqual({ phase: "loaded", data: "new" });
    expect(seeded).toEqual(["new"]);
    expect(staleOutcome).toBeNull();
  });

  it("a stale failure never paints error over fresh data", async () => {
    const gate = createLatestRequestAuthority();
    const holder = makeHolder<string>(readLoading());
    const older = deferred<string>();
    const a = runGatedRead({
      gate,
      read: () => older.promise,
      publish: holder.publish,
    });
    await runGatedRead({
      gate,
      read: async () => "fresh",
      publish: holder.publish,
    });
    older.reject(new Error("late"));
    await a;
    expect(holder.get()).toEqual({ phase: "loaded", data: "fresh" });
  });

  it("invalidate() (blur/unmount) stops an outstanding read publishing", async () => {
    const gate = createLatestRequestAuthority();
    const holder = makeHolder<string>(readLoading());
    const pending = deferred<string>();
    const run = runGatedRead({
      gate,
      read: () => pending.promise,
      publish: holder.publish,
    });
    gate.invalidate();
    pending.resolve("late");
    await run;
    expect(holder.get()).toEqual({ phase: "loading" });
  });
});
