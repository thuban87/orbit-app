/**
 * `contact_links` child-table CRUD DAO (CRUD-04) — many links per contact,
 * add/edit/remove, optional label, insertion-ordered by `display_order`.
 *
 * The table already ships in migration 1 (`001-initial.ts`:84-94): `url TEXT NOT
 * NULL`, `label TEXT` nullable, `display_order INTEGER NOT NULL`, `uid TEXT
 * UNIQUE`, `contact_id → contacts ON DELETE CASCADE`. This is DAO-only; there is
 * NO migration this phase, and NEVER an index/UNIQUE on any column (the
 * value-column DROP ban is contact_custom_values-scoped, but the no-new-index
 * habit is cheap insurance and nothing here needs one).
 *
 * =============================================================================
 * CORE / WRAPPER SPLIT (the phase's central pattern — see transaction.ts):
 *   The shared mutex is NON-REENTRANT. The mutating CORES (`addLinkCore`,
 *   `updateLinkCore`, `removeLinkCore`) open NO transaction — they assume a BEGIN
 *   is already held. The standalone WRAPPERS (`addLink`/`updateLink`/`removeLink`)
 *   each wrap their core in exactly ONE `inWriteTransaction` for single callers.
 *   `applyLinkDiff` opens ONE outer `inWriteTransaction` and composes the cores
 *   directly, so a whole seeded-vs-current diff is atomic (all link changes apply
 *   or none) — never nesting the mutex.
 * =============================================================================
 *
 * EVERY mutation is scoped by BOTH `id` AND `contact_id` and asserts exactly one
 * change (WR-04 both-keys precedent, `recency-dao.ts`): a mismatched pair changes
 * 0 rows → a loud rollback instead of silent cross-contact corruption. Every
 * value is `?`-bound; no identifier is ever interpolated (T-04-02). Timestamps
 * are caller-supplied local wall-clock (never `toISOString`).
 *
 * Node-pure: takes `exec: SqlExecutor`; imports the shared `inWriteTransaction`.
 */
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

/** A stored link row, as returned by `listLinks`. */
export interface ContactLinkRow {
  id: number;
  uid: string;
  url: string;
  label: string | null;
  display_order: number;
}

/** A seeded link the edit form diffs against (the `listLinks` snapshot). */
export interface SeededLink {
  id: number;
  url: string;
  label: string | null;
}

/**
 * A draft link in the editor. A SEEDED row carries its `id`; a NEW row omits `id`
 * and the caller mints a fresh `uid` for it (`newUid()`). `uid` is always present
 * so a new row can be INSERTed; it is unused when diffing an existing row.
 */
export interface DraftLink {
  id?: number;
  uid: string;
  url: string;
  label: string | null;
}

/** Throw (→ rollback) unless exactly one row matched (id, contact_id). */
function assertOneChange(
  op: string,
  id: number,
  contactId: number,
  changes: number,
): void {
  if (changes !== 1) {
    throw new Error(
      `${op}: no link matched id=${id} for contactId=${contactId} (changed ${changes})`,
    );
  }
}

// --- Non-mutexed cores (assume BEGIN already open — never open a transaction) --

/**
 * Append a link at `MAX(display_order)+1` for this contact (first link → 0). The
 * append order is derived in-SQL so concurrent-safe under the single shared
 * connection. Returns the new row id.
 */
async function addLinkCore(
  exec: SqlExecutor,
  params: {
    uid: string;
    contactId: number;
    url: string;
    label: string | null;
    now: string;
  },
): Promise<number> {
  const order = await exec.getFirstAsync<{ next: number }>(
    `SELECT COALESCE(MAX(display_order) + 1, 0) AS next
       FROM contact_links
      WHERE contact_id = ?`,
    [params.contactId],
  );
  const result = await exec.runAsync(
    `INSERT INTO contact_links
       (uid, contact_id, url, label, display_order, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      params.uid,
      params.contactId,
      params.url,
      params.label ?? null,
      order?.next ?? 0,
      params.now,
      params.now,
    ],
  );
  return result.lastInsertRowId;
}

/** UPDATE url/label for the matching (id, contact_id) + assertOneChange. */
async function updateLinkCore(
  exec: SqlExecutor,
  params: {
    id: number;
    contactId: number;
    url: string;
    label: string | null;
    now: string;
  },
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE contact_links
        SET url = ?, label = ?, modified_at = ?
      WHERE id = ? AND contact_id = ?`,
    [params.url, params.label ?? null, params.now, params.id, params.contactId],
  );
  assertOneChange("updateLink", params.id, params.contactId, result.changes);
}

