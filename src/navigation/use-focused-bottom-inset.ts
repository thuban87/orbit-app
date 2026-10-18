import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * The bottom padding a focused-workflow screen's root needs (38.12 DEF-01).
 *
 * A focused workflow hides the tab bar (`isFocusedWorkflow`), and the shell's
 * SafeAreaView pads only the top edge, so the screen's root reaches the
 * window's bottom, under the system navigation bar. On 3-button navigation
 * that bar is opaque and tall: a Done button pinned to the bottom, or the last
 * control at full scroll, sat behind it. Each focused screen pads its root by
 * the bottom safe-area inset (the convention its sheets, Restore pages and
 * section FAB already follow; the shell is left alone so those are not
 * padded twice).
 */
export function useFocusedBottomInset(): number {
  return useSafeAreaInsets().bottom;
}
