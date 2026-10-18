import { sanitiseImportLifecycle } from "@/db/import-lifecycle";
import {
  discardSession,
  IN_BIN_REASON,
  type ImportLifecycle,
  type ImportMatchOutcome,
  type ImportSessionMode,
  type ImportSessionRowStatus,
  PHOTO_OUTSTANDING,
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
  /** The batch cadence when Bound (38.4 D-57; migration 032); else null. */
  batchIntervalDays: number | null;
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
  batch_interval_days: number | null;
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
    batchIntervalDays: row.batch_interval_days,
    phoneRegion: row.phone_region,
    totalRows: row.total_rows,
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
  };
}

/**
 * The batch lifecycle every bulk create reads (38.4 D-57): Bound with the
 * session's cadence, or Unbound. The session is the ONLY source — there is no
 * in-pass override, so a resumed import keeps the choice made at setup.
 */
export function sessionBatchLifecycle(
  session: Pick<ImportSession, "batchTrackingEnabled" | "batchIntervalDays">,
): ImportLifecycle {
  // 38.12 D-58: the one sanitiser bulk setup's restore also uses.
  return sanitiseImportLifecycle({
    trackingEnabled: session.batchTrackingEnabled,
    intervalDays: session.batchIntervalDays,
  });
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
            batch_interval_days, phone_region, total_rows, created_at, modified_at
     FROM import_sessions WHERE id = ?`,
    [sessionId],
  );
  return row ? mapSession(row) : null;
}

/**
 * Every resumable session, newest first: still pending, or a completed session
 * whose committed contacts still have a staged photo to add (convergence c2
 * B-6 — photo-only recovery stays reachable).
 */
async function listResumableImportSessions(
  exec: SqlExecutor,
): Promise<Array<ImportSessionDbRow & { resume_prompted_at: string | null }>> {
  return exec.getAllAsync(
    `SELECT id, uid, mode, status, batch_category_id, batch_tracking_enabled,
            batch_interval_days, phone_region, total_rows, created_at, modified_at,
            resume_prompted_at
     FROM import_sessions s WHERE status = 'pending'
       OR EXISTS (SELECT 1 FROM import_session_rows r
                   WHERE r.session_id = s.id AND ${PHOTO_OUTSTANDING})
     ORDER BY created_at DESC, id DESC`,
  );
}

/**
 * People still to finish in an import (38.12 D-111): pending, needs_review and
 * failed rows. Failed rows are retryable from Import complete and keep the
 * session pending (`finalizeSessionIfTerminal`), so they count (convergence c5
 * F-2).
 */
export function importPeopleLeft(
  counts: Pick<SessionRowCounts, "pending" | "needs_review" | "failed">,
): number {
  return counts.pending + counts.needs_review + counts.failed;
}

export interface NewestResumableImport {
  session: ImportSession;
  /** pending + needs_review + failed rows (F-2). */
  peopleLeft: number;
  /** Imported rows with a contact and a staged photo still to add (B-6). */
  photosLeft: number;
  /** When the resume prompt was shown for this session; null = never (D-111). */
  resumePromptedAt: string | null;
}

/**
 * The newest resumable import with its "left" counts (38.12 D-56). No side
 * effects: the resume prompt's sweep, the Settings row and the new-import
 * pre-check all read through this. Stale-session cleanup is the separate
 * launch-only `discardStaleImportSessions`.
 */
export async function getNewestResumableImportSession(
  exec: SqlExecutor,
): Promise<NewestResumableImport | null> {
  const [newest] = await listResumableImportSessions(exec);
  if (!newest) return null;
  const [counts, photos] = await Promise.all([
    sessionRowCounts(exec, newest.id),
    exec.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM import_session_rows r
       WHERE r.session_id = ? AND ${PHOTO_OUTSTANDING}`,
      [newest.id],
    ),
  ]);
  return {
    session: mapSession(newest),
    peopleLeft: importPeopleLeft(counts),
    photosLeft: photos?.n ?? 0,
    resumePromptedAt: newest.resume_prompted_at,
  };
}

/**
 * Launch cleanup (38.12 D-56): terminally discard every OLDER pending session
 * so launch offers exactly one resume choice. A completed session with
 * outstanding photos is never discarded (B-6), and neither is the newest
 * resumable session whatever its rows (F-2). Returns the swept staged paths
 * for the caller's post-commit file cleanup.
 */
