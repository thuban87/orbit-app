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
import { shellTransientStore } from "@/stores/shell-transient-store";
import type { PanelSize } from "./AnchoredPanel";
import type { AnchorRect } from "./anchor-position";

/** The shell-transient id AnchoredPanel registers while a panel is presented. */
export const DASHBOARD_PANEL_TRANSIENT_ID = "dashboard-panel";

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

/**
 * Close any open panel because the Contacts screen lost focus (owner ruling
 * D-62). The panel's open state lives in this global store and its Back entry
 * in the shell-transient registry, so both would otherwise survive a tab
 * switch: the hidden panel would swallow the first Back or active-tab re-tap
 * on the other tab. Runs the owner's dismissal like every other path, then
 * releases the transient entry directly so the release does not depend on the
 * blurred screen re-rendering its host. Live-apply, one panel at a time, the
 * floating non-modal panel and transient-first Back are unchanged (ADR-095);
 * query state is untouched (ADR-092).
 */
export function closeDashboardPanelOnBlur(): void {
  dismissDashboardPanel();
  shellTransientStore.getState().closeTransient(DASHBOARD_PANEL_TRANSIENT_ID);
}

/**
 * `useFocusEffect` callback for HomeScreen (D-62): nothing to do on focus; the
 * returned cleanup runs on blur and on unmount. Module-level, so its identity
 * is stable and the effect never re-runs while focused.
 */
export function dashboardPanelFocusEffect(): () => void {
  return closeDashboardPanelOnBlur;
}
