import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SqlExecutor } from "@/db/types";

const { reconcileSchedule, notifyWidgetDataChanged, loggerError } = vi.hoisted(
  () => ({
    reconcileSchedule: vi.fn(async () => {}),
    notifyWidgetDataChanged: vi.fn(),
    loggerError: vi.fn(),
  }),
);

vi.mock("@/services/notifications/notification-schedule", () => ({
  reconcileSchedule,
}));
vi.mock("@/services/widget/widget-refresh", () => ({
  notifyWidgetDataChanged,
}));
vi.mock("@/utils/logger", () => ({
  Logger: { error: loggerError, warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { applyBoundImportEffects } from "./import-lifecycle-effects";

const exec = {} as SqlExecutor;

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * 38.4 D-57: after an import that created Bound contacts, reminders and the
 * widget refresh once, best-effort, post-commit — never failing the import.
 */
describe("applyBoundImportEffects (D-57)", () => {
  it("reconciles the schedule, then refreshes the widget, once each", async () => {
    await applyBoundImportEffects(exec);
    expect(reconcileSchedule).toHaveBeenCalledTimes(1);
    expect(reconcileSchedule).toHaveBeenCalledWith(exec);
    expect(notifyWidgetDataChanged).toHaveBeenCalledTimes(1);
    expect(reconcileSchedule.mock.invocationCallOrder[0]).toBeLessThan(
      notifyWidgetDataChanged.mock.invocationCallOrder[0],
    );
  });

  it("isolates a schedule failure: logs it, still refreshes the widget, never rethrows", async () => {
    reconcileSchedule.mockRejectedValueOnce(new Error("schedule down"));
    await expect(applyBoundImportEffects(exec)).resolves.toBeUndefined();
    expect(notifyWidgetDataChanged).toHaveBeenCalledTimes(1);
    expect(loggerError).toHaveBeenCalledTimes(1);
  });

  it("isolates a widget failure: logs it and never rethrows", async () => {
    notifyWidgetDataChanged.mockImplementationOnce(() => {
      throw new Error("widget down");
    });
    await expect(applyBoundImportEffects(exec)).resolves.toBeUndefined();
    expect(reconcileSchedule).toHaveBeenCalledTimes(1);
    expect(loggerError).toHaveBeenCalledTimes(1);
  });

  it("uses injected dependencies when given", async () => {
    const deps = {
      reconcileSchedule: vi.fn(async () => {}),
      notifyWidgetDataChanged: vi.fn(),
    };
    await applyBoundImportEffects(exec, deps);
    expect(deps.reconcileSchedule).toHaveBeenCalledWith(exec);
    expect(deps.notifyWidgetDataChanged).toHaveBeenCalledTimes(1);
    expect(reconcileSchedule).not.toHaveBeenCalled();
  });
});
