import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { shellTransientStore } from "@/stores/shell-transient-store";
import {
  DASHBOARD_PANEL_TRANSIENT_ID,
  type DashboardPanelRequest,
  dashboardPanelFocusEffect,
  dashboardPanelStore,
  dismissDashboardPanel,
  selectPanelOpen,
} from "./dashboard-panel-store";

function request(
  id: string,
  onDismiss: () => void = () => {},
): DashboardPanelRequest {
  return {
    id,
    anchorRect: { x: 0, y: 0, width: 80, height: 44 },
    size: "medium",
    content: null,
    onDismiss,
  };
}

const open = (next: DashboardPanelRequest) =>
  dashboardPanelStore.getState().open(next);
const isOpen = () => selectPanelOpen(dashboardPanelStore.getState());

describe("dismissDashboardPanel (react-native/AUD-RN-001)", () => {
  afterEach(() => {
    dashboardPanelStore.getState().close();
  });

  it("runs the owner's onDismiss exactly once and clears the request", () => {
    const onDismiss = vi.fn();
    open(request("dashboard-population", onDismiss));
    expect(isOpen()).toBe(true);

    dismissDashboardPanel();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(dashboardPanelStore.getState().request).toBeNull();
    expect(isOpen()).toBe(false);
  });

  it("is a harmless no-op when no panel is open", () => {
    expect(() => dismissDashboardPanel()).not.toThrow();
    expect(dashboardPanelStore.getState().request).toBeNull();
    expect(isOpen()).toBe(false);
  });

  it("invokes only the latest request's handler after a content-refresh replacement", () => {
    const first = vi.fn();
    const replacement = vi.fn();
    const original = request("dashboard-filters", first);
    open(original);
    // The content-refresh effects re-open with `...request` and fresh content.
    open({ ...original, content: "refreshed", onDismiss: replacement });
    expect(isOpen()).toBe(true);

    dismissDashboardPanel();

    expect(replacement).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(isOpen()).toBe(false);
  });

  it("reports open while any panel is presented and closed after each dismissal", () => {
    for (const id of [
      "dashboard-population",
      "dashboard-filters",
      "dashboard-sort",
    ]) {
      const onDismiss = vi.fn();
      open(request(id, onDismiss));
      expect(isOpen()).toBe(true);
      dismissDashboardPanel();
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(isOpen()).toBe(false);
    }
  });

  it("stays single-invocation when the owner handler itself closes the store", () => {
    // The real DashboardControlRow owner dismissal is a plain close().
    const onDismiss = vi.fn(() => dashboardPanelStore.getState().close());
    open(request("dashboard-sort", onDismiss));

    dismissDashboardPanel();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(dashboardPanelStore.getState().request).toBeNull();
    expect(isOpen()).toBe(false);
  });
});

/**
 * D-62 (owner, 2026-09-27): an open Contacts control panel closes when the
 * Contacts screen loses focus. Before this, the panel's open state (a global
 * store) and its shell-transient entry survived a tab switch, so the hidden
 * panel swallowed the first Back or active-tab re-tap on the other tab
 * (both route through `shellTransientStore.dismissTop()`).
 */
describe("dashboardPanelFocusEffect (D-62: close on blur)", () => {
  afterEach(() => {
    dashboardPanelStore.getState().close();
    shellTransientStore.setState({ entries: [] });
  });

  /** What AnchoredPanel registers while a panel is presented. */
  const presentPanel = (id: string, onDismiss: () => void) => {
    open(request(id, onDismiss));
    shellTransientStore
      .getState()
      .openTransient(DASHBOARD_PANEL_TRANSIENT_ID, () =>
        dismissDashboardPanel(),
      );
  };

  it.each(["dashboard-population", "dashboard-filters", "dashboard-sort"])(
    "blur closes the open %s panel and releases its Back entry",
    (id) => {
      const onDismiss = vi.fn(() => dashboardPanelStore.getState().close());
      const onBlur = dashboardPanelFocusEffect();
      presentPanel(id, onDismiss);
      expect(isOpen()).toBe(true);
      expect(shellTransientStore.getState().isAnyOpen()).toBe(true);

      onBlur();

      expect(isOpen()).toBe(false);
      expect(onDismiss).toHaveBeenCalledTimes(1);
      // The other tab's first Back / re-tap is no longer consumed by the panel.
      expect(shellTransientStore.getState().isAnyOpen()).toBe(false);
      expect(shellTransientStore.getState().dismissTop()).toBe(false);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    },
  );

  it("is a no-op on blur with no panel open and leaves other transients alone", () => {
    const fabDismiss = vi.fn();
    shellTransientStore.getState().openTransient("universal-fab", fabDismiss);

    dashboardPanelFocusEffect()();

    expect(isOpen()).toBe(false);
    expect(shellTransientStore.getState().entries).toEqual([
      { id: "universal-fab", dismiss: fabDismiss },
    ]);
    expect(fabDismiss).not.toHaveBeenCalled();
  });

  it("does not reopen anything on re-focus (the panel stays closed on return)", () => {
    presentPanel("dashboard-filters", vi.fn());
    const onBlur = dashboardPanelFocusEffect();
    onBlur();

    // Returning to Contacts runs the focus effect again.
    dashboardPanelFocusEffect();

    expect(isOpen()).toBe(false);
    expect(shellTransientStore.getState().isAnyOpen()).toBe(false);
  });

  it("is wired into HomeScreen's focus lifecycle", () => {
    const home = readFileSync(
      join(__dirname, "..", "..", "screens", "HomeScreen.tsx"),
      "utf8",
    );
    expect(home).toContain("useFocusEffect(dashboardPanelFocusEffect)");
  });

  it("AnchoredPanel registers under the shared transient id", () => {
    const panel = readFileSync(join(__dirname, "AnchoredPanel.tsx"), "utf8");
    expect(panel).toContain("DASHBOARD_PANEL_TRANSIENT_ID");
    expect(panel).not.toContain('"dashboard-panel"');
  });
});
