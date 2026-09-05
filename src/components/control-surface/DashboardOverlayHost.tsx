import { type ReactNode, useCallback } from "react";
import { create } from "zustand";
import { AnchoredPanel, type PanelSize } from "./AnchoredPanel";
import type { AnchorRect } from "./anchor-position";

export interface DashboardPanelRequest {
  id: string;
  anchorRect: AnchorRect;
  size: PanelSize;
  content: ReactNode;
  onDismiss: () => void;
}

interface DashboardPanelStore {
  request: DashboardPanelRequest | null;
  open: (request: DashboardPanelRequest) => void;
  close: () => void;
}

export const dashboardPanelStore = create<DashboardPanelStore>()((set) => ({
  request: null,
  open: (request) => set({ request }),
  close: () => set({ request: null }),
}));

/** Root-level host so the in-tree scrim covers both the app bar and the list. */
export function DashboardOverlayHost() {
  const request = dashboardPanelStore((state) => state.request);
  // Stable identity so AnchoredPanel's focus/transient effect does not re-arm
  // (and re-steal accessibility focus) on every content-refresh re-render (WR-01).
  // Reads the latest request via getState() rather than closing over `request`.
  const dismiss = useCallback(() => {
    dashboardPanelStore.getState().close();
    dashboardPanelStore.getState().request?.onDismiss();
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
