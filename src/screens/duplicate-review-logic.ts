/**
 * DuplicateReview presentation and resolve sequencing (RG-035,
 * ui-accessibility/AUD-UIA-012, D-24, D-04).
 *
 * A failed read is an error, never "Nothing to review". A resolve is complete
 * the moment its write resolves: a later finalize or re-read failure is a read
 * problem recovered by a read-only Retry, never a prompt to redo the write.
 */
import { plural } from "@/utils/plural";

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

/**
 * One snackbar for a whole bulk resolve (38.9 D-27, D-40): the per-row
 * failures are collected through the loop and reported once after it, so
 * resolving many contacts never stacks one message per failing row. One
 * failure keeps its own words; two or more are summarised (this plan's
 * wording). Null when nothing failed.
 */
export function bulkResolveFailureLabel(
  failures: readonly string[],
): string | null {
  if (failures.length === 0) return null;
  if (failures.length === 1) return failures[0];
  return `${failures.length} contacts couldn't be resolved. They're still listed.`;
}

/**
 * The one snackbar for a bulk-bar Import as new / Skip (38.12 D-04, folded
 * into 38.12-21 from 38.12-08's deferred item): every write that succeeded is
 * confirmed — one person by name, more by count ("Imported 3 people") — and
 * any failures ride in the same message, since a later snackbar replaces an
 * earlier one. Failures make it an error (announced as an alert). Null when
 * nothing was written and nothing failed.
 */
export function bulkResolveMessage(
  action: "import-new" | "skip",
  succeededNames: readonly string[],
  failures: readonly string[],
): { kind: "success" | "error"; label: string } | null {
  const verb = action === "import-new" ? "Imported" : "Skipped";
  const success =
    succeededNames.length === 0
      ? null
      : succeededNames.length === 1
        ? `${verb} ${succeededNames[0]}`
        : `${verb} ${plural(succeededNames.length, "person", "people")}`;
  const failure = bulkResolveFailureLabel(failures);
  if (failure && success)
    return { kind: "error", label: `${success}. ${failure}` };
  if (failure) return { kind: "error", label: failure };
  if (success) return { kind: "success", label: success };
  return null;
}
