import { describe, expect, it, vi } from "vitest";
import { createLatestRequestAuthority } from "@/utils/latest-request";
import {
  type EventsSearchPatch,
  runEventsSearch,
} from "./group-events-search-logic";

/**
 * Events search runner (38.14 D-25, D-48; ADR-162): the latest result wins,
 * the spinner shows on the first load only, every current settle clears it,
 * and a stale settle publishes nothing.
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

function harness() {
  const gate = createLatestRequestAuthority();
  const published: EventsSearchPatch<string>[] = [];
  const reads = new Map<string, ReturnType<typeof deferred<string[]>>>();
  const run = (term: string, isFirstLoad: boolean) =>
    runEventsSearch<string>({
      gate,
      term,
      isFirstLoad,
      read: (t) => {
        const d = deferred<string[]>();
        reads.set(t, d);
        return d.promise;
      },
      publish: (patch) => published.push(patch),
    });
  return { gate, published, reads, run };
}

describe("runEventsSearch (38.14 D-25, D-48)", () => {
  it("an older read resolving last never publishes over the newer one", async () => {
    const h = harness();
    const older = h.run("a", false);
    const newer = h.run("ab", false);
    h.reads.get("ab")?.resolve(["ab rows"]);
    await expect(newer).resolves.toBe(true);
    h.reads.get("a")?.resolve(["a rows"]);
    await expect(older).resolves.toBe(false);
    expect(h.published).toEqual([
      { loading: false, failed: false, items: ["ab rows"] },
    ]);
  });

  it("publishes loading true only for a first load", async () => {
    const h = harness();
    const first = h.run("", true);
    expect(h.published).toEqual([{ loading: true }]);
    h.reads.get("")?.resolve(["all"]);
    await first;
    const later = h.run("x", false);
    // The current list stays visible: nothing is published until it settles.
    expect(h.published).toHaveLength(2);
    h.reads.get("x")?.resolve(["x rows"]);
    await later;
    expect(h.published.slice(1)).toEqual([
      { loading: false, failed: false, items: ["all"] },
      { loading: false, failed: false, items: ["x rows"] },
    ]);
  });

  it("every current settle publishes loading false; a stale one publishes nothing", async () => {
    const h = harness();
    const stale = h.run("a", true);
    const current = h.run("b", true);
    h.reads.get("a")?.reject(new Error("boom"));
    await expect(stale).resolves.toBe(false);
    h.reads.get("b")?.reject(new Error("boom"));
    await expect(current).resolves.toBe(true);
    const settles = h.published.filter((patch) => patch.loading === false);
    expect(settles).toEqual([{ loading: false, failed: true, items: [] }]);
  });

  it("an invalidated first read leaves the next read a first load, which clears the spinner", async () => {
    const h = harness();
    // The caller keeps "first load" until a read settles current.
    let firstLoadPending = true;
    const runTracked = async (term: string) => {
      const current = await h.run(term, firstLoadPending);
      if (current) firstLoadPending = false;
      return current;
    };
    const first = runTracked("");
    h.gate.invalidate(); // blur before it settles
    h.reads.get("")?.resolve(["late"]);
    await expect(first).resolves.toBe(false);
    expect(firstLoadPending).toBe(true);

    const second = runTracked("");
    h.reads.get("")?.resolve(["fresh"]);
    await expect(second).resolves.toBe(true);
    expect(firstLoadPending).toBe(false);
    expect(h.published).toEqual([
      { loading: true },
      { loading: true },
      { loading: false, failed: false, items: ["fresh"] },
    ]);
  });

  it("a failed newest read publishes the failed state; a failed stale read publishes nothing", async () => {
    const h = harness();
    const stale = h.run("a", false);
    const newest = h.run("ab", false);
    h.reads.get("ab")?.reject(new Error("db"));
    await newest;
    h.reads.get("a")?.reject(new Error("db"));
    await stale;
    expect(h.published).toEqual([{ loading: false, failed: true, items: [] }]);
  });

  it("invalidate (blur) stops an in-flight read from publishing", async () => {
    const h = harness();
    const publish = vi.fn();
    const pending = runEventsSearch<string>({
      gate: h.gate,
      term: "a",
      isFirstLoad: false,
      read: () => Promise.resolve(["rows"]),
      publish,
    });
    h.gate.invalidate();
    await expect(pending).resolves.toBe(false);
    expect(publish).not.toHaveBeenCalled();
  });
});
