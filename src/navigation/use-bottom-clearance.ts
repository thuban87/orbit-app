import { useMeasuredTabBarHeight } from "@/stores/tab-bar-layout-store";
import { SPACING } from "@/theme/tokens/spacing";

/**
 * Tunable (38.11 D-41): the gap between the end of a FAB-bearing screen's
 * scroll content and the top edge of the universal +. Without it the last
 * control (the Profile's Off Limits heading pencil, Settings → AI Data
 * Permissions' "Interaction notes" switch) ended flush against the +. Applies
 * to scroll clearance only; the FAB, the snackbar and the section Add FAB do
 * not move.
 */
export const FAB_CLEARANCE_MARGIN = SPACING.base;

export const FAB_SIZE = 56;
/** The FAB's gap above the tab bar (16): the `SPACING.base` token (38.4 D-52). */
export const FAB_EDGE_GAP = SPACING.base;
/**
 * The FAB's inset from the screen's side edge (20): the universal FAB's
 * `right`, and the section Add FAB's `left` on the opposite side (38.10 D-131).
 * The section FAB's scroll clearance is `useSectionFabClearance()` in
 * `components/SectionAddFab.tsx`: it reads the safe-area inset, and this file
 * stays importable by node tests (`fab-clearance-contract.test.ts`).
 */
export const FAB_SIDE_INSET = 20;

/**
 * The scroll-content clearance for a measured tab bar: with the + it is the
 * + top edge plus `FAB_CLEARANCE_MARGIN` (D-41); without it, the tab bar only.
 */
export function bottomClearanceFor(
  tabBarHeight: number,
  extraForFab: boolean,
): number {
  return (
    tabBarHeight +
    (extraForFab ? FAB_SIZE + FAB_EDGE_GAP + FAB_CLEARANCE_MARGIN : 0)
  );
}

/**
 * Scroll-content clearance derived from the rendered tab bar and the shell FAB.
 * The rendered bar already accounts for the platform's navigation-area inset.
 */
export function useBottomClearance(extraForFab = true): number {
  return bottomClearanceFor(useMeasuredTabBarHeight(), extraForFab);
}
