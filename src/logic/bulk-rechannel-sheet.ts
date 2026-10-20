/**
 * The bulk Quick Log "Edit" sheet's open target (38.14 D-62; review A-WR-02).
 *
 * Snackbar actions are exclusive: tapping "Edit" dismisses the snackbar and
 * with it the batch's Undo. When the sheet then closes WITHOUT a pick, the
 * screen re-shows the batch's Undo · Edit snackbar, so a cancel never turns a
 * reversible bulk write into an irreversible one.
 *
 * `OptionSheet` calls `onSelect` and then `onRequestClose` for a pick, in the
 * same tick. Whichever handler `take()`s the target first owns it, so the close
 * that follows a pick finds nothing and does not re-show the snackbar.
 *
 * Node-testable by construction: no react-native, store or database import.
 */
export interface RechannelSheetState<T> {
  /** "Edit" was tapped: hold this batch while its sheet is open. */
  open(target: T): void;
  /** Take the held batch (a pick, or a cancel), or null when none is held. */
  take(): T | null;
}

export function createRechannelSheetState<T>(): RechannelSheetState<T> {
  let held: T | null = null;
  return {
    open(target) {
      held = target;
    },
    take() {
      const target = held;
      held = null;
      return target;
    },
  };
}