export async function discardStaleImportSessions(
  exec: SqlExecutor,
  now: string,
): Promise<string[]> {
  const candidates = await listResumableImportSessions(exec);
  const sweptPhotoRelPaths: string[] = [];
  for (const stale of candidates
    .slice(1)
    .filter((session) => session.status === "pending")) {
    sweptPhotoRelPaths.push(...(await discardSession(exec, stale.id, now)));
  }
  return sweptPhotoRelPaths;
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

/** One person in a completion-report bucket (38.12 D-109). */
export interface SummaryPerson {
  /** The import row the person came from (stable list key). */
  rowId: number;
  /**
   * The Orbit contact's current name when the row resolved to one, else the
   * phone contact's display name, else `UNNAMED_IMPORT_ROW`.
   */
  name: string;
  /** The Orbit contact the row resolved to, when it still exists. */
  contactId: number | null;
}

export interface SummaryBucket {
  count: number;
  people: SummaryPerson[];
}

/** The mutually exclusive person-outcome buckets (38.12 D-55). */
export type SummaryBucketKey =
  | "imported"
  | "linked"
  | "alreadyInOrbit"
  /** Already linked to a person in the Bin (38.12 D-154). */
  | "inBin"
  | "skippedByUser"
  | "skippedNoName"
  | "failed"
  | "needsReview";

export type SessionSummaryCounts = Record<SummaryBucketKey, SummaryBucket> & {
  /** Imported rows whose phone birthday was present but unreadable. */
  birthdayUnreadable: number;
};

/** The label for a row with no usable name (DuplicateReview's wording). */
export const UNNAMED_IMPORT_ROW = "Unnamed contact";

interface SummaryRowDbRow {
  id: number;
  row_status: ImportSessionRowStatus;
  match_outcome: ImportMatchOutcome | null;
  failure_reason: string | null;
  source_payload: string;
  resolved_contact_id: number | null;
  contact_name: string | null;
}

function sourceDisplayName(value: string): string | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return null;
    const name = (parsed as { displayName?: unknown }).displayName;
    return typeof name === "string" && name.trim() !== "" ? name.trim() : null;
  } catch {
    return null;
  }
}

/**
 * The one bucket a row belongs to (38.12 D-55; convergence c5 F-1). The
 * CURRENT row_status decides first: failure_reason is history, not state — a
 * row that failed and then succeeded on Retry is `imported` with its old
 * reason still set (`setRowContactCore` writes contact_id/row_status only), so
 * imported and linked ignore it. Only skipped rows split by match_outcome and
 * failure_reason: already-linked (B-2: `resolveAlreadyLinkedCore` writes
 * skipped + already_linked; with the 'in-bin' reason it is the D-154 "In the
 * Bin" outcome), name-required (B-3), a NULL reason
 * (the user's Skip). A skipped row with any other reason — no writer produces
 * one today — reads as failed. Pending rows have no bucket.
 */
export function summaryBucketFor(row: {
  rowStatus: ImportSessionRowStatus;
  matchOutcome: ImportMatchOutcome | null;
  failureReason: string | null;
}): SummaryBucketKey | null {
  switch (row.rowStatus) {
    case "imported":
      return "imported";
    case "linked":
      return "linked";
    case "needs_review":
      return "needsReview";
    case "failed":
      return "failed";
    case "pending":
      return null;
    case "skipped":
      if (row.matchOutcome === "already_linked")
        return row.failureReason === IN_BIN_REASON ? "inBin" : "alreadyInOrbit";
      if (row.failureReason === "name-required") return "skippedNoName";
      if (row.failureReason === null) return "skippedByUser";
      return "failed";
  }
}

function emptyBucket(): SummaryBucket {
  return { count: 0, people: [] };
}

/**
 * Completion-report buckets with the people in each (38.12 D-55, D-109). Every
 * non-pending row lands in exactly one bucket (`summaryBucketFor`), named by
 * the Orbit contact it resolved to (imported/linked: `contact_id`;
 * already-linked: `matched_contact_id`) or else by the phone contact's display
 * name. `birthdayUnreadable` counts imported rows whose present source birthday
 * cannot be read, as before.
 */
export async function sessionSummaryCounts(
  exec: SqlExecutor,
  sessionId: number,
): Promise<SessionSummaryCounts> {
  const rows = await exec.getAllAsync<SummaryRowDbRow>(
    `SELECT r.id, r.row_status, r.match_outcome, r.failure_reason,
            r.source_payload, c.id AS resolved_contact_id, c.name AS contact_name
     FROM import_session_rows r
     LEFT JOIN contacts c ON c.id = CASE
       WHEN r.row_status IN ('imported', 'linked') THEN r.contact_id
       WHEN r.row_status = 'skipped' AND r.match_outcome = 'already_linked'
         THEN r.matched_contact_id
       ELSE NULL END
     WHERE r.session_id = ? ORDER BY r.id`,
    [sessionId],
  );
  const summary: SessionSummaryCounts = {
    imported: emptyBucket(),
    linked: emptyBucket(),
    alreadyInOrbit: emptyBucket(),
    inBin: emptyBucket(),
    skippedByUser: emptyBucket(),
    skippedNoName: emptyBucket(),
    failed: emptyBucket(),
    needsReview: emptyBucket(),
    birthdayUnreadable: 0,
  };
  for (const row of rows) {
    const key = summaryBucketFor({
      rowStatus: row.row_status,
      matchOutcome: row.match_outcome,
      failureReason: row.failure_reason,
    });
    if (key === null) continue;
    const bucket = summary[key];
    bucket.count += 1;
    bucket.people.push({
      rowId: row.id,
      name:
        row.contact_name?.trim() ||
        sourceDisplayName(row.source_payload) ||
        UNNAMED_IMPORT_ROW,
      contactId: row.resolved_contact_id,
    });
    if (
      row.row_status === "imported" &&
      isBirthdayUnreadable(sourceBirthday(row.source_payload))
    ) {
      summary.birthdayUnreadable += 1;
    }
  }
  return summary;
}
