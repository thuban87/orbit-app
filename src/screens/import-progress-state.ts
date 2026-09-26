/**
 * ImportProgress surface state (RG-035, ui-accessibility/AUD-UIA-012, D-20).
 *
 * A row-level failure is isolated inside the import driver. The screen only
 * reaches "stopped" when setup or session access itself failed; nothing
 * re-runs automatically from there.
 */
export type ImportStopOutcome = "summary-available" | "session-unreadable";

export type ImportProgressPhase =
  | { phase: "running"; done: number; total: number }
  | { phase: "stopped"; outcome: ImportStopOutcome };

/**
 * Decide where a fatally stopped import can send the user. A readable session
 * can open Import Complete (which hosts Retry / Skip remaining photos); a
 * missing or unreadable session can only go Back. Never throws.
 */
export async function classifyImportStop(
  probe: () => Promise<unknown | null>,
): Promise<ImportStopOutcome> {
  try {
    const session = await probe();
    return session ? "summary-available" : "session-unreadable";
  } catch {
    return "session-unreadable";
  }
}
