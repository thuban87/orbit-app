import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));
vi.mock("@/db/database", () => ({ localDateTime: () => "now" }));
vi.mock("@/services/notifications/notification-schedule", () => ({
  reconcileSchedule: vi.fn(),
}));
vi.mock("@/services/widget/widget-refresh", () => ({
  notifyWidgetDataChanged: vi.fn(),
}));
vi.mock("@/stores/snackbar-store", () => ({ showSnackbar: vi.fn() }));

import type { SqlExecutor } from "@/db/types";
import {
  type RestoreFromBinDeps,
  restoreFromBinWithUndo,
} from "./restore-from-bin";

/**
 * 38.12 D-154: the import review's Restore uses the Bin list's effects and
 * feedback (D-32, D-03): widget + schedule after the restore, "Restored
 * <name>" with Undo; Undo moves the person back with the same effects.
 */
function deps(
  restoreContact: RestoreFromBinDeps["restoreContact"] = vi.fn(async () => {}),
) {
  return {
    restoreContact: vi.fn(restoreContact),
    archiveContact: vi.fn(async (..._args: unknown[]) => {}),
    reconcileSchedule: vi.fn(async (..._args: unknown[]) => {}),
    notifyWidgetDataChanged: vi.fn(),
    showSnackbar: vi.fn(),
    now: () => "2026-10-17 12:00:00",
  };
}
const exec = "exec" as unknown as SqlExecutor;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("restoreFromBinWithUndo (D-154)", () => {
  it("restores with the widget and schedule effects and offers Undo", async () => {
    const d = deps();
    const onUndone = vi.fn();
    await expect(
      restoreFromBinWithUndo(exec, { contactId: 4, name: "Ada", onUndone }, d),
    ).resolves.toBe(true);
    expect(d.restoreContact).toHaveBeenCalledWith(
      exec,
      4,
      "2026-10-17 12:00:00",
    );
    expect(d.notifyWidgetDataChanged).toHaveBeenCalledOnce();
    expect(d.reconcileSchedule).toHaveBeenCalledOnce();
    const snackbar = d.showSnackbar.mock.calls[0][0];
    expect(snackbar).toMatchObject({ kind: "success", label: "Restored Ada" });
    snackbar.action.onPress();
    await flush();
    expect(d.archiveContact).toHaveBeenCalledWith(
      exec,
      4,
      "2026-10-17 12:00:00",
    );
    expect(d.notifyWidgetDataChanged).toHaveBeenCalledTimes(2);
    expect(d.reconcileSchedule).toHaveBeenCalledTimes(2);
    expect(d.showSnackbar.mock.calls[1][0]).toMatchObject({
      label: "Moved Ada back to the Bin",
    });
    expect(onUndone).toHaveBeenCalledOnce();
  });

  it("a failed restore reports it and runs no effects", async () => {
    const d = deps(async () => {
      throw new Error("not in the Bin");
    });
    await expect(
      restoreFromBinWithUndo(exec, { contactId: 4, name: "Ada" }, d),
    ).resolves.toBe(false);
    expect(d.notifyWidgetDataChanged).not.toHaveBeenCalled();
    expect(d.showSnackbar).toHaveBeenCalledWith({
      kind: "error",
      label: "Couldn't restore. Please try again.",
    });
  });
});
