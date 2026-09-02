import { useMeasuredTabBarHeight } from "@/stores/tab-bar-layout-store";

export const FAB_SIZE = 56;
export const FAB_EDGE_GAP = 16;

/**
 * Scroll-content clearance derived from the rendered tab bar and the shell FAB.
 * The rendered bar already accounts for the platform's navigation-area inset.
 */
export function useBottomClearance(extraForFab = true): number {
  const tabBarHeight = useMeasuredTabBarHeight();

  return tabBarHeight + (extraForFab ? FAB_SIZE + FAB_EDGE_GAP : 0);
}
