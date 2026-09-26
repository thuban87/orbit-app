import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type DashboardPanelRequest,
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
