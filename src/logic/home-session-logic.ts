/**
 * Contacts (HomeScreen) Android Back priority (38.13 D-29). A pure module with
 * no UI-framework imports, so every branch is node-tested off-device.
 *
 * HomeScreen's `hardwareBackPress` listener is registered after the root
 * navigator's, and BackHandler calls the newest listener first. So Home runs
 * before the shell's transient-first handler and must defer to it explicitly
 * (ADR-095 :18, ADR-080 :18): an open Population / Filters / Sort panel, the
 * FAB dial or a picker is the shell's to dismiss. Only then does Home act:
 *
 *   (1) any shell transient open → "default"  (return false; the root listener
 *                                              dismisses the top transient)
 *   (2) selection mode           → "exit-selection" (ADR-102: Back exits
 *                                              selection first)
 *   (3) search open              → "close-search" (close and clear the search,
 *                                              through the same path as the
 *                                              search toggle)
 *   (4) otherwise                → "default"  (Back does what it did before)
 */

export type HomeBackAction = "default" | "exit-selection" | "close-search";

export interface HomeBackInput {
  /** `shellTransientStore.getState().isAnyOpen()` at the time of the press. */
  anyTransientOpen: boolean;
  /** The dashboard selection store's mode. */
  selectionMode: boolean;
  /** Whether the search row's input is open. */
  searchExpanded: boolean;
}

/** Resolve what one Android Back press does on Contacts. Pure; never throws. */
export function resolveHomeBack(input: HomeBackInput): HomeBackAction {
  if (input.anyTransientOpen) return "default";
  if (input.selectionMode) return "exit-selection";
  if (input.searchExpanded) return "close-search";
  return "default";
}
