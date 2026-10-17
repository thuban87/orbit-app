import { describe, expect, it, vi } from "vitest";
import type { AppSettings, AppSettingsPatch } from "@/db/app-settings-dao";
import type { SqlExecutor } from "@/db/types";
import {
  effectiveReminderArrival,
  formatHour,
  type PersistNotificationDeps,
  persistNotificationSettings,
  QUIET_HOURS_HELPER,
  reminderArrivalLine,
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

function makeDeps(overrides: Partial<PersistNotificationDeps> = {}): {
  deps: PersistNotificationDeps;
  calls: string[];
} {
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

/**
 * 38.12 D-78: when a reminder time sits inside quiet hours, the page says when
 * reminders really arrive, computed by the scheduler's own
 * `nextAllowedFireInstant`.
 */
describe("effectiveReminderArrival (D-78)", () => {
  const BASE = new Date(2026, 9, 17, 15, 30);

  it("is null when the reminder time is outside quiet hours", () => {
    expect(
      effectiveReminderArrival({
        reminderTime: 9,
        quietStart: 21,
        quietEnd: 8,
        baseDate: BASE,
      }),
    ).toBeNull();
    // The hour quiet hours end on is already outside the window.
    expect(
      effectiveReminderArrival({
        reminderTime: 8,
        quietStart: 21,
        quietEnd: 8,
        baseDate: BASE,
      }),
    ).toBeNull();
  });

  it("an early-morning time inside a window across midnight arrives the same morning", () => {
    expect(
      effectiveReminderArrival({
        reminderTime: 6,
        quietStart: 21,
        quietEnd: 8,
        baseDate: BASE,
      }),
    ).toEqual({ arrivalHour: 8, nextDay: false });
  });

  it("an evening time inside a window across midnight arrives the next morning", () => {
    expect(
      effectiveReminderArrival({
        reminderTime: 22,
        quietStart: 21,
        quietEnd: 8,
        baseDate: BASE,
      }),
    ).toEqual({ arrivalHour: 8, nextDay: true });
    // Quiet start hour itself is inside the window.
    expect(
      effectiveReminderArrival({
        reminderTime: 21,
        quietStart: 21,
        quietEnd: 7,
        baseDate: BASE,
      }),
    ).toEqual({ arrivalHour: 7, nextDay: true });
  });

  it("a daytime window that does not cross midnight rolls to its end the same day", () => {
    expect(
      effectiveReminderArrival({
        reminderTime: 13,
        quietStart: 12,
        quietEnd: 14,
        baseDate: BASE,
      }),
    ).toEqual({ arrivalHour: 14, nextDay: false });
  });

  it("equal quiet start and end is no quiet window", () => {
    expect(
      effectiveReminderArrival({
        reminderTime: 10,
        quietStart: 10,
        quietEnd: 10,
        baseDate: BASE,
      }),
    ).toBeNull();
  });

  it("ignores the time of day of the base date (no 'now' roll)", () => {
    const lateEvening = new Date(2026, 9, 17, 23, 59);
    expect(
      effectiveReminderArrival({
        reminderTime: 6,
        quietStart: 21,
        quietEnd: 8,
        baseDate: lateEvening,
      }),
    ).toEqual({ arrivalHour: 8, nextDay: false });
  });
});

describe("reminderArrivalLine / copy (D-78)", () => {
  it("is null when there is no roll", () => {
    expect(reminderArrivalLine(null, true)).toBeNull();
  });

  it("states the arrival time after quiet hours end", () => {
    expect(reminderArrivalLine({ arrivalHour: 8, nextDay: false }, true)).toBe(
      "Reminders will arrive at 8:00 AM, after quiet hours end.",
    );
  });

  it("says birthday alerts are not sent when the roll crosses midnight and they are on", () => {
    expect(reminderArrivalLine({ arrivalHour: 7, nextDay: true }, true)).toBe(
      "Reminders will arrive at 7:00 AM, after quiet hours end. Birthday alerts can't move to the next day, so they won't be sent.",
    );
    expect(reminderArrivalLine({ arrivalHour: 7, nextDay: true }, false)).toBe(
      "Reminders will arrive at 7:00 AM, after quiet hours end.",
    );
  });

  it("formats hours as wall-clock labels", () => {
    expect(formatHour(0)).toBe("12:00 AM");
    expect(formatHour(9)).toBe("9:00 AM");
    expect(formatHour(12)).toBe("12:00 PM");
    expect(formatHour(21)).toBe("9:00 PM");
  });

  it("the quiet-hours helper no longer promises 'the next morning'", () => {
    expect(QUIET_HOURS_HELPER).not.toMatch(/next morning/);
    expect(QUIET_HOURS_HELPER).toContain("wait until quiet hours end");
  });
});
