/**
 * React-free coordination primitives for Dashboard bulk actions. A single gate
 * owns the synchronous claim while HomeScreen owns rendering and side effects.
 */
export interface BulkActionGate {
  readonly pending: boolean;
  tryAcquire: () => BulkActionClaim | null;
  /** Marks a claimed dialog or picker choice as having started its one writer. */
  consume: (claim: BulkActionClaim) => boolean;
  /** Releases only the gate's current owner; stale completions are inert. */
  release: (claim: BulkActionClaim) => void;
}

/**
 * Opaque ownership token for one bulk operation. A claim may launch exactly one
 * writer, but can be released without consumption when its dialog is dismissed.
 */
export interface BulkActionClaim {
  readonly id: number;
}

/** The narrow selection snapshot needed after HomeScreen crosses an async boundary. */
export interface DashboardSelectionSessionSnapshot {
  mode: boolean;
  sessionId: number;
  selectedIds: ReadonlySet<number>;
}

/** Returns live IDs only while the captured selection session remains active. */
export function getCurrentSelectionIds(
  selection: DashboardSelectionSessionSnapshot,
  sessionId: number,
): number[] | null {
  if (!selection.mode || selection.sessionId !== sessionId) return null;
  return [...selection.selectedIds];
}

export function createBulkActionGate(
  onPendingChange?: (pending: boolean) => void,
): BulkActionGate {
  let nextId = 0;
  let current: { claim: BulkActionClaim; consumed: boolean } | null = null;

  return {
    get pending() {
      return current !== null;
    },
    tryAcquire: () => {
      if (current) return null;
      const claim = { id: ++nextId };
      current = { claim, consumed: false };
      onPendingChange?.(true);
      return claim;
    },
    consume: (claim) => {
      if (!current || current.claim !== claim || current.consumed) return false;
      current.consumed = true;
      return true;
    },
    release: (claim) => {
      if (!current || current.claim !== claim) return;
      current = null;
      onPendingChange?.(false);
    },
  };
}
