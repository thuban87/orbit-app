/**
 * Latest-request authority (38.3 D-23; react-native/AUD-RN-010). Proves that an
 * older read can never publish rows, counts OR errors over a newer one, using
 * hand-rolled deferred promises (no timers).
 */
import { describe, expect, it } from "vitest";
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

/** A consumer that gates EVERY publication (data and error) on the authority. */
function makeConsumer() {
  const authority = createLatestRequestAuthority();
  const published: string[] = [];
  const errors: string[] = [];
  async function load(read: Promise<string>, label: string): Promise<void> {
    const token = authority.begin();
    try {
      const rows = await read;
      if (authority.isCurrent(token)) published.push(rows);
    } catch {
      if (authority.isCurrent(token)) errors.push(label);
    }
  }
  return { authority, published, errors, load };
}

describe("createLatestRequestAuthority", () => {
  it("begin() returns strictly increasing tokens; only the latest is current", () => {
    const authority = createLatestRequestAuthority();
    const a = authority.begin();
    const b = authority.begin();
    const c = authority.begin();
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(authority.isCurrent(c)).toBe(true);
    expect(authority.isCurrent(b)).toBe(false);
    expect(authority.isCurrent(a)).toBe(false);
  });

  it("defer A; begin B; resolve A → A's data does not publish, B's does", async () => {
    const consumer = makeConsumer();
    const a = deferred<string>();
    const b = deferred<string>();
    const loadA = consumer.load(a.promise, "A");
    const loadB = consumer.load(b.promise, "B");
    a.resolve("rows-A");
    await loadA;
    expect(consumer.published).toEqual([]);
    b.resolve("rows-B");
    await loadB;
    expect(consumer.published).toEqual(["rows-B"]);
  });

  it("an older token's ERROR is not current and never publishes over a newer read", async () => {
    const consumer = makeConsumer();
    const a = deferred<string>();
    const b = deferred<string>();
    const loadA = consumer.load(a.promise, "A");
    const loadB = consumer.load(b.promise, "B");
    b.resolve("rows-B");
    await loadB;
    a.reject(new Error("stale failure"));
    await loadA;
    expect(consumer.errors).toEqual([]);
    expect(consumer.published).toEqual(["rows-B"]);
  });

  it("invalidate() makes every outstanding token non-current", async () => {
    const consumer = makeConsumer();
    const a = deferred<string>();
    const loadA = consumer.load(a.promise, "A");
    const token = consumer.authority.begin();
    consumer.authority.invalidate();
    expect(consumer.authority.isCurrent(token)).toBe(false);
    a.resolve("rows-A");
    await loadA;
    expect(consumer.published).toEqual([]);
  });

  it("a request begun after invalidate() is current again", () => {
    const authority = createLatestRequestAuthority();
    authority.begin();
    authority.invalidate();
    const next = authority.begin();
    expect(authority.isCurrent(next)).toBe(true);
  });

  it("two independent authorities never affect each other", () => {
    const one = createLatestRequestAuthority();
    const two = createLatestRequestAuthority();
    const tokenOne = one.begin();
    const tokenTwo = two.begin();
    two.begin();
    two.invalidate();
    expect(one.isCurrent(tokenOne)).toBe(true);
    expect(two.isCurrent(tokenTwo)).toBe(false);
  });
});
