/**
 * React-free coordination primitives for Dashboard bulk actions. A single gate
 * owns the synchronous claim while HomeScreen owns rendering and side effects.
 */
export interface BulkActionGate {
  readonly pending: boolean;
  tryAcquire: () => boolean;
  release: () => void;
}

export function createBulkActionGate(
  onPendingChange?: (pending: boolean) => void,
): BulkActionGate {
  let pending = false;

  return {
    get pending() {
      return pending;
    },
    tryAcquire: () => {
      if (pending) return false;
      pending = true;
      onPendingChange?.(true);
      return true;
    },
    release: () => {
      if (!pending) return;
      pending = false;
      onPendingChange?.(false);
    },
  };
}
