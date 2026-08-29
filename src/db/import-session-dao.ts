/**
 * Durable import-session write chokepoint.
 *
 * The standalone writers below each take the non-reentrant write mutex exactly
 * once. Call their `*Core` counterparts only inside an already-open
 * `inWriteTransaction` when composing a contact write with a row transition.
 *
 * Canonical import row transitions — the single source of truth for plans 06,
 * 07, 08, and 11:
 *
 * | Event | row_status | match_outcome | contact_id | Writer |
 * | --- | --- | --- | --- | --- |
 * | accepted | pending | NULL | NULL | acceptImportSessionWithRows |
 * | already-linked | skipped | already_linked | NULL | resolveAlreadyLinked(Core) |
 * | import as new | imported | new | set | importer composition |
 * | link existing | linked | probable/possible | set | link composition |
 * | ambiguous deferred | needs_review | probable/possible/needs_review | NULL | deferNeedsReview(Core) |
 * | user Skip | skipped | prior or NULL, never already_linked | NULL | markRowStatus |
 * | import failure | failed | prior | NULL | markRowStatus |
 * | photo-only failure | unchanged | unchanged | unchanged | markRowPhotoFailed |
 */
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

export type ImportSessionMode = "single" | "bulk";
export type ImportSessionRowStatus =
  | "pending"
  | "imported"
  | "linked"
  | "skipped"
  | "failed"
  | "needs_review";
export type ImportMatchOutcome =
  | "already_linked"
  | "probable"
  | "possible"
  | "new"
  | "needs_review";

export interface CreateImportSessionInput {
  uid: string;
  mode: ImportSessionMode;
  batchCategoryId: number | null;
  batchTrackingEnabled: boolean;
  phoneRegion: string | null;
  now: string;
}

export interface InsertSessionRowInput {
  sessionId: number;
  uid: string;
  externalContactId: string;
  sourcePayload: string;
  photoRelPath: string | null;
  now: string;
}

export interface AcceptImportSessionWithRowsInput {
  session: CreateImportSessionInput;
  rows: Array<Omit<InsertSessionRowInput, "sessionId" | "now">>;
}

async function insertImportSessionCore(
  exec: SqlExecutor,
  input: CreateImportSessionInput,
  totalRows: number,
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO import_sessions
       (uid, mode, batch_category_id, batch_tracking_enabled, phone_region, total_rows, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.uid,
      input.mode,
      input.batchCategoryId,
      input.batchTrackingEnabled ? 1 : 0,
      input.phoneRegion,
      totalRows,
      input.now,
      input.now,
    ],
  );
  return result.lastInsertRowId;
}

async function insertSessionRowCore(
  exec: SqlExecutor,
  input: InsertSessionRowInput,
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO import_session_rows
       (uid, session_id, external_contact_id, source_payload, photo_rel_path, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.uid,
      input.sessionId,
      input.externalContactId,
      input.sourcePayload,
      input.photoRelPath,
      input.now,
      input.now,
    ],
  );
  return result.lastInsertRowId;
}

function assertOneChange(
  result: { changes: number },
  operation: string,
  id: number,
): void {
  if (result.changes !== 1) {
    throw new Error(
      `${operation}: no row matched id=${id} (changed ${result.changes})`,
    );
  }
}

export function createImportSession(
  exec: SqlExecutor,
  input: CreateImportSessionInput,
): Promise<number> {
  return inWriteTransaction(exec, () =>
    insertImportSessionCore(exec, input, 0),
  );
}

export function insertSessionRow(
  exec: SqlExecutor,
  input: InsertSessionRowInput,
): Promise<number> {
  return inWriteTransaction(exec, async () => {
    const rowId = await insertSessionRowCore(exec, input);
    const result = await exec.runAsync(
      `UPDATE import_sessions
       SET total_rows = total_rows + 1, modified_at = ?
       WHERE id = ?`,
      [input.now, input.sessionId],
    );
    assertOneChange(result, "insertSessionRow", input.sessionId);
    return rowId;
  });
}

/** Atomically persist one picker snapshot; a failed insert rolls back all rows. */
export function acceptImportSessionWithRows(
  exec: SqlExecutor,
  input: AcceptImportSessionWithRowsInput,
): Promise<{ sessionId: number; rowIds: number[] }> {
  return inWriteTransaction(exec, async () => {
    const sessionId = await insertImportSessionCore(
      exec,
      input.session,
      input.rows.length,
    );
    const rowIds: number[] = [];
    for (const row of input.rows) {
      rowIds.push(
        await insertSessionRowCore(exec, {
          ...row,
          sessionId,
          now: input.session.now,
        }),
      );
    }
    return { sessionId, rowIds };
  });
}

export async function setRowMatchOutcomeCore(
  exec: SqlExecutor,
  rowId: number,
  outcome: ImportMatchOutcome | null,
  matchedContactId: number | null,
  now: string,
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE import_session_rows
     SET match_outcome = ?, matched_contact_id = ?, modified_at = ?
     WHERE id = ?`,
    [outcome, matchedContactId, now, rowId],
  );
  assertOneChange(result, "setRowMatchOutcomeCore", rowId);
}

export function setRowMatchOutcome(
  exec: SqlExecutor,
  rowId: number,
  outcome: ImportMatchOutcome | null,
  matchedContactId: number | null,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, () =>
    setRowMatchOutcomeCore(exec, rowId, outcome, matchedContactId, now),
  );
}

export async function setRowContactCore(
  exec: SqlExecutor,
  rowId: number,
  contactId: number,
  status: "imported" | "linked",
  now: string,
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE import_session_rows
     SET contact_id = ?, row_status = ?, modified_at = ?
     WHERE id = ?`,
    [contactId, status, now, rowId],
  );
  assertOneChange(result, "setRowContactCore", rowId);
}

