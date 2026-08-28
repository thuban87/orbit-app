import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { insertTombstoneCore } from "@/db/tombstones-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import {
  type ContactMethodType,
  normalizeContactMethod,
} from "@/logic/contact-method-normalization";

export interface ContactMethodRow {
  id: number;
  uid: string;
  contact_id: number;
  method_type: ContactMethodType;
  raw_value: string;
  display_value: string;
  canonical_value: string | null;
  canonical_region: string | null;
  extension: string | null;
  is_actionable: number;
  is_primary: number;
  display_order: number;
  created_at: string;
  modified_at: string;
}

/** A form-owned draft. IDs seed existing rows; a uid is stable across a form save. */
export interface ContactMethodDraft {
  id?: number;
  uid: string;
  type: ContactMethodType;
  value: string;
  /** The form may explicitly choose one primary per type. */
  isPrimary?: boolean;
}

export interface ContactMethodNormalizationContext {
  effectivePhoneRegion?: string | null;
}

export type ContactMethodSaveResult =
  | { status: "saved"; methods: ContactMethodRow[] }
  | {
      status: "canonicalDuplicate";
      methodType: ContactMethodType;
      survivingDraftUid: string;
      methods: ContactMethodRow[];
    };

function assertOneChange(
  op: string,
  id: number,
  contactId: number,
  changes: number,
): void {
  if (changes !== 1) {
    throw new Error(
      `${op}: no contact method matched id=${id} for contactId=${contactId} (changed ${changes})`,
    );
  }
}

/** Ordered methods for a contact. This is intentionally the DAO's seed shape. */
export function listContactMethods(
  exec: SqlExecutor,
  contactId: number,
): Promise<ContactMethodRow[]> {
  return exec.getAllAsync<ContactMethodRow>(
    `SELECT id, uid, contact_id, method_type, raw_value, display_value,
            canonical_value, canonical_region, extension, is_actionable,
            is_primary, display_order, created_at, modified_at
       FROM contact_methods
      WHERE contact_id = ?
      ORDER BY method_type, display_order, id`,
    [contactId],
  );
}

type PreparedDraft = Omit<ContactMethodDraft, "isPrimary"> & {
  normalized: ReturnType<typeof normalizeContactMethod>;
  displayOrder: number;
  selectedPrimary: boolean;
  isPrimary: number;
};

/**
 * Apply an editor's seeded-vs-current method diff while a caller-owned write
 * transaction is open. Aggregate writers compose this core directly so there is
 * exactly one mutex/BEGIN for fields and methods together.
 */
