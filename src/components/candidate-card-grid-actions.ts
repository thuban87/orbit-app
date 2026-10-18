/**
 * Shared by the action-sheet render and its execution path. Keeping this free
 * of React Native lets the live-selection safety seam be unit tested in Node.
 * Generic over the action union: the grid and Review matches each own theirs.
 */
export function isBulkActionAvailable<A, T>(
  action: A,
  selectedItems: readonly T[],
  isActionEligible?: (action: A, selectedItems: readonly T[]) => boolean,
): boolean {
  return isActionEligible ? isActionEligible(action, selectedItems) : true;
}
