/**
 * In-process marker for a contact import that is between the picker launch and
 * its hand-off to review. The system picker and the Contacts permission dialog
 * send Orbit to the background, so the foreground launch sweep fires while this
 * import is still acquiring. The import-resume hook must not prompt to "resume"
 * that live session, nor reconcile staged photos whose rows are not committed
 * yet. A process kill clears the marker, so genuine interrupted imports still
 * surface on the next launch.
 */
let activeFlows = 0;

/** Run `work` with the import flow marked active; always clears the mark. */
export async function withImportFlowActive<T>(
  work: () => Promise<T>,
): Promise<T> {
  activeFlows++;
  try {
    return await work();
  } finally {
    activeFlows--;
  }
}

/** True while a picker-driven import is acquiring in this process. */
export function isImportFlowActive(): boolean {
  return activeFlows > 0;
}

// Sessions currently shown by an import screen. Returning from any external
// activity (system picker, permission dialog, share sheet) re-runs the launch
// sweep, which must not offer to "resume" the import the user is looking at.
const openSessions = new Map<number, number>();

/** Mark `sessionId` open on screen; the returned function releases it. */
export function markImportSessionOpen(sessionId: number): () => void {
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

/** True while some import screen is showing `sessionId`. */
export function isImportSessionOpen(sessionId: number): boolean {
  return openSessions.has(sessionId);
}
