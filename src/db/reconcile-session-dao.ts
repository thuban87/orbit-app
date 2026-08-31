/**
 * Durable reconciliation-session state machine.
 *
 * `*Core` writers intentionally do not acquire the shared write mutex. Compose
 * them inside one caller-owned `inWriteTransaction` when a scan creates a
 * session and all of its cards atomically; use the wrappers for standalone
 * transitions.
 */
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

export type ReconcileSessionStatus = "pending" | "complete" | "discarded";
export type ReconcileCardStatus =
  | "unresolved"
  | "partial"
  | "resolved"
  | "missing_source";

export interface CreateReconcileSessionInput {
  uid: string;
  totalChecked: number;
  now: string;
}

export interface InsertReconcileCardInput {
  uid: string;
  sessionId?: number;
  sessionUid?: string;
  contactId: number;
  cardStatus: ReconcileCardStatus;
  diffJson: string;
  unresolvedCount: number;
  stagedPhotoRelPath: string | null;
  now: string;
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

export async function createReconcileSessionCore(
  exec: SqlExecutor,
  input: CreateReconcileSessionInput,
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO reconciliation_sessions
       (uid, total_checked, created_at, modified_at)
     VALUES (?, ?, ?, ?)`,
    [input.uid, input.totalChecked, input.now, input.now],
  );
  return result.lastInsertRowId;
}

export function createReconcileSession(
  exec: SqlExecutor,
  input: CreateReconcileSessionInput,
): Promise<number> {
  return inWriteTransaction(exec, () => createReconcileSessionCore(exec, input));
}

async function resolveSessionId(
  exec: SqlExecutor,
  input: Pick<InsertReconcileCardInput, "sessionId" | "sessionUid">,
): Promise<number> {
  if (input.sessionId != null) return input.sessionId;
  if (input.sessionUid == null) {
    throw new Error("insertReconcileCardCore: sessionId or sessionUid is required");
  }
  const session = await exec.getFirstAsync<{ id: number }>(
    "SELECT id FROM reconciliation_sessions WHERE uid = ?",
    [input.sessionUid],
  );
  if (!session) {
    throw new Error(
      `insertReconcileCardCore: no session matched uid=${input.sessionUid}`,
    );
  }
  return session.id;
}

export async function insertReconcileCardCore(
  exec: SqlExecutor,
  input: InsertReconcileCardInput,
): Promise<number> {
  const sessionId = await resolveSessionId(exec, input);
  const result = await exec.runAsync(
    `INSERT INTO reconciliation_session_cards
       (uid, session_id, contact_id, card_status, diff_json, unresolved_count,
        staged_photo_rel_path, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.uid,
      sessionId,
      input.contactId,
      input.cardStatus,
      input.diffJson,
      input.unresolvedCount,
      input.stagedPhotoRelPath,
      input.now,
      input.now,
    ],
  );
  return result.lastInsertRowId;
}

export function insertReconcileCard(
  exec: SqlExecutor,
  input: InsertReconcileCardInput,
): Promise<number> {
  return inWriteTransaction(exec, () => insertReconcileCardCore(exec, input));
}

export async function markCardStatusCore(
  exec: SqlExecutor,
  cardId: number,
  status: ReconcileCardStatus,
  unresolvedCount: number,
  now: string,
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE reconciliation_session_cards
     SET card_status = ?, unresolved_count = ?, modified_at = ?
     WHERE id = ?`,
    [status, unresolvedCount, now, cardId],
  );
  assertOneChange(result, "markCardStatusCore", cardId);
}

export function markCardStatus(
  exec: SqlExecutor,
  cardId: number,
  status: ReconcileCardStatus,
  unresolvedCount: number,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, () =>
    markCardStatusCore(exec, cardId, status, unresolvedCount, now),
  );
}

export async function finalizeSessionIfTerminalCore(
  exec: SqlExecutor,
  sessionId: number,
  now: string,
): Promise<boolean> {
  const session = await exec.getFirstAsync<{ status: ReconcileSessionStatus }>(
    "SELECT status FROM reconciliation_sessions WHERE id = ?",
    [sessionId],
  );
  if (!session) {
    throw new Error(`finalizeSessionIfTerminal: no session id=${sessionId}`);
  }
  if (session.status === "complete") return true;
  if (session.status !== "pending") return false;

  const nonTerminal = await exec.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
     FROM reconciliation_session_cards
     WHERE session_id = ? AND card_status NOT IN ('resolved', 'missing_source')`,
    [sessionId],
  );
  if ((nonTerminal?.count ?? 0) !== 0) return false;

  const result = await exec.runAsync(
    `UPDATE reconciliation_sessions
     SET status = 'complete', modified_at = ?
     WHERE id = ?`,
    [now, sessionId],
  );
  assertOneChange(result, "finalizeSessionIfTerminalCore", sessionId);
  return true;
}

export function finalizeSessionIfTerminal(
  exec: SqlExecutor,
  sessionId: number,
  now: string,
): Promise<boolean> {
  return inWriteTransaction(exec, () =>
    finalizeSessionIfTerminalCore(exec, sessionId, now),
  );
}

/** Discard unresolved/partial cards and return their staged paths for post-commit cleanup. */
export async function discardSessionCore(
  exec: SqlExecutor,
  sessionId: number,
  now: string,
): Promise<string[]> {
  const cards = await exec.getAllAsync<{ staged_photo_rel_path: string | null }>(
    `SELECT staged_photo_rel_path FROM reconciliation_session_cards
     WHERE session_id = ? AND card_status IN ('unresolved', 'partial')`,
    [sessionId],
  );
  const statusResult = await exec.runAsync(
    `UPDATE reconciliation_sessions
     SET status = 'discarded', modified_at = ?
     WHERE id = ?`,
    [now, sessionId],
  );
  assertOneChange(statusResult, "discardSessionCore", sessionId);
  await exec.runAsync(
    `DELETE FROM reconciliation_session_cards
     WHERE session_id = ? AND card_status IN ('unresolved', 'partial')`,
    [sessionId],
  );
  return cards.flatMap(({ staged_photo_rel_path }) =>
    staged_photo_rel_path == null ? [] : [staged_photo_rel_path],
  );
}

export function discardSession(
  exec: SqlExecutor,
  sessionId: number,
  now: string,
): Promise<string[]> {
  return inWriteTransaction(exec, () => discardSessionCore(exec, sessionId, now));
}
