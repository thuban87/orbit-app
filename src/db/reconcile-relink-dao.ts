import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

export interface RelinkExternalSourceInput {
  contactId: number;
  staleLinkId: number;
  newProvider: string;
  newExternalContactId: string;
  now: string;
}

export type RelinkExternalSourceResult =
  | { kind: "relinked"; externalContactLinkId: number }
  | { kind: "duplicate-active-link"; otherContactId: number }
  | { kind: "already-active-link"; externalContactLinkId: number };

function assertOneChange(result: { changes: number }, operation: string, id: number): void {
  if (result.changes !== 1) {
    throw new Error(`${operation}: no row matched id=${id} (changed ${result.changes})`);
  }
}

/**
 * Replace a missing source atomically. The global partial unique index requires
 * the stale link to be retired before attaching an equal provider identity.
 * Orbit-owned contact fields and relationships are intentionally never written.
 */
export function relinkExternalSource(
  exec: SqlExecutor,
  input: RelinkExternalSourceInput,
): Promise<RelinkExternalSourceResult> {
  return inWriteTransaction(exec, async () => {
    const existing = await exec.getFirstAsync<{ id: number; contact_id: number }>(
      `SELECT id, contact_id FROM external_contact_links
       WHERE provider = ? AND external_contact_id = ? AND is_active = 1`,
      [input.newProvider, input.newExternalContactId],
    );
    if (existing && existing.contact_id !== input.contactId) {
      return { kind: "duplicate-active-link", otherContactId: existing.contact_id };
    }
    // A second active source on this contact already owns the selected provider
    // identity; report it rather than provoking the global unique index.
    if (existing && existing.id !== input.staleLinkId) {
      return { kind: "already-active-link", externalContactLinkId: existing.id };
    }

    const retired = await exec.runAsync(
      `UPDATE external_contact_links
       SET is_active = 0, modified_at = ?
       WHERE id = ? AND contact_id = ? AND is_active = 1`,
      [input.now, input.staleLinkId, input.contactId],
    );
    assertOneChange(retired, "relinkExternalSource retire", input.staleLinkId);
    const inserted = await exec.runAsync(
      `INSERT INTO external_contact_links
       (uid, contact_id, provider, external_contact_id, is_active, created_at, modified_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [
        newUid(),
        input.contactId,
        input.newProvider,
        input.newExternalContactId,
        input.now,
        input.now,
      ],
    );
    return { kind: "relinked", externalContactLinkId: inserted.lastInsertRowId };
  });
}

/** Retire a source only; it never changes the Orbit contact itself. */
export function unlinkExternalSource(
  exec: SqlExecutor,
  { staleLinkId, now }: { staleLinkId: number; now: string },
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const retired = await exec.runAsync(
      `UPDATE external_contact_links
       SET is_active = 0, modified_at = ?
       WHERE id = ? AND is_active = 1`,
      [now, staleLinkId],
    );
    assertOneChange(retired, "unlinkExternalSource", staleLinkId);
  });
}
