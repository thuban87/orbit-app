import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SqlExecutor } from "@/db/types";

const {
  reconcileSchedule,
  notifyWidgetDataChanged,
  loggerError,
  getAppSettings,
} = vi.hoisted(() => ({
  reconcileSchedule: vi.fn(async () => {}),
  notifyWidgetDataChanged: vi.fn(),
  loggerError: vi.fn(),
  getAppSettings: vi.fn(async () => ({ birthdayUnboundEnabled: 0 })),
}));

vi.mock("@/services/notifications/notification-schedule", () => ({
  reconcileSchedule,
}));
vi.mock("@/services/widget/widget-refresh", () => ({
  notifyWidgetDataChanged,
}));
vi.mock("@/db/app-settings-dao", () => ({ getAppSettings }));
vi.mock("@/utils/logger", () => ({
  Logger: { error: loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { applyImportLifecycleEffects } from "./import-lifecycle-effects";

const exec = {} as SqlExecutor;
const BOUND = { anyBound: true, anyUnbound: false };
const UNBOUND = { anyBound: false, anyUnbound: true };

beforeEach(() => {
  vi.clearAllMocks();
  getAppSettings.mockResolvedValue({ birthdayUnboundEnabled: 0 });
});

/**
 * 38.4 D-57 / 38.12 D-58: after an import, reminders and the widget refresh
 * once, best-effort, post-commit — never failing the import. An Unbound import
 * reschedules birthdays only when "Birthday alerts for Unbound contacts" is on.
 */
describe("applyImportLifecycleEffects — Bound (D-57)", () => {
  it("reconciles the schedule, then refreshes the widget, once each", async () => {
    await applyImportLifecycleEffects(exec, BOUND);
    expect(reconcileSchedule).toHaveBeenCalledTimes(1);
    expect(reconcileSchedule).toHaveBeenCalledWith(exec);
    expect(notifyWidgetDataChanged).toHaveBeenCalledTimes(1);
    expect(reconcileSchedule.mock.invocationCallOrder[0]).toBeLessThan(
      notifyWidgetDataChanged.mock.invocationCallOrder[0],
    );
  });

  it("reconciles once when an import created both Bound and Unbound contacts", async () => {
    getAppSettings.mockResolvedValue({ birthdayUnboundEnabled: 1 });
    await applyImportLifecycleEffects(exec, {
      anyBound: true,
      anyUnbound: true,
    });
    expect(reconcileSchedule).toHaveBeenCalledTimes(1);
    expect(notifyWidgetDataChanged).toHaveBeenCalledTimes(1);
  });

  it("isolates a schedule failure: logs it, still refreshes the widget, never rethrows", async () => {
    reconcileSchedule.mockRejectedValueOnce(new Error("schedule down"));
    await expect(
      applyImportLifecycleEffects(exec, BOUND),
    ).resolves.toBeUndefined();
    expect(notifyWidgetDataChanged).toHaveBeenCalledTimes(1);
    expect(loggerError).toHaveBeenCalledTimes(1);
  });

  it("isolates a widget failure: logs it and never rethrows", async () => {
    notifyWidgetDataChanged.mockImplementationOnce(() => {
      throw new Error("widget down");
    });
    await expect(
      applyImportLifecycleEffects(exec, BOUND),
    ).resolves.toBeUndefined();
    expect(reconcileSchedule).toHaveBeenCalledTimes(1);
    expect(loggerError).toHaveBeenCalledTimes(1);
  });

  it("uses injected dependencies when given", async () => {
    const deps = {
      reconcileSchedule: vi.fn(async () => {}),
      notifyWidgetDataChanged: vi.fn(),
      readBirthdayUnboundEnabled: vi.fn(async () => false),
    };
    await applyImportLifecycleEffects(exec, BOUND, deps);
    expect(deps.reconcileSchedule).toHaveBeenCalledWith(exec);
    expect(deps.notifyWidgetDataChanged).toHaveBeenCalledTimes(1);
    expect(reconcileSchedule).not.toHaveBeenCalled();
  });
});

describe("applyImportLifecycleEffects — Unbound birthdays (D-58)", () => {
  it("reschedules birthdays when 'Birthday alerts for Unbound contacts' is on", async () => {
    getAppSettings.mockResolvedValue({ birthdayUnboundEnabled: 1 });
    await applyImportLifecycleEffects(exec, UNBOUND);
    expect(getAppSettings).toHaveBeenCalledWith(exec);
    expect(reconcileSchedule).toHaveBeenCalledTimes(1);
    expect(reconcileSchedule).toHaveBeenCalledWith(exec);
    // The widget shows Favorites; an Unbound import does not refresh it.
    expect(notifyWidgetDataChanged).not.toHaveBeenCalled();
  });

  it("does nothing when the Unbound birthday setting is off", async () => {
    getAppSettings.mockResolvedValue({ birthdayUnboundEnabled: 0 });
    await applyImportLifecycleEffects(exec, UNBOUND);
    expect(reconcileSchedule).not.toHaveBeenCalled();
    expect(notifyWidgetDataChanged).not.toHaveBeenCalled();
  });

  it("logs and skips when the setting cannot be read, never rethrows", async () => {
    getAppSettings.mockRejectedValueOnce(new Error("settings down"));
    await expect(
      applyImportLifecycleEffects(exec, UNBOUND),
    ).resolves.toBeUndefined();
    expect(reconcileSchedule).not.toHaveBeenCalled();
    expect(loggerError).toHaveBeenCalledTimes(1);
  });

  it("runs nothing when the import created no contacts of either kind", async () => {
    await applyImportLifecycleEffects(exec, {
      anyBound: false,
      anyUnbound: false,
    });
    expect(getAppSettings).not.toHaveBeenCalled();
    expect(reconcileSchedule).not.toHaveBeenCalled();
    expect(notifyWidgetDataChanged).not.toHaveBeenCalled();
  });
});
