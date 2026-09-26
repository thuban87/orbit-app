/**
 * Debug fault registry (38.3 RG-023/RG-026 device probes). Inert unless armed in
 * a __DEV__ build; release builds never inject (T-38.3-01-04).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetUatFaultsForTest,
  applyUatFault,
  armUatFault,
  UAT_FAULT_NAMES,
} from "@/utils/uat-faults";

const devGlobal = globalThis as { __DEV__?: boolean };
let savedDev: boolean | undefined;
let hadDev = false;

beforeEach(() => {
  hadDev = "__DEV__" in devGlobal;
  savedDev = devGlobal.__DEV__;
  __resetUatFaultsForTest();
});

afterEach(() => {
  if (hadDev) devGlobal.__DEV__ = savedDev;
  else delete devGlobal.__DEV__;
  __resetUatFaultsForTest();
  vi.useRealTimers();
});

describe("uat-faults", () => {
  it("exposes the fault names later plans wire", () => {
    expect(UAT_FAULT_NAMES).toEqual(["digest-day-read", "assist-queue-refresh"]);
  });

  it("unarmed: applyUatFault resolves immediately", async () => {
    devGlobal.__DEV__ = true;
    await expect(applyUatFault("digest-day-read")).resolves.toBeUndefined();
  });

  it("non-dev build (__DEV__ undefined): arming is a no-op", async () => {
    delete devGlobal.__DEV__;
    armUatFault("digest-day-read", { mode: "reject" });
    await expect(applyUatFault("digest-day-read")).resolves.toBeUndefined();
  });

  it("__DEV__ false: arming is a no-op", async () => {
    devGlobal.__DEV__ = false;
    armUatFault("assist-queue-refresh", { mode: "reject" });
    await expect(applyUatFault("assist-queue-refresh")).resolves.toBeUndefined();
  });

  it("armed reject throws once, then disarms", async () => {
    devGlobal.__DEV__ = true;
    armUatFault("assist-queue-refresh", { mode: "reject" });
    await expect(applyUatFault("assist-queue-refresh")).rejects.toThrow(
      "uat injected fault",
    );
    await expect(applyUatFault("assist-queue-refresh")).resolves.toBeUndefined();
  });

  it("armed faults are per-name", async () => {
    devGlobal.__DEV__ = true;
    armUatFault("digest-day-read", { mode: "reject" });
    await expect(applyUatFault("assist-queue-refresh")).resolves.toBeUndefined();
    await expect(applyUatFault("digest-day-read")).rejects.toThrow();
  });

  it("armed delay waits the configured ms once, then disarms", async () => {
    devGlobal.__DEV__ = true;
    vi.useFakeTimers();
    armUatFault("digest-day-read", { mode: "delay", ms: 5_000 });
    let settled = false;
    const pending = applyUatFault("digest-day-read").then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(settled).toBe(true);

    // Disarmed: the next call resolves without waiting.
    let second = false;
    const next = applyUatFault("digest-day-read").then(() => {
      second = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    await next;
    expect(second).toBe(true);
  });
});
