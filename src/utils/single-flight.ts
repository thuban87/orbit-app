/**
 * Synchronous single-flight guard (Phase 34 review WR-01/02/03).
 *
 * A React `saving` state flag cannot prevent a double-submit: `setSaving(true)`
 * is asynchronous, so two taps dispatched before the re-render commits both read
 * `saving === false`, both pass the guard, and both run the write — recording two
 * rows for one intended action (a duplicate interaction / Memory / off-limits
 * INSERT that then needs manual cleanup). A `useRef(false)` flag flips
 * SYNCHRONOUSLY within the same tick, closing that window.
 *
 * This mirrors the established pattern already used by
 * `services/quick-log-command.ts` (`pendingRef`) and
 * `components/PostLogNoteEditor.tsx` (`savingRef`); it is factored here so every
 * capture surface shares one node-tested guard rather than re-implementing it.
 * The React `saving` state can remain for disabled/UI styling — the ref is what
 * guarantees write-once.
 */
export interface InFlightRef {
  current: boolean;
}

/**
 * Try to claim the in-flight slot. Returns `true` and marks the ref in-flight
 * when it was free; returns `false` when a call is already in flight (the caller
 * must bail without writing). Synchronous: two calls in the same tick can never
 * both return `true`.
 */
export function beginInFlight(ref: InFlightRef): boolean {
  if (ref.current) return false;
  ref.current = true;
  return true;
}

/** Release the in-flight slot. Always call from a `finally`. */
export function endInFlight(ref: InFlightRef): void {
  ref.current = false;
}
