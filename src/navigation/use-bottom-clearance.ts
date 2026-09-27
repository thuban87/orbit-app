import { useMeasuredTabBarHeight } from "@/stores/tab-bar-layout-store";
import { SPACING } from "@/theme/tokens/spacing";

export const FAB_SIZE = 56;
/** The FAB's gap above the tab bar (16): the `SPACING.base` token (38.4 D-52). */
export const FAB_EDGE_GAP = SPACING.base;

/**
 * Scroll-content clearance derived from the rendered tab bar and the shell FAB.
 * The rendered bar already accounts for the platform's navigation-area inset.
 */
export function useBottomClearance(extraForFab = true): number {
  const tabBarHeight = useMeasuredTabBarHeight();

  return tabBarHeight + (extraForFab ? FAB_SIZE + FAB_EDGE_GAP : 0);
}
