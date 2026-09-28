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

let lastRunKey = 0;

/**
 * A fresh key for an explicit, user-initiated re-entry into ImportProgress
 * (38.3 review B-WR-01). React Navigation 7 answers a NAVIGATE whose name
 * equals the CURRENT route by reusing that route and swapping its params, so a
 * resume tapped over a stopped ImportProgress for the same session would change
 * nothing the run effect depends on and silently do nothing. The resume prompt
 * passes this key; the run effect is keyed on {@link importProgressRunIdentity}.
 */
export function nextImportRunKey(): number {
  lastRunKey += 1;
  return lastRunKey;
}

/** The identity of one import run: its session plus the entry's run key. */
export function importProgressRunIdentity(params: {
  sessionId: number;
  runKey?: number;
}): string {
  return `${params.sessionId}:${params.runKey ?? 0}`;
}

/**
 * 38.4 D-74 (owner): the plain notice shown (and announced) when Back is
 * pressed while a bulk import pass is running. Short on purpose.
 */
export const IMPORT_PROGRESS_BACK_NOTICE =
  "Still importing. You can go back when it finishes.";

/**
 * Whether Import Progress refuses to be left (D-74): while this screen is
 * driving or following a pass, or while any pass for the session is in flight.
 * Leaving mid-pass returned to bulk setup with the pass still running, and
 * Continue there started a second pass over the same rows. After the pass
 * finishes or stops, leaving works as before.
 */
export function importProgressBlocksLeave(state: {
  driving: boolean;
  runActive: boolean;
}): boolean {
  return state.driving || state.runActive;
}
