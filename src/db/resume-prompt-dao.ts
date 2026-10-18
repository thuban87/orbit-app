/**
 * The "asked once" marker for the two resume prompts (38.12 D-105, D-111).
 *
 * Migration 034 added a nullable `resume_prompted_at` to `import_sessions` and
 * `reconciliation_sessions`. The prompt writes it when its sheet actually
 * mounts visible — never when the launch sweep merely finds the session — so a
 * prompt suppressed while a share is pending or Capture is focused (38.10
 * D-23, ADR-216) still appears later. The sweeps skip a session whose marker is
 * set. Resuming a session clears it, so a session resumed and then left again
 * asks once more at the next launch or foreground (convergence c1 L-3).
 *
 * The marker is prompt bookkeeping, not user data: it does not touch
 * `modified_at`, and neither session table is exported in a backup.
 *
 * Write-transaction convention (`import-session-dao.ts:3-6`): each public
 * writer below takes the non-reentrant write mutex exactly once through
 * `inWriteTransaction`. Call the `*Core` forms only inside an already-open
 * `inWriteTransaction` when composing with another write (convergence c4 E-3);
 * every UI, prompt and Settings caller uses the locked wrappers.
 */
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

/** Mark an import session as prompted; a second mark keeps the first time. */
export async function markImportResumePromptedCore(
  exec: SqlExecutor,
  sessionId: number,
  now: string,
): Promise<boolean> {
  const result = await exec.runAsync(
    `UPDATE import_sessions SET resume_prompted_at = ?
     WHERE id = ? AND resume_prompted_at IS NULL`,
    [now, sessionId],
  );
  return result.changes > 0;
}

/** Mark a reconcile (check) session as prompted; a second mark keeps the first. */
export async function markReconcileResumePromptedCore(
  exec: SqlExecutor,
  sessionId: number,
  now: string,
): Promise<boolean> {
  const result = await exec.runAsync(
    `UPDATE reconciliation_sessions SET resume_prompted_at = ?
     WHERE id = ? AND resume_prompted_at IS NULL`,
    [now, sessionId],
  );
  return result.changes > 0;
}

/** Clear an import session's marker when it is resumed (L-3). */
export async function clearImportResumePromptedCore(
  exec: SqlExecutor,
  sessionId: number,
): Promise<void> {
  await exec.runAsync(
    "UPDATE import_sessions SET resume_prompted_at = NULL WHERE id = ?",
    [sessionId],
  );
}

/** Clear a reconcile session's marker when it is resumed (L-3). */
export async function clearReconcileResumePromptedCore(
  exec: SqlExecutor,
  sessionId: number,
): Promise<void> {
  await exec.runAsync(
    "UPDATE reconciliation_sessions SET resume_prompted_at = NULL WHERE id = ?",
    [sessionId],
  );
}

/** Locked wrapper: the import prompt calls this on visible mount (E-3). */
export function markImportResumePrompted(
  exec: SqlExecutor,
  sessionId: number,
  now: string,
): Promise<boolean> {
  return inWriteTransaction(exec, () =>
    markImportResumePromptedCore(exec, sessionId, now),
  );
}

/** Locked wrapper: the check prompt calls this on visible mount (E-3). */
export function markReconcileResumePrompted(
  exec: SqlExecutor,
  sessionId: number,
  now: string,
): Promise<boolean> {
  return inWriteTransaction(exec, () =>
    markReconcileResumePromptedCore(exec, sessionId, now),
  );
}

/** Locked wrapper: every import Resume path calls this (L-3, E-3). */
export function clearImportResumePrompted(
  exec: SqlExecutor,
  sessionId: number,
): Promise<void> {
  return inWriteTransaction(exec, () =>
    clearImportResumePromptedCore(exec, sessionId),
  );
}

/** Locked wrapper: every check Resume path calls this (L-3, E-3). */
export function clearReconcileResumePrompted(
  exec: SqlExecutor,
  sessionId: number,
): Promise<void> {
  return inWriteTransaction(exec, () =>
    clearReconcileResumePromptedCore(exec, sessionId),
  );
}