export function setRowContact(
  exec: SqlExecutor,
  rowId: number,
  contactId: number,
  status: "imported" | "linked",
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, () =>
    setRowContactCore(exec, rowId, contactId, status, now),
  );
}

export async function markRowStatusCore(
  exec: SqlExecutor,
  rowId: number,
  status: ImportSessionRowStatus,
  failureReason: string | null,
  now: string,
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE import_session_rows
     SET row_status = ?, failure_reason = ?, modified_at = ?
     WHERE id = ?`,
    [status, failureReason, now, rowId],
  );
  assertOneChange(result, "markRowStatusCore", rowId);
}

export function markRowStatus(
  exec: SqlExecutor,
  rowId: number,
  status: ImportSessionRowStatus,
  failureReason: string | null,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, () =>
    markRowStatusCore(exec, rowId, status, failureReason, now),
  );
}

export async function markRowPhotoFailedCore(
  exec: SqlExecutor,
  rowId: number,
  now: string,
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE import_session_rows SET photo_failed = 1, modified_at = ? WHERE id = ?`,
    [now, rowId],
  );
  assertOneChange(result, "markRowPhotoFailedCore", rowId);
}

export function markRowPhotoFailed(
  exec: SqlExecutor,
  rowId: number,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, () =>
    markRowPhotoFailedCore(exec, rowId, now),
  );
}

export async function resolveAlreadyLinkedCore(
  exec: SqlExecutor,
  rowId: number,
  matchedContactId: number,
  now: string,
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE import_session_rows
     SET row_status = 'skipped', match_outcome = 'already_linked', matched_contact_id = ?, modified_at = ?
     WHERE id = ?`,
    [matchedContactId, now, rowId],
  );
  assertOneChange(result, "resolveAlreadyLinkedCore", rowId);
}

export function resolveAlreadyLinked(
  exec: SqlExecutor,
  rowId: number,
  matchedContactId: number,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, () =>
    resolveAlreadyLinkedCore(exec, rowId, matchedContactId, now),
  );
}

export async function deferNeedsReviewCore(
  exec: SqlExecutor,
  rowId: number,
  outcome: Exclude<ImportMatchOutcome, "already_linked" | "new">,
  matchedContactId: number | null,
  candidatesJson: string,
  now: string,
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE import_session_rows
     SET row_status = 'needs_review', match_outcome = ?, matched_contact_id = ?, candidates_json = ?, modified_at = ?
     WHERE id = ?`,
    [outcome, matchedContactId, candidatesJson, now, rowId],
  );
  assertOneChange(result, "deferNeedsReviewCore", rowId);
}

export function deferNeedsReview(
  exec: SqlExecutor,
  rowId: number,
  outcome: Exclude<ImportMatchOutcome, "already_linked" | "new">,
  matchedContactId: number | null,
  candidatesJson: string,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, () =>
    deferNeedsReviewCore(
      exec,
      rowId,
      outcome,
      matchedContactId,
      candidatesJson,
      now,
    ),
  );
}

async function completeSessionCore(
  exec: SqlExecutor,
  sessionId: number,
  now: string,
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE import_sessions SET status = 'complete', modified_at = ? WHERE id = ?`,
    [now, sessionId],
  );
  assertOneChange(result, "completeSession", sessionId);
}

export function completeSession(
  exec: SqlExecutor,
  sessionId: number,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, () =>
    completeSessionCore(exec, sessionId, now),
  );
}

export function setSessionBatchCategory(
  exec: SqlExecutor,
  sessionId: number,
  categoryId: number | null,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      `UPDATE import_sessions
       SET batch_category_id = ?, modified_at = ?
       WHERE id = ?`,
      [categoryId, now, sessionId],
    );
    assertOneChange(result, "setSessionBatchCategory", sessionId);
  });
}

export function finalizeSessionIfTerminal(
  exec: SqlExecutor,
  sessionId: number,
  now: string,
): Promise<boolean> {
  return inWriteTransaction(exec, async () => {
    const session = await exec.getFirstAsync<{ status: string }>(
      "SELECT status FROM import_sessions WHERE id = ?",
      [sessionId],
    );
    if (!session)
      throw new Error(`finalizeSessionIfTerminal: no session id=${sessionId}`);
    if (session.status === "complete") return true;
    if (session.status !== "pending") return false;

    const unresolved = await exec.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM import_session_rows
       WHERE session_id = ? AND row_status IN ('pending', 'needs_review', 'failed')`,
      [sessionId],
    );
    if ((unresolved?.count ?? 0) !== 0) return false;
    await completeSessionCore(exec, sessionId, now);
    return true;
  });
}

/** Discard unresolved rows and report their staged paths for post-commit cleanup. */
export function discardSession(
  exec: SqlExecutor,
  sessionId: number,
  now: string,
): Promise<string[]> {
  return inWriteTransaction(exec, async () => {
    const rows = await exec.getAllAsync<{ photo_rel_path: string | null }>(
      `SELECT photo_rel_path FROM import_session_rows
       WHERE session_id = ? AND contact_id IS NULL`,
      [sessionId],
    );
    const statusResult = await exec.runAsync(
      `UPDATE import_sessions SET status = 'discarded', modified_at = ? WHERE id = ?`,
      [now, sessionId],
    );
    assertOneChange(statusResult, "discardSession", sessionId);
    await exec.runAsync(
      "DELETE FROM import_session_rows WHERE session_id = ? AND contact_id IS NULL",
      [sessionId],
    );
    return rows.flatMap(({ photo_rel_path }) =>
      photo_rel_path === null ? [] : [photo_rel_path],
    );
  });
}
