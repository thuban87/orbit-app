import {
  discardSession,
  type ReconcileCardStatus,
  type ReconcileSessionStatus,
} from "@/db/reconcile-session-dao";
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

export function mapReconcileSession(
  row: ReconcileSessionDbRow,
): ReconcileSession {
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

/** Display identity for review cards: the live contact's name and stored photo. */
export interface ReconcileCardIdentity {
  contactId: number;
  name: string;
  photo: string | null;
}

/**
 * Resolve review-card identity from the live contact rows (RG-031,
 * AUD-UIA-019). Cards must name the real person, never a database id.
 */
export async function listReconcileCardIdentities(
  exec: SqlExecutor,
  contactIds: readonly number[],
): Promise<Map<number, ReconcileCardIdentity>> {
  const ids = [...new Set(contactIds)];
  if (ids.length === 0) return new Map();
  const rows = await exec.getAllAsync<{
    id: number;
    name: string;
    photo: string | null;
  }>(
    `SELECT id, name, photo FROM contacts WHERE id IN (${ids.map(() => "?").join(",")})`,
    ids,
  );
  return new Map(
    rows.map((row) => [
      row.id,
      { contactId: row.id, name: row.name, photo: row.photo },
    ]),
  );
}

/**
 * Cards still to check in a session (38.12 D-105): unresolved or partial — the
 * predicate the card writers and staging cleanup use for live work.
 */
export async function countReconcileCardsLeft(
  exec: SqlExecutor,
  sessionId: number,
): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM reconciliation_session_cards
     WHERE session_id = ? AND card_status IN ('unresolved', 'partial')`,
    [sessionId],
  );
  return row?.n ?? 0;
}

export interface NewestResumableReconcile {
  session: ReconcileSession;
  /** Unresolved + partial cards (D-105). */
  cardsLeft: number;
  /** When the resume prompt was shown for this check; null = never (D-105). */
  resumePromptedAt: string | null;
}

/**
 * The newest pending check with its "left" count (38.12 D-56, D-105). No side
 * effects and no card payload parsing, so a malformed card cannot hide the
 * session. Stale cleanup is the separate launch-only
 * `discardStaleReconcileSessions`.
 */
export async function getNewestResumableReconcileSession(
  exec: SqlExecutor,
): Promise<NewestResumableReconcile | null> {
  const newest = await exec.getFirstAsync<
    ReconcileSessionDbRow & { resume_prompted_at: string | null }
  >(
    `SELECT id, uid, status, total_checked, created_at, modified_at,
            resume_prompted_at
     FROM reconciliation_sessions WHERE status = 'pending'
     ORDER BY created_at DESC, id DESC LIMIT 1`,
  );
  if (!newest) return null;
  return {
    session: mapReconcileSession(newest),
    cardsLeft: await countReconcileCardsLeft(exec, newest.id),
    resumePromptedAt: newest.resume_prompted_at,
  };
}

/**
 * Launch cleanup (38.12 D-56): terminally discard every pending check older
 * than the newest so launch offers exactly one. Card payloads are never
 * parsed; cleanup needs only the first-class staging-path column. Returns the
 * swept staged paths for the caller's post-commit file cleanup.
 */
export async function discardStaleReconcileSessions(
  exec: SqlExecutor,
  now: string,
): Promise<string[]> {
  const pending = await exec.getAllAsync<{ id: number }>(
    `SELECT id FROM reconciliation_sessions WHERE status = 'pending'
     ORDER BY created_at DESC, id DESC`,
  );
  const sweptStagedPhotoRelPaths: string[] = [];
  for (const stale of pending.slice(1)) {
    sweptStagedPhotoRelPaths.push(
      ...(await discardSession(exec, stale.id, now)),
    );
  }
  return sweptStagedPhotoRelPaths;
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
 * Completion buckets. Every card in the session counts as changed. A finished
 * card's diff_json carries `completionDisposition` ("updated" or "kept-orbit"),
 * written by setCardCompletionDispositionCore when the grid's bulk action or
 * the detail Apply finishes it; those two buckets count only that field, so a
 * card without one (partial, unresolved, or a missing source kept as is) is in
 * neither. Missing-source and unresolved/partial cards are counted by status.
 * The buckets are exclusive (D-141): a missing-source card is never also
 * counted by its disposition, so every finished card is in exactly one.
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
    // Exclusive buckets (D-141): a missing-source card counts once, in the
    // sourceMissing bucket, even when the grid's bulk Keep Orbit finished it with
    // a "kept-orbit" disposition.
    if (row.card_status === "missing_source") continue;
    if (row.completion_disposition === "updated") counts.updated += row.count;
    if (row.completion_disposition === "kept-orbit") {
      counts.keptOrbitValues += row.count;
    }
  }
  return counts;
}
