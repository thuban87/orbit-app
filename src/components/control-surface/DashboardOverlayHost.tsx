import { useCallback } from "react";
import { AnchoredPanel } from "./AnchoredPanel";
import {
  dashboardPanelStore,
  dismissDashboardPanel,
} from "./dashboard-panel-store";

// The store moved to ./dashboard-panel-store (RG-020); re-exported so existing
// imports keep compiling.
export {
  type DashboardPanelRequest,
  dashboardPanelStore,
} from "./dashboard-panel-store";

/** Root-level host so the in-tree scrim covers both the app bar and the list. */
export function DashboardOverlayHost() {
  const request = dashboardPanelStore((state) => state.request);
  // Stable identity so AnchoredPanel's focus/transient effect does not re-arm
  // (and re-steal accessibility focus) on every content-refresh re-render (WR-01).
  // Delegates to dismissDashboardPanel, which reads the latest request via
  // getState() and captures it BEFORE clearing (react-native/AUD-RN-001).
  const dismiss = useCallback(() => {
    dismissDashboardPanel();
  }, []);

  if (!request) return null;

  return (
    <AnchoredPanel
      anchorRect={request.anchorRect}
      size={request.size}
      visible
      onDismiss={dismiss}
    >
      {request.content}
    </AnchoredPanel>
  );
}
