/**
 * Reconcile counterpart of `import-flow-guard` (same reasons, same contract).
 * A linked-contact check can raise the Contacts permission dialog, which sends
 * Orbit to the background; the launch sweep then fires mid-scan. The reconcile
 * resume hook must not offer to "resume" the check on screen, nor delete source
 * photos staged for cards that are not committed yet.
 */
let activeFlows = 0;
const openSessions = new Map<number, number>();

/** Run a reconcile scan with the flow marked active; always clears the mark. */
export async function withReconcileFlowActive<T>(
  work: () => Promise<T>,
): Promise<T> {
  activeFlows++;
  try {
    return await work();
  } finally {
    activeFlows--;
  }
}

/** True while a reconcile scan is reading sources in this process. */
export function isReconcileFlowActive(): boolean {
  return activeFlows > 0;
}

/** Mark `sessionId` open on screen; the returned function releases it. */
export function markReconcileSessionOpen(sessionId: number): () => void {
  openSessions.set(sessionId, (openSessions.get(sessionId) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const count = (openSessions.get(sessionId) ?? 1) - 1;
    if (count > 0) openSessions.set(sessionId, count);
    else openSessions.delete(sessionId);
  };
}

/** True while some reconcile screen is showing `sessionId`. */
export function isReconcileSessionOpen(sessionId: number): boolean {
  return openSessions.has(sessionId);
}
