import { useMeasuredTabBarHeight } from "@/stores/tab-bar-layout-store";
import { SPACING } from "@/theme/tokens/spacing";

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
 * Scroll-content clearance derived from the rendered tab bar and the shell FAB.
 * The rendered bar already accounts for the platform's navigation-area inset.
 */
export function useBottomClearance(extraForFab = true): number {
  const tabBarHeight = useMeasuredTabBarHeight();

  return tabBarHeight + (extraForFab ? FAB_SIZE + FAB_EDGE_GAP : 0);
}
