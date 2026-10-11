/**
 * Snackbar host selection and geometry (38.9 D-40, D-51). Pure logic, unit
 * tested in `snackbar-host.test.ts`; `Snackbar.tsx` renders from it.
 *
 * Every overlay window (BaseOverlay and each `RegisteredModal`) renders its own
 * `<Snackbar host={id} />`, and `App.tsx` renders the root `<Snackbar />`
 * (host "root"). Only ONE host renders at a time: the topmost registered
 * overlay window, or the root host when no overlay is open. That keeps the
 * single snackbar visible above the sheet or dialog that fired it, with one
 * live-region announcement.
 */
import { SPACING } from "@/theme/tokens/spacing";

/** The host id of the App.tsx snackbar, outside every overlay window. */
export const ROOT_SNACKBAR_HOST = "root";

/**
 * Root host bottom padding: clears the tab bar and the universal + (the value
 * the single root snackbar has always used).
 */
export const ROOT_SNACKBAR_BOTTOM_PADDING = 112;

/** Whether the snackbar host `host` renders, given the topmost overlay id. */
export function resolveSnackbarHostVisible(
  host: string,
  topOverlayId: string | null,
): boolean {
  if (host === ROOT_SNACKBAR_HOST) return topOverlayId === null;
  return topOverlayId === host;
}

/**
 * Bottom padding for a host. Inside an overlay window there is no tab bar or
 * +, so the snackbar sits just above the system navigation bar (D-51); every
 * Modal window is edge-to-edge, so the nav-bar inset is added explicitly.
 */
export function snackbarBottomPadding(
  host: string,
  insetBottom: number,
): number {
  if (host === ROOT_SNACKBAR_HOST) return ROOT_SNACKBAR_BOTTOM_PADDING;
  return insetBottom + SPACING.base;
}
