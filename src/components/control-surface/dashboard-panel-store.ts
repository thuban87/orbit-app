/**
 * The single owner of Dashboard control-panel open state (RG-020).
 *
 * Presentation (`DashboardOverlayHost`) and Home's background inertness both
 * read THIS store, so they cannot desync: Home derives `panelOpen` with
 * `selectPanelOpen` instead of mirroring it in component state.
 *
 * Kept free of `react-native` (type-only imports) so the dismissal contract is
 * node-testable.
 */
import type { ReactNode } from "react";
import { create } from "zustand";
import type { PanelSize } from "./AnchoredPanel";
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

/** True while any Dashboard panel is presented. */
export const selectPanelOpen = (state: DashboardPanelStore): boolean =>
  state.request !== null;

/**
 * Dismiss the presented panel and run its owner's handler exactly once.
 *
 * Captures the request BEFORE clearing it: reading `getState().request` after
 * `close()` always yields null, which silently skipped the owner's dismissal
 * and left Home inert (react-native/AUD-RN-001). Every dismissal path — scrim
 * tap and Android Back (shell transient) via the host — routes here.
 */
export function dismissDashboardPanel(): void {
  const current = dashboardPanelStore.getState().request;
  dashboardPanelStore.getState().close();
  current?.onDismiss();
}
