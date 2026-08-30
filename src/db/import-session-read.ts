import {
  discardSession,
  type ImportMatchOutcome,
  type ImportSessionMode,
  type ImportSessionRowStatus,
} from "@/db/import-session-dao";
import type { SqlExecutor } from "@/db/types";
import { isBirthdayUnreadable } from "@/logic/picked-contact-map";

export interface ImportSession {
  id: number;
  uid: string;
  mode: ImportSessionMode;
  status: "pending" | "complete" | "discarded";
  batchCategoryId: number | null;
  batchTrackingEnabled: boolean;
  phoneRegion: string | null;
  totalRows: number;
  createdAt: string;
  modifiedAt: string;
}

export interface ImportSessionRow {
  id: number;
  uid: string;
  sessionId: number;
  externalContactId: string;
  sourcePayload: string;
  photoRelPath: string | null;
  rowStatus: ImportSessionRowStatus;
  matchOutcome: ImportMatchOutcome | null;
  matchedContactId: number | null;
  candidates: unknown[];
  contactId: number | null;
  failureReason: string | null;
  photoFailed: boolean;
  createdAt: string;
  modifiedAt: string;
}

interface ImportSessionDbRow {
  id: number;
  uid: string;
  mode: ImportSessionMode;
  status: "pending" | "complete" | "discarded";
  batch_category_id: number | null;
  batch_tracking_enabled: number;
  phone_region: string | null;
  total_rows: number;
  created_at: string;
  modified_at: string;
}

function mapSession(row: ImportSessionDbRow): ImportSession {
  return {
    id: row.id,
    uid: row.uid,
    mode: row.mode,
    status: row.status,
    batchCategoryId: row.batch_category_id,
    batchTrackingEnabled: row.batch_tracking_enabled === 1,
    phoneRegion: row.phone_region,
    totalRows: row.total_rows,
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
  };
}

function parseCandidates(value: string | null): unknown[] {
  if (value === null) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sourceBirthday(value: string): string | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return null;
    const birthday = (parsed as { birthday?: unknown }).birthday;
    return typeof birthday === "string" ? birthday : null;
  } catch {
    return null;
  }
}

/** Read one durable session by its local id. */
export async function getSessionById(
  exec: SqlExecutor,
  sessionId: number,
): Promise<ImportSession | null> {
  const row = await exec.getFirstAsync<ImportSessionDbRow>(
    `SELECT id, uid, mode, status, batch_category_id, batch_tracking_enabled,
            phone_region, total_rows, created_at, modified_at
     FROM import_sessions WHERE id = ?`,
    [sessionId],
  );
  return row ? mapSession(row) : null;
}

/**
 * Return the newest resumable session. Older pending sessions are terminally
 * discarded so launch can offer exactly one resume choice, with their staged
 * paths returned for the caller's post-commit cleanup.
 */
export async function getResumableSession(
  exec: SqlExecutor,
  now: string,
): Promise<{ session: ImportSession; sweptPhotoRelPaths: string[] } | null> {
  const pending = await exec.getAllAsync<ImportSessionDbRow>(
    `SELECT id, uid, mode, status, batch_category_id, batch_tracking_enabled,
            phone_region, total_rows, created_at, modified_at
     FROM import_sessions WHERE status = 'pending'
     ORDER BY created_at DESC, id DESC`,
  );
  const newest = pending[0];
  if (!newest) return null;

  const sweptPhotoRelPaths: string[] = [];
  for (const stale of pending.slice(1)) {
    sweptPhotoRelPaths.push(...(await discardSession(exec, stale.id, now)));
  }
  return { session: mapSession(newest), sweptPhotoRelPaths };
}

interface ImportSessionRowDbRow {
  id: number;
  uid: string;
  session_id: number;
  external_contact_id: string;
  source_payload: string;
  photo_rel_path: string | null;
  row_status: ImportSessionRowStatus;
  match_outcome: ImportMatchOutcome | null;
  matched_contact_id: number | null;
  candidates_json: string | null;
  contact_id: number | null;
  failure_reason: string | null;
  photo_failed: number;
  created_at: string;
  modified_at: string;
}

