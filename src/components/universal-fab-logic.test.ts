import { describe, expect, it } from "vitest";
import {
  createQuickLogUndoController,
  getFocusedContactContext,
  resolveFabTarget,
  UNIVERSAL_FAB_ACTIONS,
} from "./universal-fab-logic";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("UNIVERSAL_FAB_ACTIONS", () => {
  it("locks the six shell actions to their prescribed order and labels", () => {
    expect(UNIVERSAL_FAB_ACTIONS).toHaveLength(6);
    expect(UNIVERSAL_FAB_ACTIONS).toEqual([
      { id: "AddContact", label: "Add Contact" },
      { id: "QuickLog", label: "Quick Log" },
      { id: "LogContact", label: "Log Interaction" },
      { id: "GroupLog", label: "Group Log" },
      { id: "UpdateContact", label: "Update Contact" },
      { id: "Memory", label: "Memory" },
    ]);
  });
});

describe("resolveFabTarget", () => {
  it("uses nested Dashboard tab targets instead of bare screen navigation", () => {
    expect(
      resolveFabTarget("AddContact", { originContactId: null }),
    ).toMatchObject({
      kind: "navigate",
      tab: "DashboardTab",
      screen: "Create",
    });
  });

  it("always routes Group Log directly, regardless of profile origin", () => {
    expect(resolveFabTarget("GroupLog", { originContactId: 7 })).toEqual({
      kind: "navigate",
      tab: "DashboardTab",
      screen: "GroupLog",
    });
    expect(resolveFabTarget("GroupLog", { originContactId: null })).toEqual({
      kind: "navigate",
      tab: "DashboardTab",
      screen: "GroupLog",
    });
  });

  it("preselects contact-specific actions from Profile and otherwise requests the picker", () => {
    for (const actionId of ["LogContact", "UpdateContact", "Memory"] as const) {
      expect(resolveFabTarget(actionId, { originContactId: 19 })).toEqual({
        kind: "navigate",
        tab: "DashboardTab",
        screen: actionId,
        params: { contactId: 19 },
      });
      expect(resolveFabTarget(actionId, { originContactId: null })).toEqual({
        kind: "pick-then",
        screen: actionId,
      });
    }
  });

  it("keeps Quick Log's contact context for its picker/write seam", () => {
    expect(resolveFabTarget("QuickLog", { originContactId: 19 })).toEqual({
      kind: "quick-log",
      contactId: 19,
    });
    expect(resolveFabTarget("QuickLog", { originContactId: null })).toEqual({
      kind: "quick-log",
      contactId: null,
    });
  });
});

describe("createQuickLogUndoController", () => {
  it("accepts a replacement snackbar Undo while an earlier delete is pending", async () => {
    const firstDelete = deferred<void>();
    const secondDelete = deferred<void>();
    const received: Array<{ contactId: number; interactionId: number }> = [];
    const controller = createQuickLogUndoController((request) => {
      received.push(request);
      return request.interactionId === 101
        ? firstDelete.promise
        : secondDelete.promise;
    });

    const firstUndo = controller.undo({ contactId: 11, interactionId: 101 });
    const secondUndo = controller.undo({ contactId: 22, interactionId: 202 });

    expect(firstUndo).not.toBeNull();
    expect(secondUndo).not.toBeNull();
    expect(received).toEqual([
      { contactId: 11, interactionId: 101 },
      { contactId: 22, interactionId: 202 },
    ]);
    expect(controller.undo({ contactId: 22, interactionId: 202 })).toBeNull();

    firstDelete.resolve();
    secondDelete.resolve();
    await Promise.all([firstUndo, secondUndo]);
  });
});

describe("getFocusedContactContext", () => {
  it("finds a Dashboard Profile contact", () => {
    expect(
      getFocusedContactContext({
        index: 0,
        routes: [
          {
            name: "DashboardTab",
            state: {
              index: 1,
              routes: [
                { name: "Home" },
                { name: "Profile", params: { contactId: 4 } },
              ],
            },
          },
        ],
      }),
    ).toEqual({ originContactId: 4 });
  });

  it("finds an Orrery Profile contact", () => {
    expect(
      getFocusedContactContext({
        index: 0,
        routes: [
          {
            name: "OrreryTab",
            state: {
              index: 1,
              routes: [
                { name: "Orrery" },
                { name: "Profile", params: { contactId: 8 } },
              ],
            },
          },
        ],
      }),
    ).toEqual({ originContactId: 8 });
  });

  it("returns no contact from root-tab browse surfaces", () => {
    for (const name of [
      "DashboardTab",
      "OrreryTab",
      "BackupTab",
      "SettingsTab",
    ]) {
      expect(
        getFocusedContactContext({ index: 0, routes: [{ name }] }),
      ).toEqual({ originContactId: null });
    }
  });

  it("is defensive around stale or malformed state", () => {
    expect(getFocusedContactContext(undefined)).toEqual({
      originContactId: null,
    });
    expect(getFocusedContactContext({ routes: [] })).toEqual({
      originContactId: null,
    });
    expect(
      getFocusedContactContext({
        index: 0,
        routes: [
          {
            name: "DashboardTab",
            state: { index: 0, routes: [{ name: "Profile" }] },
          },
        ],
      }),
    ).toEqual({ originContactId: null });
  });
});
