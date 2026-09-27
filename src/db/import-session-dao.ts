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
 * | Event | row_status | match_outcome | contact_id | photo_rel_path | Writer |
 * | --- | --- | --- | --- | --- | --- |
 * | accepted | pending | NULL | NULL | unchanged | acceptImportSessionWithRows |
 * | already-linked | skipped | already_linked | NULL | unchanged | resolveAlreadyLinked(Core) |
 * | import as new | imported | new | set | unchanged | importer composition |
 * | link existing | linked | probable/possible | set | unchanged | link composition |
 * | ambiguous deferred | needs_review | probable/possible/needs_review | NULL | unchanged | deferNeedsReview(Core) |
 * | user Skip | skipped | prior or NULL, never already_linked | NULL | unchanged | markRowStatus |
 * | nameless bulk row | skipped | NULL | NULL | unchanged | importRowAsNew (failure_reason='name-required') |
 * | import failure | failed | prior | NULL | unchanged | markRowStatus |
 * | photo-only failure | unchanged | unchanged | unchanged | unchanged | markRowPhotoFailed |
 * | staging retired (success) | unchanged | unchanged | unchanged | photo_rel_path → NULL | retireRowStagedPhoto |
 */
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

/** A committed contact can still own unfinished photo work. */
export const PHOTO_OUTSTANDING =
  "r.row_status = 'imported' AND r.contact_id IS NOT NULL AND r.photo_rel_path IS NOT NULL";

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

/**
 * The lifecycle every contact a bulk import creates receives (38.4 D-57;
 * ADR-062): Bound with a positive cadence, or Unbound and never-assigned.
 */
export type ImportLifecycle =
  | { trackingEnabled: true; intervalDays: number }
  | { trackingEnabled: false; intervalDays: null };

/** The default batch lifecycle (ADR-066: Unbound stays the default). */
export const UNBOUND_IMPORT: ImportLifecycle = Object.freeze({
  trackingEnabled: false,
  intervalDays: null,
}) as ImportLifecycle;

export class InvalidImportLifecycleError extends Error {
  constructor(detail: string) {
    super(`Invalid import lifecycle: ${detail}`);
    this.name = "InvalidImportLifecycleError";
  }
}

/**
 * Reject a lifecycle that breaks the Bound ⇒ positive-cadence pairing (ADR-062)
 * or carries a cadence while Unbound. Every writer calls this before any write.
 */
export function assertImportLifecycle(
  lifecycle: ImportLifecycle,
): asserts lifecycle is ImportLifecycle {
  if (typeof lifecycle !== "object" || lifecycle === null) {
    throw new InvalidImportLifecycleError("missing");
  }
  const { trackingEnabled, intervalDays } = lifecycle as {
    trackingEnabled: unknown;
    intervalDays: unknown;
  };
  if (trackingEnabled === true) {
    if (
      typeof intervalDays !== "number" ||
      !Number.isInteger(intervalDays) ||
      intervalDays <= 0
    ) {
      throw new InvalidImportLifecycleError(
        `Bound needs a positive integer cadence, got ${String(intervalDays)}`,
      );
    }
    return;
  }
  if (trackingEnabled === false) {
    if (intervalDays !== null) {
      throw new InvalidImportLifecycleError(
        `Unbound carries no cadence, got ${String(intervalDays)}`,
      );
    }
    return;
  }
  throw new InvalidImportLifecycleError(
    `trackingEnabled must be a boolean, got ${String(trackingEnabled)}`,
  );
}

export interface CreateImportSessionInput {
  uid: string;
  mode: ImportSessionMode;
  batchCategoryId: number | null;
  batchTrackingEnabled: boolean;
  /** The batch cadence when Bound (38.4 D-57); omitted means none (NULL). */
  batchIntervalDays?: number | null;
  phoneRegion: string | null;
  now: string;
}

/** Validate a session's tracking flag and cadence together (D-57). */
function assertSessionLifecycle(input: CreateImportSessionInput): void {
  assertImportLifecycle({
    trackingEnabled: input.batchTrackingEnabled,
    intervalDays: input.batchIntervalDays ?? null,
  } as ImportLifecycle);
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
       (uid, mode, batch_category_id, batch_tracking_enabled, batch_interval_days,
        phone_region, total_rows, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.uid,
      input.mode,
      input.batchCategoryId,
      input.batchTrackingEnabled ? 1 : 0,
      input.batchIntervalDays ?? null,
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
  try {
    assertSessionLifecycle(input);
  } catch (error) {
    return Promise.reject(error);
  }
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
  try {
    assertSessionLifecycle(input.session);
  } catch (error) {
    return Promise.reject(error);
  }
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

export async function retireRowStagedPhotoCore(
  exec: SqlExecutor,
  rowId: number,
  now: string,
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE import_session_rows
     SET photo_rel_path = NULL, modified_at = ?
     WHERE id = ?`,
    [now, rowId],
  );
  assertOneChange(result, "retireRowStagedPhotoCore", rowId);
}

export function retireRowStagedPhoto(
  exec: SqlExecutor,
  rowId: number,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, () =>
    retireRowStagedPhotoCore(exec, rowId, now),
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

export interface SessionBatchDefaults {
  categoryId: number | null;
  lifecycle: ImportLifecycle;
}

/**
 * Persist a bulk batch's category AND lifecycle in ONE update (38.4 D-57).
 * Setup calls this before any contact is created — on Import and on Combine —
 * so an interrupted import resumes with the same batch choice. The lifecycle
 * is validated first: an invalid one writes nothing.
 */
export function setSessionBatchDefaults(
  exec: SqlExecutor,
  sessionId: number,
  defaults: SessionBatchDefaults,
  now: string,
): Promise<void> {
  try {
    assertImportLifecycle(defaults.lifecycle);
  } catch (error) {
    return Promise.reject(error);
  }
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      `UPDATE import_sessions
       SET batch_category_id = ?, batch_tracking_enabled = ?,
           batch_interval_days = ?, modified_at = ?
       WHERE id = ?`,
      [
        defaults.categoryId,
        defaults.lifecycle.trackingEnabled ? 1 : 0,
        defaults.lifecycle.intervalDays,
        now,
        sessionId,
      ],
    );
    assertOneChange(result, "setSessionBatchDefaults", sessionId);
  });
}

/** Reassign every session regardless of lifecycle status inside a caller-owned transaction. */
export async function reassignImportSessionsCategoryCore(
  exec: SqlExecutor,
  sourceCategoryId: number,
  targetCategoryId: number | null,
  now: string,
): Promise<number> {
  const result = await exec.runAsync(
    `UPDATE import_sessions SET batch_category_id = ?, modified_at = ?
      WHERE batch_category_id = ?`,
    [targetCategoryId, now, sourceCategoryId],
  );
  return result.changes;
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
