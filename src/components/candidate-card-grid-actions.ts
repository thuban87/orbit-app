import type { BulkAction } from "@/components/CandidateCardGrid";

/**
 * Shared by the action-sheet render and its execution path. Keeping this free
 * of React Native lets the live-selection safety seam be unit tested in Node.
 */
export function isBulkActionAvailable<T>(
  action: BulkAction,
  selectedItems: readonly T[],
  isActionEligible?: (action: BulkAction, selectedItems: readonly T[]) => boolean,
): boolean {
  return isActionEligible ? isActionEligible(action, selectedItems) : true;
}
