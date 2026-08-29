import { describe, expect, it, vi } from "vitest";
import type { SqlExecutor } from "@/db/types";

vi.mock("@/services/notifications/notification-schedule", () => ({
  reconcileSchedule: vi.fn(),
}));
vi.mock("@/services/widget/widget-refresh", () => ({
  notifyWidgetDataChanged: vi.fn(),
}));

import {
  applyLifecycleTransitionEffects,
  bindWithLifecycleEffects,
  unbindWithLifecycleEffects,
} from "./contact-lifecycle-effects";

const exec = {} as SqlExecutor;
const now = "2026-08-29 00:00:00";

function deps() {
  return {
    bindContact: vi.fn(async () => {}),
    unbindContact: vi.fn(async () => {}),
    reconcileSchedule: vi.fn(async () => {}),
    notifyWidgetDataChanged: vi.fn(),
    reportError: vi.fn(),
  };
}

describe("lifecycle transition effects", () => {
  it("unbinds once, then reconciles and refreshes exactly once", async () => {
    const d = deps();
    await unbindWithLifecycleEffects(exec, 7, now, d);

    expect(d.unbindContact).toHaveBeenCalledTimes(1);
    expect(d.reconcileSchedule).toHaveBeenCalledWith(exec);
    expect(d.notifyWidgetDataChanged).toHaveBeenCalledTimes(1);
    expect(d.unbindContact.mock.invocationCallOrder[0]).toBeLessThan(
      d.reconcileSchedule.mock.invocationCallOrder[0],
    );
  });

  it("binds once, then re-arms schedule and refreshes exactly once", async () => {
    const d = deps();
    await bindWithLifecycleEffects(exec, 7, now, 14, d);

    expect(d.bindContact).toHaveBeenCalledWith(exec, 7, now, 14);
    expect(d.reconcileSchedule).toHaveBeenCalledWith(exec);
    expect(d.notifyWidgetDataChanged).toHaveBeenCalledTimes(1);
    expect(d.bindContact.mock.invocationCallOrder[0]).toBeLessThan(
      d.reconcileSchedule.mock.invocationCallOrder[0],
    );
  });

  it("runs effects without a DAO call for an already-transitioned edit save", async () => {
    const d = deps();
    await applyLifecycleTransitionEffects(7, "unbind", { exec, ...d });

    expect(d.bindContact).not.toHaveBeenCalled();
    expect(d.unbindContact).not.toHaveBeenCalled();
    expect(d.reconcileSchedule).toHaveBeenCalledWith(exec);
    expect(d.notifyWidgetDataChanged).toHaveBeenCalledTimes(1);
  });

  it.each(["bind", "unbind"] as const)(
    "isolates %s effect failures after the durable transition",
    async (direction) => {
      const d = deps();
      d.reconcileSchedule.mockRejectedValueOnce(new Error("schedule failed"));
      d.notifyWidgetDataChanged.mockImplementationOnce(() => {
        throw new Error("widget failed");
      });

      if (direction === "bind") {
        await bindWithLifecycleEffects(exec, 7, now, 14, d);
        expect(d.bindContact).toHaveBeenCalledTimes(1);
      } else {
        await unbindWithLifecycleEffects(exec, 7, now, d);
        expect(d.unbindContact).toHaveBeenCalledTimes(1);
      }

      expect(d.reportError).toHaveBeenCalledTimes(2);
    },
  );
});