/** DELETE the matching (id, contact_id) + assertOneChange. */
async function removeLinkCore(
  exec: SqlExecutor,
  params: { id: number; contactId: number },
): Promise<void> {
  const result = await exec.runAsync(
    "DELETE FROM contact_links WHERE id = ? AND contact_id = ?",
    [params.id, params.contactId],
  );
  assertOneChange("removeLink", params.id, params.contactId, result.changes);
}

// --- Standalone wrappers (own ONE transaction each) --------------------------

/** Append a link (standalone). Wraps `addLinkCore` in one transaction. */
export function addLink(
  exec: SqlExecutor,
  params: {
    uid: string;
    contactId: number;
    url: string;
    label: string | null;
    now: string;
  },
): Promise<number> {
  return inWriteTransaction(exec, () => addLinkCore(exec, params));
}

/** Edit a link's url/label (standalone). Wraps `updateLinkCore`. */
export function updateLink(
  exec: SqlExecutor,
  params: {
    id: number;
    contactId: number;
    url: string;
    label: string | null;
    now: string;
  },
): Promise<void> {
  return inWriteTransaction(exec, () => updateLinkCore(exec, params));
}

/** Delete a link (standalone). Wraps `removeLinkCore`. */
export function removeLink(
  exec: SqlExecutor,
  params: { id: number; contactId: number },
): Promise<void> {
  return inWriteTransaction(exec, () => removeLinkCore(exec, params));
}

/**
 * Apply a seeded-vs-current diff in ONE transaction so the whole diff is atomic
 * (all link changes apply or none — a mid-diff failure rolls everything back).
 * Matched by `id`:
 *   (a) each `current` row WITHOUT an `id` is INSERTed (append order), minting
 *       the caller-supplied `uid`;
 *   (b) each `seeded` id ABSENT from `current` is DELETEd;
 *   (c) each `current` row WITH an `id` whose url/label differs from its seeded
 *       twin is UPDATEd.
 * All scoped by `contactId`; every core runs inside the ONE outer transaction
 * (never nesting the non-reentrant mutex).
 */
export function applyLinkDiff(
  exec: SqlExecutor,
  params: {
    contactId: number;
    seeded: SeededLink[];
    current: DraftLink[];
    now: string;
  },
): Promise<void> {
  const { contactId, seeded, current, now } = params;
  return inWriteTransaction(exec, async () => {
    const seededById = new Map(seeded.map((l) => [l.id, l]));
    const currentIds = new Set(
      current
        .filter((l): l is DraftLink & { id: number } => l.id != null)
        .map((l) => l.id),
    );

    // (a) INSERT id-less current rows (append order via MAX+1 in the core).
    for (const row of current) {
      if (row.id == null) {
        await addLinkCore(exec, {
          uid: row.uid,
          contactId,
          url: row.url,
          label: row.label,
          now,
        });
      }
    }

    // (b) DELETE seeded rows the draft dropped.
    for (const s of seeded) {
      if (!currentIds.has(s.id)) {
        await removeLinkCore(exec, { id: s.id, contactId });
      }
    }

    // (c) UPDATE existing rows whose url/label changed vs their seeded twin.
    for (const row of current) {
      if (row.id == null) {
        continue;
      }
      const twin = seededById.get(row.id);
      if (twin && (twin.url !== row.url || twin.label !== row.label)) {
        await updateLinkCore(exec, {
          id: row.id,
          contactId,
          url: row.url,
          label: row.label,
          now,
        });
      }
    }
  });
}

/** A contact's links ORDER BY display_order (pure read — no transaction). */
export function listLinks(
  exec: SqlExecutor,
  contactId: number,
): Promise<ContactLinkRow[]> {
  return exec.getAllAsync<ContactLinkRow>(
    `SELECT id, uid, url, label, display_order
       FROM contact_links
      WHERE contact_id = ?
      ORDER BY display_order`,
    [contactId],
  );
}
