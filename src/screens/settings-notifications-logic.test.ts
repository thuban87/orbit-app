import { describe, expect, it, vi } from "vitest";
import type { AppSettings, AppSettingsPatch } from "@/db/app-settings-dao";
import type { SqlExecutor } from "@/db/types";
import {
  persistNotificationSettings,
  type PersistNotificationDeps,
} from "./settings-notifications-logic";

/**
 * `persistNotificationSettings` shared reconcile-on-write helper (Pitfall 5 +
 * review MEDIUM #2 + cycle-3 failure-ownership). These tests drive the helper
 * through the ACTUAL shared write path with mocked deps — a source-text check
 * that both reconciler names appear would be insufficient (Codex). They assert:
 *   1. updateAppSettings is called with the patch BEFORE the re-read;
 *   2. BOTH reconcilers fire after a successful write;
 *   3. the helper RETURNS the re-read AppSettings (the re-read is not discarded);
 *   4. a failing updateAppSettings REJECTS out of the helper WITHOUT invoking the
 *      reconcilers or the re-read, and returns no stale value.
 */

const FRESH_SETTINGS = {
  notificationsEnabled: 1,
  decayEnabled: 1,
  deliveryHour: 9,
} as unknown as AppSettings;

const EXEC = {} as SqlExecutor;
const PATCH: AppSettingsPatch = { decayEnabled: 1 };
const NOW = "2026-09-14T09:00:00";

function makeDeps(
  overrides: Partial<PersistNotificationDeps> = {},
): { deps: PersistNotificationDeps; calls: string[] } {
  const calls: string[] = [];
  const deps: PersistNotificationDeps = {
    updateAppSettings: vi.fn(async () => {
      calls.push("update");
    }),
    getAppSettings: vi.fn(async () => {
      calls.push("read");
      return FRESH_SETTINGS;
    }),
    reconcileSchedule: vi.fn(async () => {
      calls.push("reconcileSchedule");
    }),
    reconcileDigestSchedule: vi.fn(async () => {
      calls.push("reconcileDigest");
    }),
    now: () => NOW,
    ...overrides,
  };
  return { deps, calls };
}

describe("persistNotificationSettings", () => {
  it("calls updateAppSettings with the patch and now() BEFORE the re-read", async () => {
    const { deps, calls } = makeDeps();
    await persistNotificationSettings(EXEC, PATCH, deps);
    expect(deps.updateAppSettings).toHaveBeenCalledWith(EXEC, PATCH, NOW);
    expect(deps.getAppSettings).toHaveBeenCalledWith(EXEC);
    // The write must land before the re-read.
    expect(calls.indexOf("update")).toBeLessThan(calls.indexOf("read"));
  });

  it("fires BOTH reconcilers after a successful write (Pitfall 5)", async () => {
    const { deps, calls } = makeDeps();
    await persistNotificationSettings(EXEC, PATCH, deps);
    expect(deps.reconcileSchedule).toHaveBeenCalledWith(EXEC);
    expect(deps.reconcileDigestSchedule).toHaveBeenCalledWith(EXEC);
    // Reconcilers run after the write + re-read.
    expect(calls.indexOf("read")).toBeLessThan(
      calls.indexOf("reconcileSchedule"),
    );
    expect(calls.indexOf("read")).toBeLessThan(
      calls.indexOf("reconcileDigest"),
    );
  });

  it("RETURNS the re-read AppSettings (the re-read is not discarded — review MEDIUM #2)", async () => {
    const { deps } = makeDeps();
    const result = await persistNotificationSettings(EXEC, PATCH, deps);
    expect(result).toBe(FRESH_SETTINGS);
  });

  it("REJECTS on a failed write WITHOUT invoking the re-read or the reconcilers (cycle-3)", async () => {
    const writeError = new Error("write failed");
    const { deps } = makeDeps({
      updateAppSettings: vi.fn(async () => {
        throw writeError;
      }),
    });
    await expect(
      persistNotificationSettings(EXEC, PATCH, deps),
    ).rejects.toThrow("write failed");
    // No stale re-read, no schedule re-arm on a failed write.
    expect(deps.getAppSettings).not.toHaveBeenCalled();
    expect(deps.reconcileSchedule).not.toHaveBeenCalled();
    expect(deps.reconcileDigestSchedule).not.toHaveBeenCalled();
  });
});
