import { describe, expect, it, vi } from "vitest";
import { resolvePalette } from "@/theme/theme-presets";
import {
  createQuickLogUndoController,
  dialFocusCycle,
  FAB_BORDER_COLOR_KEY,
  FAB_BORDER_WIDTH,
  FAB_DIAL_TRANSIENT_ID,
  fabDialBackgroundA11y,
  getFocusedContactContext,
  resolveFabContactContext,
  resolveFabTarget,
  selectFabDialOpen,
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

describe("FAB border tunables (D-56, OA-C2; supersedes D-45)", () => {
  it("rings the FAB at 2dp in the onAccent role colour", () => {
    expect(FAB_BORDER_WIDTH).toBe(2);
    expect(FAB_BORDER_COLOR_KEY).toBe("onAccent");
  });

  it("names a palette key that resolves in every package and mode", () => {
    for (const pkg of ["galaxy", "standard"] as const) {
      for (const mode of ["dark", "light"] as const) {
        const palette = resolvePalette(pkg, mode);
        expect(Object.keys(palette)).toContain(FAB_BORDER_COLOR_KEY);
        expect(typeof palette[FAB_BORDER_COLOR_KEY]).toBe("string");
      }
    }
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
      "EventsTab",
      "DigestTab",
      "OrreryTab",
      "SettingsTab",
    ]) {
      expect(
        getFocusedContactContext({ index: 0, routes: [{ name }] }),
      ).toEqual({ originContactId: null });
    }
  });

  it.each(["DigestTab", "EventsTab"])(
    "finds a Profile contact opened inside %s",
    (name) => {
      expect(
        getFocusedContactContext({
          index: 0,
          routes: [
            {
              name,
              state: {
                index: 1,
                routes: [
                  { name: name === "DigestTab" ? "Digest" : "GroupEvents" },
                  { name: "Profile", params: { contactId: 12 } },
                ],
              },
            },
          ],
        }),
      ).toEqual({ originContactId: 12 });
    },
  );

  // RG-021 / react-native/AUD-RN-004 (D-24): Settings hosts Profile
  // (Settings → Archived → Profile), so it preselects like the other tabs.
  it("finds a Profile contact opened inside SettingsTab", () => {
    expect(
      getFocusedContactContext({
        index: 0,
        routes: [
          {
            name: "SettingsTab",
            state: {
              index: 2,
              routes: [
                { name: "Settings" },
                { name: "Archived" },
                { name: "Profile", params: { contactId: 12 } },
              ],
            },
          },
        ],
      }),
    ).toEqual({ originContactId: 12 });
  });

  it("returns no contact from the Settings hub or a non-Profile Settings child", () => {
    expect(
      getFocusedContactContext({
        index: 0,
        routes: [
          {
            name: "SettingsTab",
            state: { index: 0, routes: [{ name: "Settings" }] },
          },
        ],
      }),
    ).toEqual({ originContactId: null });
    expect(
      getFocusedContactContext({
        index: 0,
        routes: [
          {
            name: "SettingsTab",
            state: {
              index: 1,
              routes: [{ name: "Settings" }, { name: "Backup" }],
            },
          },
        ],
      }),
    ).toEqual({ originContactId: null });
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

describe("resolveFabContactContext — an archived contact is never FAB context (38.3 review A-WR-07, owner ruling D-29)", () => {
  it("drops an archived focused Profile so every action falls back to the picker flows", async () => {
    const context = await resolveFabContactContext(
      { originContactId: 7 },
      async () => ({ archived: true }),
    );
    expect(context).toEqual({ originContactId: null });
    expect(resolveFabTarget("QuickLog", context)).toEqual({
      kind: "quick-log",
      contactId: null,
    });
    expect(resolveFabTarget("LogContact", context)).toEqual({
      kind: "pick-then",
      screen: "LogContact",
    });
  });

  it("keeps a live contact's context (including a Settings-hosted Profile)", async () => {
    await expect(
      resolveFabContactContext({ originContactId: 7 }, async () => ({
        archived: false,
      })),
    ).resolves.toEqual({ originContactId: 7 });
  });

  it("drops a contact that no longer exists", async () => {
    await expect(
      resolveFabContactContext({ originContactId: 7 }, async () => null),
    ).resolves.toEqual({ originContactId: null });
  });

  it("fails safe to no context when the archive read fails", async () => {
    await expect(
      resolveFabContactContext({ originContactId: 7 }, () =>
        Promise.reject(new Error("read")),
      ),
    ).resolves.toEqual({ originContactId: null });
  });

  it("does not read when there is no focused contact", async () => {
    const read = vi.fn();
    await expect(
      resolveFabContactContext({ originContactId: null }, read),
    ).resolves.toEqual({ originContactId: null });
    expect(read).not.toHaveBeenCalled();
  });
});

describe("selectFabDialOpen (D-31)", () => {
  it("keeps the dial's transient id stable, so an open entry keeps working", () => {
    expect(FAB_DIAL_TRANSIENT_ID).toBe("fab-speed-dial");
  });

  it("is false with no shell transient open", () => {
    expect(selectFabDialOpen({ entries: [] })).toBe(false);
  });

  it("is true while the dial's entry is registered, at any layer", () => {
    expect(
      selectFabDialOpen({ entries: [{ id: FAB_DIAL_TRANSIENT_ID }] }),
    ).toBe(true);
    expect(
      selectFabDialOpen({
        entries: [{ id: FAB_DIAL_TRANSIENT_ID }, { id: "contact-picker" }],
      }),
    ).toBe(true);
  });

  it("ignores other transients: only the dial hides the navigator", () => {
    // The dashboard panel keeps its own Home-scoped RG-020 inertness.
    expect(selectFabDialOpen({ entries: [{ id: "dashboard-panel" }] })).toBe(
      false,
    );
  });
});

describe("fabDialBackgroundA11y (D-31 follow-on, D-42 A)", () => {
  it("hides a same-window shell overlay from accessibility while the dial is open", () => {
    expect(fabDialBackgroundA11y(true)).toEqual({
      importantForAccessibility: "no-hide-descendants",
      accessibilityElementsHidden: true,
    });
  });

  it("restores the overlay once the dial closes", () => {
    expect(fabDialBackgroundA11y(false)).toEqual({
      importantForAccessibility: "auto",
      accessibilityElementsHidden: false,
    });
  });

  it("never sets accessible or pointerEvents (no merged node, touch unchanged)", () => {
    for (const open of [true, false]) {
      const props = fabDialBackgroundA11y(open);
      expect(Object.keys(props).sort()).toEqual([
        "accessibilityElementsHidden",
        "importantForAccessibility",
      ]);
    }
  });
});

describe("dialFocusCycle (D-31)", () => {
  // Dial order: FAB, then the rows from the one nearest the FAB upward.
  const fab = 10;
  const rows = [11, 12, 13, 14, 15, 16];

  it("links FAB -> row 1 -> ... -> row 6 -> FAB for keyboard TAB", () => {
    const cycle = dialFocusCycle(fab, rows);
    expect(cycle.fab.nextFocusForward).toBe(11);
    expect(cycle.rows.map((row) => row.nextFocusForward)).toEqual([
      12, 13, 14, 15, 16, 10,
    ]);
  });

  it("mirrors the cycle on the D-pad in visual stacking order (rows rise above the FAB)", () => {
    const cycle = dialFocusCycle(fab, rows);
    expect(cycle.fab.nextFocusUp).toBe(11);
    expect(cycle.fab.nextFocusDown).toBe(16);
    expect(cycle.rows.map((row) => row.nextFocusUp)).toEqual([
      12, 13, 14, 15, 16, 10,
    ]);
    expect(cycle.rows.map((row) => row.nextFocusDown)).toEqual([
      10, 11, 12, 13, 14, 15,
    ]);
  });

  it("leaves a link undefined when its target tag is unresolved", () => {
    const cycle = dialFocusCycle(null, [11, null, 13, 14, 15, 16]);
    // The FAB's own tag is unresolved, but its outgoing link targets row 1.
    expect(cycle.fab.nextFocusForward).toBe(11);
    expect(cycle.rows[0].nextFocusForward).toBeUndefined();
    expect(cycle.rows[0].nextFocusDown).toBeUndefined();
    expect(cycle.rows[5].nextFocusForward).toBeUndefined();
    expect(cycle.rows[2].nextFocusDown).toBeUndefined();
    expect(cycle.rows[2].nextFocusForward).toBe(14);
  });

  it("links nothing before any tag resolves", () => {
    const cycle = dialFocusCycle(null, []);
    expect(cycle.fab).toEqual({
      nextFocusForward: undefined,
      nextFocusUp: undefined,
      nextFocusDown: undefined,
    });
    expect(cycle.rows).toEqual([]);
  });
});
