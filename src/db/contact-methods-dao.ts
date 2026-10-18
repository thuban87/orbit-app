import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { insertTombstoneCore } from "@/db/tombstones-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
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
  /** User-selected standard or custom label; null for pre-label rows. */
  label: string | null;
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
  /** Phone-only presentation metadata. Empty drafts are stored as NULL. */
  extension?: string | null;
  /** Optional standard or custom presentation label. Empty drafts are stored as NULL. */
  label?: string | null;
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
            label, is_primary, display_order, created_at, modified_at
       FROM contact_methods
      WHERE contact_id = ?
      ORDER BY method_type, display_order, id`,
    [contactId],
  );
}

type PreparedDraft = Omit<ContactMethodDraft, "isPrimary"> & {
  normalized: ReturnType<typeof normalizeContactMethod>;
  extension: string | null;
  label: string | null;
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
    /**
     * Whether this core owns its `data_revision` bump (default true, preserving
     * the standalone `applyContactMethodDiff` wrapper + every other caller). An
     * AGGREGATE writer that composes this core inside a larger transaction (e.g.
     * `createContactFullCore`) passes `false` so it can own the SINGLE bump for
     * the whole composed write — closing the create-path under-bump/double-bump.
     */
    bumpRevision?: boolean;
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
      extension:
        draft.type === "phone" && draft.extension?.trim()
          ? draft.extension.trim()
          : null,
      label: draft.label?.trim() || null,
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
      draft.extension ?? draft.normalized.extension,
      draft.label,
      draft.normalized.isActionable ? 1 : 0,
      draft.isPrimary,
      draft.displayOrder,
      params.now,
    ] as const;
    if (draft.id == null) {
      await exec.runAsync(
        `INSERT INTO contact_methods
           (uid, contact_id, method_type, raw_value, display_value, canonical_value,
            canonical_region, extension, label, is_actionable, is_primary, display_order,
            created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      seeded.extension !== (draft.extension ?? draft.normalized.extension) ||
      seeded.label !== draft.label ||
      seeded.is_actionable !== (draft.normalized.isActionable ? 1 : 0) ||
      seeded.is_primary !== draft.isPrimary ||
      seeded.display_order !== draft.displayOrder;
    if (differs) {
      const result = await exec.runAsync(
        `UPDATE contact_methods SET method_type = ?, raw_value = ?, display_value = ?,
           canonical_value = ?, canonical_region = ?, extension = ?, label = ?,
           is_actionable = ?, is_primary = ?, display_order = ?, modified_at = ?
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

  if (changed && (params.bumpRevision ?? true))
    await bumpDataRevisionCore(exec);
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

/**
 * Establish a single method as the primary of its type — the lightweight Compose
 * "establish missing primary" picker writer (HIGH-7). Purpose-built because the
 * diff writers (`applyContactMethodDiff`/`Core`) demand the whole seeded/current
 * method set and handle tombstones/normalization/ordering, which is wrong for a
 * one-field primary swap.
 *
 * ONE write transaction, DETERMINISTIC order PRE-READ/VALIDATE → CLEAR → PROMOTE
 * (A3), so the statement-immediate partial-unique index
 * `idx_contact_methods_primary_type (contact_id, method_type) WHERE is_primary=1`
 * (009-contact-method-normalization.ts:235) is never transiently violated:
 *
 *  (1) PRE-READ the target by `id AND contact_id AND method_type`. A foreign id,
 *      unknown id, or a `methodType` that disagrees with the row's stored
 *      `method_type` (e.g. an email method id passed with methodType:'phone')
 *      matches no row → throw BEFORE any write, so no prior primary is orphaned.
 *      Already-primary is a true no-op (no write, no data_revision bump).
 *  (2) CLEAR the prior `is_primary=1` of that exact `(contactId, methodType)`
 *      BEFORE the promote — a promote-before-clear would trip the index.
 *  (3) PROMOTE the validated target; assert EXACTLY ONE row changed (a concurrent
 *      delete between pre-read and promote → 0 rows → throw/rollback, leaving the
 *      prior primary intact rather than a type with no primary).
 *
 * data_revision is bumped once on a real swap, matching the diff path.
 */
export function setContactMethodPrimary(
  exec: SqlExecutor,
  params: {
    contactId: number;
    methodId: number;
    methodType: ContactMethodType;
    now: string;
  },
): Promise<void> {
  const { contactId, methodId, methodType, now } = params;
  return inWriteTransaction(exec, async () => {
    // (1) PRE-READ / VALIDATE — a foreign id, unknown id, or a methodType that
    // disagrees with the row's stored method_type matches no row → NO write.
    const target = await exec.getFirstAsync<{ is_primary: number }>(
      "SELECT is_primary FROM contact_methods WHERE id = ? AND contact_id = ? AND method_type = ?",
      [methodId, contactId, methodType],
    );
    if (!target) {
      throw new Error(
        `setContactMethodPrimary: no ${methodType} method id=${methodId} for contactId=${contactId}`,
      );
    }
    // Already primary: leave state unchanged, do not bump data_revision.
    if (target.is_primary === 1) return;

    // (2) CLEAR the prior primary of this exact (contactId, methodType) FIRST.
    await exec.runAsync(
      "UPDATE contact_methods SET is_primary = 0, modified_at = ? WHERE contact_id = ? AND method_type = ? AND is_primary = 1",
      [now, contactId, methodType],
    );

    // (3) PROMOTE the validated target; assert exactly one row changed.
    const promoted = await exec.runAsync(
      "UPDATE contact_methods SET is_primary = 1, modified_at = ? WHERE id = ? AND contact_id = ? AND method_type = ?",
      [now, methodId, contactId, methodType],
    );
    assertOneChange(
      "setContactMethodPrimary",
      methodId,
      contactId,
      promoted.changes,
    );

    await bumpDataRevisionCore(exec);
  });
}

/** One method to add through `addContactMethodsCore`. */
export interface ContactMethodAddition {
  type: ContactMethodType;
  value: string;
  label?: string | null;
}

/**
 * Add methods to a contact without touching any existing row (38.12 D-102:
 * "nothing is deleted"; review B-WR-05). Caller-owned transaction body.
 *
 * Unlike `applyContactMethodDiffCore`, this never re-normalizes, reorders,
 * deletes or tombstones a stored method, so two stored methods that collide
 * under today's region (e.g. a national number stored with no region and the
 * same number in E.164) both survive. An addition that matches a stored
 * method (by its stored canonical value, or its value under the given
 * region) or an earlier addition is not inserted again.
 *
 * `primary`: the addition that becomes the primary of its type (D-102,
 * D-148); a match to a stored method flips that row instead. Only is_primary
 * changes on stored rows. A type with no primary at all after the additions
 * gets its first method in display order as primary (the diff writer's
 * singleton rule), so no type is left without one.
 */
export async function addContactMethodsCore(
  exec: SqlExecutor,
  params: {
    contactId: number;
    additions: readonly ContactMethodAddition[];
    primary?: ContactMethodAddition;
    now: string;
    effectivePhoneRegion?: string | null;
  },
): Promise<{ added: number; methods: ContactMethodRow[] }> {
  const seeded = await listContactMethods(exec, params.contactId);
  const keyOf = (type: ContactMethodType, value: string): string => {
    const canonical = normalizeContactMethod({
      type,
      value,
      defaultPhoneRegion: params.effectivePhoneRegion,
    }).canonicalValue;
    return `${type}\u0000${canonical ?? value.trim()}`;
  };
  // Every key a stored row answers to: its stored canonical value and its
  // value re-read under the apply region.
  const idByKey = new Map<string, number>();
  for (const row of seeded) {
    if (row.canonical_value)
      idByKey.set(`${row.method_type}\u0000${row.canonical_value}`, row.id);
    const key = keyOf(row.method_type, row.raw_value);
    if (!idByKey.has(key)) idByKey.set(key, row.id);
  }
  const nextOrder: Record<ContactMethodType, number> = { phone: 0, email: 0 };
  for (const row of seeded)
    nextOrder[row.method_type] = Math.max(
      nextOrder[row.method_type],
      row.display_order + 1,
    );

  let changed = false;
  let added = 0;
  for (const addition of params.additions) {
    if (!addition.value.trim()) continue;
    const key = keyOf(addition.type, addition.value);
    if (idByKey.has(key)) continue;
    const normalized = normalizeContactMethod({
      type: addition.type,
      value: addition.value,
      defaultPhoneRegion: params.effectivePhoneRegion,
    });
    const result = await exec.runAsync(
      `INSERT INTO contact_methods
         (uid, contact_id, method_type, raw_value, display_value, canonical_value,
          canonical_region, extension, label, is_actionable, is_primary, display_order,
          created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        newUid(),
        params.contactId,
        addition.type,
        normalized.rawValue,
        normalized.displayValue,
        normalized.canonicalValue,
        normalized.canonicalRegion,
        addition.type === "phone" ? normalized.extension : null,
        addition.label?.trim() || null,
        normalized.isActionable ? 1 : 0,
        nextOrder[addition.type]++,
        params.now,
        params.now,
      ],
    );
    idByKey.set(key, result.lastInsertRowId);
    changed = true;
    added += 1;
  }

  const current = await listContactMethods(exec, params.contactId);
  const promote = async (type: ContactMethodType, id: number) => {
    // Clear before promote: the partial unique index is statement-immediate.
    await exec.runAsync(
      "UPDATE contact_methods SET is_primary = 0, modified_at = ? WHERE contact_id = ? AND method_type = ? AND is_primary = 1",
      [params.now, params.contactId, type],
    );
    const result = await exec.runAsync(
      "UPDATE contact_methods SET is_primary = 1, modified_at = ? WHERE id = ? AND contact_id = ? AND method_type = ?",
      [params.now, id, params.contactId, type],
    );
    assertOneChange(
      "addContactMethodsPrimary",
      id,
      params.contactId,
      result.changes,
    );
    changed = true;
  };
  const elected = params.primary
    ? idByKey.get(keyOf(params.primary.type, params.primary.value))
    : undefined;
  for (const type of ["phone", "email"] as const) {
    const ofType = current.filter((row) => row.method_type === type);
    const primaryRow = ofType.find((row) => row.is_primary === 1);
    const target =
      params.primary?.type === type && elected !== undefined
        ? ofType.find((row) => row.id === elected)
        : undefined;
    if (target) {
      if (target.is_primary !== 1) await promote(type, target.id);
    } else if (!primaryRow && ofType.length > 0) {
      await promote(type, ofType[0].id);
    }
  }

  if (changed) await bumpDataRevisionCore(exec);
  return { added, methods: await listContactMethods(exec, params.contactId) };
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
