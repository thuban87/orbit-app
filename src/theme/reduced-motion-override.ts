/**
 * ORRERY LAB B (experiment/orrery-skia-unleashed) — a session-only override of
 * the OS reduced-motion signal, driven by the Lab B debug panel so reduced
 * motion can be forced on/off without opening Android settings.
 *
 * Plain module (no react-native / reanimated imports) so it is import-safe in
 * every node test. `null` = follow the OS (the production behaviour); nothing
 * outside the lab panel ever calls the setter, so the real app is unaffected.
 */
type Listener = () => void;

let override: boolean | null = null;
const listeners = new Set<Listener>();

/** Current lab override: true/false forces, null follows the OS. */
export function getReducedMotionOverride(): boolean | null {
  return override;
}

/** Set (or clear with null) the lab override and notify every live consumer. */
export function setReducedMotionOverride(value: boolean | null): void {
  if (override === value) return;
  override = value;
  for (const listener of listeners) listener();
}

/** Subscribe to override changes; returns the unsubscribe function. */
export function subscribeReducedMotionOverride(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The effective value: the override when set, otherwise the OS value. */
export function resolveReducedMotion(os: boolean): boolean {
  return override ?? os;
}
