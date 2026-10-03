import { describe, expect, it, vi } from "vitest";
import {
  COVER_FALLBACK_MS,
  COVER_MAX_MS,
  COVER_SETTLE_MS,
  watchFirstSurfaceFrame,
} from "./first-frame";

/** A manual clock + timer queue. */
function timers() {
  let now = 0;
  let serial = 0;
  const queue = new Map<number, { at: number; run: () => void }>();
  return {
    now: () => now,
    setTimeout: (run: () => void, ms: number) => {
      const id = ++serial;
      queue.set(id, { at: now + ms, run });
      return id;
    },
    clearTimeout: (id: unknown) => {
      queue.delete(id as number);
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        let next: [number, { at: number; run: () => void }] | null = null;
        for (const entry of queue)
          if (entry[1].at <= end && (!next || entry[1].at < next[1].at))
            next = entry;
        if (!next) break;
        queue.delete(next[0]);
        now = next[1].at;
        next[1].run();
      }
      now = end;
    },
    pending: () => queue.size,
  };
}

describe("watchFirstSurfaceFrame (the opaque canvas's first-frame cover)", () => {
  it("waits for the native surface size, then a settle, then reports once", () => {
    const t = timers();
    let width = 0;
    const onReady = vi.fn();
    watchFirstSurfaceFrame(() => 7, onReady, {
      size: (id) => (id === 7 ? { width, height: width ? 800 : 0 } : null),
      ...t,
    });
    t.advance(400);
    expect(onReady).not.toHaveBeenCalled();
    width = 412; // the SurfaceView's surface became available
    t.advance(20);
    expect(onReady).not.toHaveBeenCalled();
    t.advance(COVER_SETTLE_MS);
    expect(onReady).toHaveBeenCalledTimes(1);
    t.advance(5000);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(t.pending()).toBe(0);
  });

  it("is bounded: reports after COVER_MAX_MS even if the surface never reports", () => {
    const t = timers();
    const onReady = vi.fn();
    watchFirstSurfaceFrame(() => 7, onReady, {
      size: () => ({ width: 0, height: 0 }),
      ...t,
    });
    t.advance(COVER_MAX_MS - 20);
    expect(onReady).not.toHaveBeenCalled();
    t.advance(40);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(t.pending()).toBe(0);
  });

  it("without the native view API: a fixed fallback delay", () => {
    const t = timers();
    const onReady = vi.fn();
    watchFirstSurfaceFrame(() => null, onReady, { size: null, ...t });
    t.advance(COVER_FALLBACK_MS - 1);
    expect(onReady).not.toHaveBeenCalled();
    t.advance(1);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("cancel (unmount) stops polling and never reports", () => {
    const t = timers();
    const onReady = vi.fn();
    const cancel = watchFirstSurfaceFrame(() => 7, onReady, {
      size: () => ({ width: 0, height: 0 }),
      ...t,
    });
    t.advance(100);
    cancel();
    t.advance(COVER_MAX_MS * 2);
    expect(onReady).not.toHaveBeenCalled();
    expect(t.pending()).toBe(0);
  });
});