/** Stable-id ordered session rows; malformed candidate JSON is treated as empty. */
export async function listSessionRows(
  exec: SqlExecutor,
  sessionId: number,
): Promise<ImportSessionRow[]> {
  const rows = await exec.getAllAsync<ImportSessionRowDbRow>(
    `SELECT id, uid, session_id, external_contact_id, source_payload, photo_rel_path,
            row_status, match_outcome, matched_contact_id, candidates_json, contact_id,
            failure_reason, photo_failed, created_at, modified_at
     FROM import_session_rows WHERE session_id = ? ORDER BY id`,
    [sessionId],
  );
  return rows.map((row) => ({
    id: row.id,
    uid: row.uid,
    sessionId: row.session_id,
    externalContactId: row.external_contact_id,
    sourcePayload: row.source_payload,
    photoRelPath: row.photo_rel_path,
    rowStatus: row.row_status,
    matchOutcome: row.match_outcome,
    matchedContactId: row.matched_contact_id,
    candidates: parseCandidates(row.candidates_json),
    contactId: row.contact_id,
    failureReason: row.failure_reason,
    photoFailed: row.photo_failed === 1,
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
  }));
}

export interface SessionRowCounts {
  pending: number;
  imported: number;
  linked: number;
  needs_review: number;
  failed: number;
  skipped: number;
}

/** Six raw states for drivers and terminal-transition checks. */
export async function sessionRowCounts(
  exec: SqlExecutor,
  sessionId: number,
): Promise<SessionRowCounts> {
  const rows = await exec.getAllAsync<{
    row_status: ImportSessionRowStatus;
    count: number;
  }>(
    `SELECT row_status, COUNT(*) AS count FROM import_session_rows
     WHERE session_id = ? GROUP BY row_status`,
    [sessionId],
  );
  const counts: SessionRowCounts = {
    pending: 0,
    imported: 0,
    linked: 0,
    needs_review: 0,
    failed: 0,
    skipped: 0,
  };
  for (const row of rows) counts[row.row_status] = row.count;
  return counts;
}

export interface SessionSummaryCounts {
  imported: number;
  alreadyInOrbit: number;
  needReview: number;
  failedOrSkipped: number;
  nameRequiredSkipped: number;
  birthdayUnreadable: number;
}

/**
 * Completion-report buckets from the canonical state transition table. The
 * grouped durable row query distinguishes deterministic already-linked skips
 * from a user-directed Skip.
 */
export async function sessionSummaryCounts(
  exec: SqlExecutor,
  sessionId: number,
): Promise<SessionSummaryCounts> {
  const rows = await exec.getAllAsync<{
    row_status: ImportSessionRowStatus;
    match_outcome: ImportMatchOutcome | null;
    failure_reason: string | null;
    count: number;
  }>(
    `SELECT row_status, match_outcome, failure_reason, COUNT(*) AS count
     FROM import_session_rows WHERE session_id = ?
     GROUP BY row_status, match_outcome, failure_reason`,
    [sessionId],
  );
  const counts: SessionSummaryCounts = {
    imported: 0,
    alreadyInOrbit: 0,
    needReview: 0,
    failedOrSkipped: 0,
    nameRequiredSkipped: 0,
    birthdayUnreadable: 0,
  };
  for (const row of rows) {
    if (row.row_status === "imported" || row.row_status === "linked")
      counts.imported += row.count;
    if (row.match_outcome === "already_linked")
      counts.alreadyInOrbit += row.count;
    if (row.row_status === "needs_review") counts.needReview += row.count;
    if (
      row.row_status === "skipped" &&
      row.failure_reason === "name-required"
    ) {
      counts.nameRequiredSkipped += row.count;
      continue;
    }
    if (
      row.row_status === "failed" ||
      (row.row_status === "skipped" && row.match_outcome !== "already_linked")
    ) {
      counts.failedOrSkipped += row.count;
    }
  }
  const importedPayloads = await exec.getAllAsync<{ source_payload: string }>(
    `SELECT source_payload FROM import_session_rows
     WHERE session_id = ? AND row_status = 'imported'`,
    [sessionId],
  );
  counts.birthdayUnreadable = importedPayloads.reduce(
    (count, row) =>
      count +
      (isBirthdayUnreadable(sourceBirthday(row.source_payload)) ? 1 : 0),
    0,
  );
  return counts;
}
