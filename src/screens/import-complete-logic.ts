/**
 * Import Complete Retry block (RG-035, D-26; 38.2 D-14 preserved).
 *
 * Retry already runs only `pending` and `failed` rows (committed rows are
 * filtered out by status and by `contactId`), plus unfinished photos. After a
 * fatal ImportProgress stop the session can hold pending rows with no failures,
 * so pending rows must also surface Retry.
 */
import { type InFlightRef, runSingleFlight } from "@/utils/single-flight";
import { commitThenRefresh } from "./backup-settings-logic";

export interface ImportCompleteRetryInput {
  failed: number;
  pending: number;
  photoRows: number;
}

export interface ImportCompleteRetryState {
  visible: boolean;
  message: string | null;
}

export function importCompleteRetryState({
  failed,
  pending,
  photoRows,
}: ImportCompleteRetryInput): ImportCompleteRetryState {
  if (failed > 0)
    return { visible: true, message: "Some contacts couldn't be imported." };
  if (pending > 0)
    return {
      visible: true,
      message: "Some contacts haven't been imported yet.",
    };
  if (photoRows > 0)
    return {
      visible: true,
      message: "Some contact photos still need to be added.",
    };
  return { visible: false, message: null };
}

export type ImportCompleteActionOutcome =
  | "committed"
  | "write-failed"
  | "dropped";

export interface ImportCompleteActionSteps {
  /** The Retry / Skip-photos write. */
  readonly write: () => Promise<unknown>;
  /** The summary re-read; MUST never reject (use `runGatedRead`). */
  readonly refresh: () => Promise<void>;
  /** Report a failed WRITE as an inline notice. Never sees a re-read failure. */
  readonly onWriteFailed: (error: unknown) => void;
}

/**
 * Run one ImportComplete action (38.3 review B-WR-03 / B-WR-04, D-04).
 *
 * - One synchronous slot: a same-tick second tap is `dropped`, never a second
 *   concurrent import run over the same pending snapshot.
 * - The re-read sits OUTSIDE the write's catch (`commitThenRefresh`), so a
 *   failed re-read after a committed write is a summary READ error with a
 *   read-only Retry — never reported as the write failing.
 * - A failed write is reported through `onWriteFailed` and the summary is still
 *   re-read (read-only), because a Retry can fail part-way after committing
 *   some rows; the notice then sits above truthful counts.
 */
export async function runImportCompleteAction(
  latch: InFlightRef,
  steps: ImportCompleteActionSteps,
): Promise<ImportCompleteActionOutcome> {
  let outcome: ImportCompleteActionOutcome = "dropped";
  await runSingleFlight(latch, async () => {
    const result = await commitThenRefresh({
      commit: async () => {
        await steps.write();
        return true;
      },
      refresh: steps.refresh,
      onCommitFailed: steps.onWriteFailed,
    });
    if (result === "commit-failed") {
      await steps.refresh();
      outcome = "write-failed";
      return;
    }
    outcome = "committed";
  });
  return outcome;
}
