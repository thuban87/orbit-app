import { newUid } from "@/db/uid";
import { serializeMethodFamily, type ReconcileFieldFamily, type ReconcileMethod } from "@/logic/reconcile-diff";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

export interface UpsertReviewedSnapshotInput {
  externalContactLinkId: number;
  fieldFamily: ReconcileFieldFamily;
  /** Methods are encoded with reconcile-diff's shared canonical set serializer. */
  reviewedValue: string | null | readonly ReconcileMethod[];
  reviewedAt: string;
}

export type ReviewedSnapshotMap = Partial<Record<ReconcileFieldFamily, string | null>>;

function assertOneChange(changes: number, input: UpsertReviewedSnapshotInput): void {
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
    return serializeMethodFamily(value.filter((method) => method.type === type));
  }
  return value;
}

/** Caller-owned transaction body; never wraps its own mutex/BEGIN. */
export async function upsertReviewedSnapshotCore(
  exec: SqlExecutor,
  input: UpsertReviewedSnapshotInput,
): Promise<void> {
  const reviewedValue = reviewedValueFor(input.fieldFamily, input.reviewedValue);
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
  return inWriteTransaction(exec, () => upsertReviewedSnapshotCore(exec, input));
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
