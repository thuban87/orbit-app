import type { ReactNode } from "react";
import { create } from "zustand";
import { type AnchorRect } from "./anchor-position";
import { AnchoredPanel, type PanelSize } from "./AnchoredPanel";

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
  if (!request) return null;

  const dismiss = () => {
    dashboardPanelStore.getState().close();
    request.onDismiss();
  };

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
