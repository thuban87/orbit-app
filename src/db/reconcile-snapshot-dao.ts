import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import {
  type ReconcileFieldFamily,
  type ReconcileMethod,
  serializeMethodFamily,
} from "@/logic/reconcile-diff";

export interface UpsertReviewedSnapshotInput {
  externalContactLinkId: number;
  fieldFamily: ReconcileFieldFamily;
  /** Methods are encoded with reconcile-diff's shared canonical set serializer. */
  reviewedValue: string | null | readonly ReconcileMethod[];
  reviewedAt: string;
}

export type ReviewedSnapshotMap = Partial<
  Record<ReconcileFieldFamily, string | null>
>;

function assertOneChange(
  changes: number,
  input: UpsertReviewedSnapshotInput,
): void {
  if (changes !== 1) {
    throw new Error(
      `upsertReviewedSnapshot: expected one ${input.fieldFamily} row for link=${input.externalContactLinkId} (changed ${changes})`,
    );
  }
}

export function reviewedValueFor(
  fieldFamily: ReconcileFieldFamily,
  value: UpsertReviewedSnapshotInput["reviewedValue"],
): string | null {
  if (value != null && typeof value !== "string") {
    if (fieldFamily !== "phones" && fieldFamily !== "emails") {
      throw new Error(`method family value is invalid for ${fieldFamily}`);
    }
    const type = fieldFamily === "phones" ? "phone" : "email";
    return serializeMethodFamily(
      value.filter((method) => method.type === type),
    );
  }
  return value;
}

/** Caller-owned transaction body; never wraps its own mutex/BEGIN. */
export async function upsertReviewedSnapshotCore(
  exec: SqlExecutor,
  input: UpsertReviewedSnapshotInput,
): Promise<void> {
  const reviewedValue = reviewedValueFor(
    input.fieldFamily,
    input.reviewedValue,
  );
  const result = await exec.runAsync(
    `INSERT INTO reconcile_source_snapshot
       (uid, external_contact_link_id, field_family, reviewed_value, reviewed_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(external_contact_link_id, field_family) DO UPDATE SET
       reviewed_value = excluded.reviewed_value,
       reviewed_at = excluded.reviewed_at`,
    [
      newUid(),
      input.externalContactLinkId,
      input.fieldFamily,
      reviewedValue,
      input.reviewedAt,
    ],
  );
  assertOneChange(result.changes, input);
}

export function upsertReviewedSnapshot(
  exec: SqlExecutor,
  input: UpsertReviewedSnapshotInput,
): Promise<void> {
  return inWriteTransaction(exec, () =>
    upsertReviewedSnapshotCore(exec, input),
  );
}

export interface RecordImportedPhotoFingerprintInput {
  rowId: number;
  contactId: number;
  now: string;
}

function payloadFingerprint(sourcePayload: string): string | null {
  try {
    const parsed: unknown = JSON.parse(sourcePayload);
    if (parsed === null || typeof parsed !== "object") return null;
    const value = (parsed as { photoFingerprint?: unknown }).photoFingerprint;
    return typeof value === "string" && value !== "" ? value : null;
  } catch {
    return null;
  }
}

/**
 * D-132: when an import adopts the phone's photo, remember the bridge's photo
 * fingerprint as the link's reviewed 'photo' value so the first Check linked
 * contacts does not ask about a photo Orbit just took from the phone.
 *
 * Caller-owned transaction body; never wraps its own mutex/BEGIN. Missing
 * data (no row, no/invalid fingerprint, no active link) is a silent no-op.
 */
export async function recordImportedPhotoFingerprintCore(
  exec: SqlExecutor,
  input: RecordImportedPhotoFingerprintInput,
): Promise<void> {
  const row = await exec.getFirstAsync<{
    source_payload: string;
    external_contact_id: string;
  }>(
    "SELECT source_payload, external_contact_id FROM import_session_rows WHERE id = ?",
    [input.rowId],
  );
  if (!row) return;
  const fingerprint = payloadFingerprint(row.source_payload);
  if (fingerprint === null) return;
  const link = await exec.getFirstAsync<{ id: number }>(
    `SELECT id FROM external_contact_links
      WHERE contact_id = ? AND external_contact_id = ? AND is_active = 1
      ORDER BY id DESC LIMIT 1`,
    [input.contactId, row.external_contact_id],
  );
  if (!link) return;
  await upsertReviewedSnapshotCore(exec, {
    externalContactLinkId: link.id,
    fieldFamily: "photo",
    reviewedValue: fingerprint,
    reviewedAt: input.now,
  });
}

/** Locked wrapper: the only form callers outside a transaction may use. */
export function recordImportedPhotoFingerprint(
  exec: SqlExecutor,
  input: RecordImportedPhotoFingerprintInput,
): Promise<void> {
  return inWriteTransaction(exec, () =>
    recordImportedPhotoFingerprintCore(exec, input),
  );
}

/** Read shape consumed directly by classifyReconciliation's `lastReviewed` input. */
export async function getReviewedSnapshots(
  exec: SqlExecutor,
  externalContactLinkId: number,
): Promise<ReviewedSnapshotMap> {
  const rows = await exec.getAllAsync<{
    field_family: ReconcileFieldFamily;
    reviewed_value: string | null;
  }>(
    `SELECT field_family, reviewed_value
       FROM reconcile_source_snapshot
      WHERE external_contact_link_id = ?
      ORDER BY field_family`,
    [externalContactLinkId],
  );
  return Object.fromEntries(
    rows.map((row) => [row.field_family, row.reviewed_value]),
  ) as ReviewedSnapshotMap;
}