export async function applyContactMethodDiffCore(
  exec: SqlExecutor,
  params: {
    contactId: number;
    seeded: ContactMethodRow[];
    current: ContactMethodDraft[];
    now: string;
    effectivePhoneRegion?: string | null;
  },
): Promise<ContactMethodSaveResult> {
  const prepared: PreparedDraft[] = [];
  const seenCanonical = new Map<string, ContactMethodDraft>();
  let collision: {
    methodType: ContactMethodType;
    survivingDraftUid: string;
  } | null = null;
  const orderByType: Record<ContactMethodType, number> = { phone: 0, email: 0 };

  for (const draft of params.current) {
    // Blank controls are draft-only UI state; nonblank invalid values are durable.
    if (!draft.value.trim()) continue;
    const normalized = normalizeContactMethod({
      type: draft.type,
      value: draft.value,
      defaultPhoneRegion: params.effectivePhoneRegion,
    });
    if (normalized.canonicalValue) {
      const key = `${draft.type}\u0000${normalized.canonicalValue}`;
      const survivor = seenCanonical.get(key);
      if (survivor) {
        collision ??= {
          methodType: draft.type,
          survivingDraftUid: survivor.uid,
        };
        continue;
      }
      seenCanonical.set(key, draft);
    }
    prepared.push({
      ...draft,
      normalized,
      displayOrder: orderByType[draft.type]++,
      selectedPrimary: draft.isPrimary === true,
      isPrimary: 0,
    });
  }

  // A selected draft wins; otherwise the first stored draft is primary. A
  // singleton is therefore primary even if invalid, matching migration seeding.
  for (const type of ["phone", "email"] as const) {
    const group = prepared.filter((row) => row.type === type);
    const primary = group.find((row) => row.selectedPrimary) ?? group[0];
    if (primary) primary.isPrimary = 1;
  }

  const seededById = new Map(params.seeded.map((row) => [row.id, row]));
  const currentIds = new Set(
    prepared.flatMap((row) => (row.id == null ? [] : [row.id])),
  );
  for (const row of prepared) {
    if (row.id != null && !seededById.has(row.id)) {
      throw new Error(
        `applyContactMethodDiff: draft id=${row.id} was not seeded for contactId=${params.contactId}`,
      );
    }
  }

  let changed = false;
  // Clear an existing primary only when the desired primary changes. SQLite's
  // partial unique index is statement-immediate, so this ordering is required
  // for swaps, while a no-op diff remains a true no-op.
  for (const type of ["phone", "email"] as const) {
    const desired = prepared.find(
      (row) => row.type === type && row.isPrimary === 1,
    );
    const existing = params.seeded.find(
      (row) => row.method_type === type && row.is_primary === 1,
    );
    if (existing && desired?.id !== existing.id) {
      const result = await exec.runAsync(
        "UPDATE contact_methods SET is_primary = 0, modified_at = ? WHERE contact_id = ? AND method_type = ? AND is_primary = 1",
        [params.now, params.contactId, type],
      );
      changed ||= result.changes > 0;
    }
  }

  // Explicit local removals create tombstones; stale source evidence is untouched.
  for (const seeded of params.seeded) {
    if (!currentIds.has(seeded.id)) {
      await insertTombstoneCore(
        exec,
        {
          entityType: "contact_method",
          entityUid: seeded.uid,
          deletedAt: params.now,
        },
        { bumpRevision: false },
      );
      const result = await exec.runAsync(
        "DELETE FROM contact_methods WHERE id = ? AND contact_id = ?",
        [seeded.id, params.contactId],
      );
      assertOneChange(
        "removeContactMethod",
        seeded.id,
        params.contactId,
        result.changes,
      );
      changed = true;
    }
  }

  for (const draft of prepared) {
    const values = [
      draft.normalized.rawValue,
      draft.normalized.displayValue,
      draft.normalized.canonicalValue,
      draft.normalized.canonicalRegion,
      draft.normalized.extension,
      draft.normalized.isActionable ? 1 : 0,
      draft.isPrimary,
      draft.displayOrder,
      params.now,
    ] as const;
    if (draft.id == null) {
      await exec.runAsync(
        `INSERT INTO contact_methods
           (uid, contact_id, method_type, raw_value, display_value, canonical_value,
            canonical_region, extension, is_actionable, is_primary, display_order,
            created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [draft.uid, params.contactId, draft.type, ...values, params.now],
      );
      changed = true;
      continue;
    }
    const seeded = seededById.get(draft.id);
    if (!seeded) {
      throw new Error(
        `applyContactMethodDiff: draft id=${draft.id} was not seeded for contactId=${params.contactId}`,
      );
    }
    const differs =
      seeded.method_type !== draft.type ||
      seeded.raw_value !== draft.normalized.rawValue ||
      seeded.display_value !== draft.normalized.displayValue ||
      seeded.canonical_value !== draft.normalized.canonicalValue ||
      seeded.canonical_region !== draft.normalized.canonicalRegion ||
      seeded.extension !== draft.normalized.extension ||
      seeded.is_actionable !== (draft.normalized.isActionable ? 1 : 0) ||
      seeded.is_primary !== draft.isPrimary ||
      seeded.display_order !== draft.displayOrder;
    if (differs) {
      const result = await exec.runAsync(
        `UPDATE contact_methods SET method_type = ?, raw_value = ?, display_value = ?,
           canonical_value = ?, canonical_region = ?, extension = ?, is_actionable = ?,
           is_primary = ?, display_order = ?, modified_at = ?
         WHERE id = ? AND contact_id = ?`,
        [draft.type, ...values, draft.id, params.contactId],
      );
      assertOneChange(
        "updateContactMethod",
        draft.id,
        params.contactId,
        result.changes,
      );
      changed = true;
    }
  }

  if (changed) await bumpDataRevisionCore(exec);
  const methods = await listContactMethods(exec, params.contactId);
  return collision
    ? {
        status: "canonicalDuplicate",
        methodType: collision.methodType,
        survivingDraftUid: collision.survivingDraftUid,
        methods,
      }
    : { status: "saved", methods };
}

/** Standalone transaction-owning wrapper for an editor-only method save. */
export function applyContactMethodDiff(
  exec: SqlExecutor,
  params: {
    contactId: number;
    seeded: ContactMethodRow[];
    current: ContactMethodDraft[];
    now: string;
    effectivePhoneRegion?: string | null;
  },
): Promise<ContactMethodSaveResult> {
  return inWriteTransaction(exec, () =>
    applyContactMethodDiffCore(exec, params),
  );
}
