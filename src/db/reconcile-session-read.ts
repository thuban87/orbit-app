import { discardSession, type ReconcileCardStatus, type ReconcileSessionStatus } from "@/db/reconcile-session-dao";
import type { SqlExecutor } from "@/db/types";

export interface ReconcileSession {
  id: number;
  uid: string;
  status: ReconcileSessionStatus;
  totalChecked: number;
  createdAt: string;
  modifiedAt: string;
}

export interface ReconcileSessionCard {
  id: number;
  uid: string;
  sessionId: number;
  contactId: number;
  cardStatus: ReconcileCardStatus;
  diffJson: string;
  unresolvedCount: number;
  stagedPhotoRelPath: string | null;
  createdAt: string;
  modifiedAt: string;
}

interface ReconcileSessionDbRow {
  id: number;
  uid: string;
  status: ReconcileSessionStatus;
  total_checked: number;
  created_at: string;
  modified_at: string;
}

interface ReconcileCardDbRow {
  id: number;
  uid: string;
  session_id: number;
  contact_id: number;
  card_status: ReconcileCardStatus;
  diff_json: string;
  unresolved_count: number;
  staged_photo_rel_path: string | null;
  created_at: string;
  modified_at: string;
}

export function mapReconcileSession(row: ReconcileSessionDbRow): ReconcileSession {
  return {
    id: row.id,
    uid: row.uid,
    status: row.status,
    totalChecked: row.total_checked,
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
  };
}

function mapCard(row: ReconcileCardDbRow): ReconcileSessionCard {
  return {
    id: row.id,
    uid: row.uid,
    sessionId: row.session_id,
    contactId: row.contact_id,
    cardStatus: row.card_status,
    diffJson: row.diff_json,
    unresolvedCount: row.unresolved_count,
    stagedPhotoRelPath: row.staged_photo_rel_path,
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
  };
}

export async function getReconcileSessionById(
  exec: SqlExecutor,
  sessionId: number,
): Promise<ReconcileSession | null> {
  const row = await exec.getFirstAsync<ReconcileSessionDbRow>(
    `SELECT id, uid, status, total_checked, created_at, modified_at
     FROM reconciliation_sessions WHERE id = ?`,
    [sessionId],
  );
  return row ? mapReconcileSession(row) : null;
}

export async function listReconcileSessionCards(
  exec: SqlExecutor,
  sessionId: number,
): Promise<ReconcileSessionCard[]> {
  const rows = await exec.getAllAsync<ReconcileCardDbRow>(
    `SELECT id, uid, session_id, contact_id, card_status, diff_json, unresolved_count,
            staged_photo_rel_path, created_at, modified_at
     FROM reconciliation_session_cards WHERE session_id = ? ORDER BY id`,
    [sessionId],
  );
  return rows.map(mapCard);
}

/**
 * Return the one newest pending session and terminally sweep older work.
 * Card payloads are intentionally never parsed in this sweep; cleanup only
 * needs the first-class durable staging-path column.
 */
export async function getResumableReconcileSession(
  exec: SqlExecutor,
  now: string,
): Promise<{
  session: ReconcileSession;
  cards: ReconcileSessionCard[];
  sweptStagedPhotoRelPaths: string[];
} | null> {
  const pending = await exec.getAllAsync<ReconcileSessionDbRow>(
    `SELECT id, uid, status, total_checked, created_at, modified_at
     FROM reconciliation_sessions WHERE status = 'pending'
     ORDER BY created_at DESC, id DESC`,
  );
  const newest = pending[0];
  if (!newest) return null;

  const sweptStagedPhotoRelPaths: string[] = [];
  for (const stale of pending.slice(1)) {
    sweptStagedPhotoRelPaths.push(...(await discardSession(exec, stale.id, now)));
  }
  return {
    session: mapReconcileSession(newest),
    cards: await listReconcileSessionCards(exec, newest.id),
    sweptStagedPhotoRelPaths,
  };
}

/**
 * A deliberately corruption-tolerant descriptor read for resume/discard UI.
 * It never touches a card payload, including malformed `diff_json`.
 */
export async function getNewestPendingReconcileSessionId(
  exec: SqlExecutor,
): Promise<number | null> {
  const row = await exec.getFirstAsync<{ id: number }>(
    `SELECT id FROM reconciliation_sessions WHERE status = 'pending'
     ORDER BY created_at DESC, id DESC LIMIT 1`,
  );
  return row?.id ?? null;
}

export interface ReconcileCompletionCounts {
  checked: number;
  changed: number;
  updated: number;
  keptOrbitValues: number;
  sourceMissing: number;
  unresolved: number;
}

/**
 * Completion buckets. A resolved card's durable diff payload optionally carries
 * the completed action written by the bulk/detail owner; cards without one are
 * still counted as changed but not guessed as an update or Keep-Orbit choice.
 */
export async function reconcileCompletionCounts(
  exec: SqlExecutor,
  sessionId: number,
): Promise<ReconcileCompletionCounts> {
  const session = await exec.getFirstAsync<{ total_checked: number }>(
    "SELECT total_checked FROM reconciliation_sessions WHERE id = ?",
    [sessionId],
  );
  if (!session) {
    throw new Error(`reconcileCompletionCounts: no session id=${sessionId}`);
  }
  const rows = await exec.getAllAsync<{
    card_status: ReconcileCardStatus;
    completion_disposition: string | null;
    count: number;
  }>(
    `SELECT card_status,
            json_extract(diff_json, '$.completionDisposition') AS completion_disposition,
            COUNT(*) AS count
     FROM reconciliation_session_cards
     WHERE session_id = ?
     GROUP BY card_status, completion_disposition`,
    [sessionId],
  );
  const counts: ReconcileCompletionCounts = {
    checked: session.total_checked,
    changed: 0,
    updated: 0,
    keptOrbitValues: 0,
    sourceMissing: 0,
    unresolved: 0,
  };
  for (const row of rows) {
    counts.changed += row.count;
    if (row.card_status === "missing_source") counts.sourceMissing += row.count;
    if (row.card_status === "unresolved" || row.card_status === "partial") {
      counts.unresolved += row.count;
    }
    if (row.completion_disposition === "updated") counts.updated += row.count;
    if (row.completion_disposition === "kept-orbit") {
      counts.keptOrbitValues += row.count;
    }
  }
  return counts;
}
