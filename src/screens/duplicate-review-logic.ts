/**
 * DuplicateReview presentation and resolve sequencing (RG-035,
 * ui-accessibility/AUD-UIA-012, D-24, D-04).
 *
 * A failed read is an error, never "Nothing to review". A resolve is complete
 * the moment its write resolves: a later finalize or re-read failure is a read
 * problem recovered by a read-only Retry, never a prompt to redo the write.
 */
export type DuplicateReviewView = "loading" | "error" | "empty" | "items";

export interface DuplicateReviewViewInput {
  loading: boolean;
  loadError?: boolean;
  itemCount?: number;
}

export function duplicateReviewView({
  loading,
  loadError = false,
  itemCount = 0,
}: DuplicateReviewViewInput): DuplicateReviewView {
  if (loading) return "loading";
  if (loadError) return "error";
  return itemCount === 0 ? "empty" : "items";
}

export type ResolveOutcome =
  | { writeOk: false }
  | { writeOk: true; recoveryError: boolean };

interface RecoverySteps {
  /** Close the session if every row is now resolved. */
  finalize: () => Promise<void>;
  /** Re-read the review list (read-only). */
  reread: () => Promise<void>;
  /** A finalize/re-read failure: log content-free and show the read error. */
  onRecoveryError?: (error: unknown) => void;
}

async function recoverAfterWrite(steps: RecoverySteps): Promise<boolean> {
  try {
    await steps.finalize();
    await steps.reread();
    return false;
  } catch (error) {
    steps.onRecoveryError?.(error);
    return true;
  }
}

/**
 * Single resolve (link): the write's own failure is the only resolve failure.
 * `onWritten` runs once the write has committed, before any recovery step.
 */
export async function runResolveThenRecover(
  steps: RecoverySteps & {
    write: () => Promise<void>;
    onWritten?: () => void;
    onWriteError?: (error: unknown) => void;
  },
): Promise<ResolveOutcome> {
  try {
    await steps.write();
  } catch (error) {
    steps.onWriteError?.(error);
    return { writeOk: false };
  }
  steps.onWritten?.();
  return { writeOk: true, recoveryError: await recoverAfterWrite(steps) };
}

/**
 * Bulk resolve (import-new / skip): each row write is isolated; the trailing
 * finalize + re-read runs once and its failure is never a row failure.
 */
export async function runBulkResolveThenRecover<T>(
  steps: RecoverySteps & {
    entries: readonly T[];
    writeOne: (entry: T) => Promise<void>;
    onRowError?: (entry: T, error: unknown) => void;
  },
): Promise<{ failed: T[]; recoveryError: boolean }> {
  const failed: T[] = [];
  for (const entry of steps.entries) {
    try {
      await steps.writeOne(entry);
    } catch (error) {
      failed.push(entry);
      steps.onRowError?.(entry, error);
    }
  }
  return { failed, recoveryError: await recoverAfterWrite(steps) };
}
