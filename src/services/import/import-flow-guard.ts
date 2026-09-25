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
