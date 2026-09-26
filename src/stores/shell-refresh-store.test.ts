/**
 * Node tests for the shell-refresh store's two independent counters (38.3 D-03,
 * D-14). Vitest is render-free, so the hooks are proven through their pure store
 * functions; the React effect wiring is covered by Plan 16 device UAT.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __resetSweepForTest,
  onSweepSettled,
  registerSweepHook,
  runLaunchSweep,
} from "@/services/launch-sweep";
import {
  bumpShellRefresh,
  publishForegroundRefresh,
  readRefreshRevisions,
} from "@/stores/shell-refresh-store";

beforeEach(() => {
  __resetSweepForTest();
});

afterEach(() => {
  __resetSweepForTest();
});

describe("shell-refresh store counters", () => {
  it("publishForegroundRefresh advances foreground by 1 and leaves shell unchanged", () => {
    const before = readRefreshRevisions();
    publishForegroundRefresh();
    const after = readRefreshRevisions();
    expect(after.foreground).toBe(before.foreground + 1);
    expect(after.shell).toBe(before.shell);
  });

  it("bumpShellRefresh advances shell only", () => {
    const before = readRefreshRevisions();
    bumpShellRefresh();
    const after = readRefreshRevisions();
    expect(after.shell).toBe(before.shell + 1);
    expect(after.foreground).toBe(before.foreground);
  });
});

describe("tracer: sweep settles → foreground tick (App.tsx wiring minus the effect)", () => {
  it("advances the foreground revision exactly once, only after the run settles", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    registerSweepHook(() => gate);
    const remove = onSweepSettled(publishForegroundRefresh);
    const before = readRefreshRevisions();

    const run = runLaunchSweep();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(readRefreshRevisions().foreground).toBe(before.foreground);

    release();
    await run;
    const after = readRefreshRevisions();
    expect(after.foreground).toBe(before.foreground + 1);
    expect(after.shell).toBe(before.shell);
    remove();
  });
});
