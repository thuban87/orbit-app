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

export interface ClaimedBulkWriteDeps<T> {
  /** The claim held since the sheet opened, read at CALL time (or null). */
  takeHeldClaim: () => BulkActionClaim | null;
  acquire: () => BulkActionClaim | null;
  consume: (claim: BulkActionClaim) => boolean;
  release: (claim: BulkActionClaim) => void;
  write: () => Promise<T>;
}

/**
 * The React-free bulk-sheet adapter (38.11 D-45; review U-01, V-02). The shared
 * snooze sheet keeps the submitted operation and Retry re-runs that same
 * closure, so the operation never closes over a claim value: each call reads
 * the held claim at call time, else acquires a fresh one; consumes it (no
 * write without a consumed claim); awaits the write; releases the claim when
 * it settles. A rejected write rejects the returned promise with the gate
 * free, so the sheet shows its error and a Retry takes a fresh claim.
 */
export async function runClaimedBulkWrite<T>({
  takeHeldClaim,
  acquire,
  consume,
  release,
  write,
}: ClaimedBulkWriteDeps<T>): Promise<T> {
  const claim = takeHeldClaim() ?? acquire();
  if (!claim) throw new Error("runClaimedBulkWrite: a bulk action is running");
  // A claim that cannot be consumed belongs to a writer already in flight;
  // releasing it here would free the gate under that writer.
  if (!consume(claim)) {
    throw new Error("runClaimedBulkWrite: the bulk claim is already in use");
  }
  try {
    return await write();
  } finally {
    release(claim);
  }
}
