/**
 * Keep a sheet's last target on screen while the sheet animates closed (38.11
 * review IN-06). Hosts null their target in `onClose`, before the close
 * animation ends; display props read the retained value instead, so a closing
 * sheet keeps its title rather than flashing "Snooze " or "Snooze 0
 * contacts". `visible` and every action must still read the live value, so
 * nothing can act on a target the host has already let go of.
 */
import { useRef } from "react";

/** The live value, or the last non-null one once it clears. */
export function retainWhileClosing<T>(previous: T | null, value: T | null) {
  return value ?? previous;
}

export function useRetainedWhileClosing<T>(value: T | null): T | null {
  const retained = useRef<T | null>(null);
  retained.current = retainWhileClosing(retained.current, value);
  return retained.current;
}
