/**
 * Share-sheet writers (Phase 38.10 D-02, D-04, D-12, D-28, D-46, D-57, D-69,
 * D-77, D-78, D-79, D-106, D-108, D-110). Kept out of the `.tsx` and in a
 * node-tested DAO (CLAUDE.md: queries go through DAOs in `src/db/`).
 *
 * =============================================================================
 * WHERE A SHARE LANDS:
 *   A share is saved the moment a person is picked, before any prompt (D-12,
 *   D-77): one Thought of Them memory per person (D-04, D-79), provenance
 *   `share`, Allow AI off (D-57), the canonical URL in `url`, the share text
 *   (or the URL when the text is blank) as its value. The section chips then
 *   move it to Gift Ideas, Memories or Last Talked About (D-02, D-46).
 *
 * ONE TRANSACTION, ONE REVISION BUMP PER WRAPPER (D-28; PLAN-MAP §5):
 *   Every exported wrapper opens exactly one `inWriteTransaction` and composes
 *   the non-mutexed cores inside it (the write mutex is NON-REENTRANT: calling a
 *   wrapper inside the loop is a permanent hang). Each wrapper advances
 *   `data_revision` exactly once, so a backup sees every share write. The cores
 *   it composes that can bump are called with `bumpRevision: false`.
 *   `createContactAndShare` is the one exception: `createContactFullCore`
 *   already bumps once for the composed create, and the share memory is written
 *   inside that same transaction.
 *
 * SHARING IS NOT A TOUCHPOINT (D-12, D-39):
 *   Nothing here writes an interaction or `last_contact`. A Last Talked About
 *   share is dated today and never linked to an interaction (D-46).
 *
 * Every wrapper takes the executor first, so node:sqlite tests inject it.
 * =============================================================================
 */

import {
  type CreateContactFullInput,
  createContactFullCore,
} from "@/db/contacts-dao";
import {
  deleteCurrentStateEntryCore,
  editHistoryEntryCore,
} from "@/db/current-state-history-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import {
  type KnowledgeEntryRef,
  KnowledgeMoveTargetError,
  moveKnowledgeEntriesCore,
} from "@/db/knowledge-move-dao";
import {
  addMemoryCore,
  deleteMemoryNowCore,
  editMemoryCore,
  setMemoryAllowAiCore,
} from "@/db/memories-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import {
  type CaptureInput,
  type CapturePayload,
  resolveCapturePayload,
} from "@/logic/capture-logic";

// --- Types -------------------------------------------------------------------

/** One row a share wrote, wherever it now lives. */
export interface ShareRowRef {
  table: "memories" | "current_state_entries";
  id: number;
  contactId: number;
}

/** The sections a share chip can choose (D-02, D-77). */
export type ShareSection =
  | "thought_of_them"
  | "gift_idea"
  | "memory"
  | "last_talked_about";

/**
 * The name-only contact the share screen creates (D-83). Only these fields
 * reach `createContactFullCore`: a share-created contact never carries a first
 * interaction (capture is not a touchpoint) or any other enrichment, so it
 * owns nothing except its share (D-106).
 */
export type ShareContactInput = Pick<
  CreateContactFullInput,
  "uid" | "name" | "intervalDays" | "methodDrafts"
>;

/** Undo was asked to delete something that is not this share's own row. */
export class ShareUndoRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShareUndoRefusedError";
  }
}

const SHARE_SECTIONS: readonly ShareSection[] = [
  "thought_of_them",
  "gift_idea",
  "memory",
  "last_talked_about",
];

// --- Helpers -----------------------------------------------------------------

function nonBlank(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.trim().length > 0 ? value : null;
}

/** The share's stored value: its text, or its URL when the text is blank. */
function shareValue(payload: CapturePayload): string {
  const value = nonBlank(payload.displayText) ?? nonBlank(payload.url);
  if (value === null) {
    throw new Error("capture-dao: a share needs text or a link");
  }
  return value;
}

/** Write one Thought of Them share memory. Caller owns the transaction. */
async function addShareMemoryCore(
  exec: SqlExecutor,
  contactId: number,
  payload: CapturePayload,
  now: string,
): Promise<ShareRowRef> {
  const id = await addMemoryCore(exec, {
    contactId,
    type: "thought_of_them",
    value: shareValue(payload),
    url: payload.url,
    provenance: "share",
    allowAi: 0,
    createdAt: now,
    now,
  });
  return { table: "memories", id, contactId };
}

/**
 * The same interval check `createContactFull` runs before its transaction:
 * a Bound contact (the default) needs a positive whole-day cadence, and a
 * non-null cadence is always a positive integer.
 */
function assertShareContactInterval(intervalDays: number | null): void {
  if (
    intervalDays === null ||
    !Number.isInteger(intervalDays) ||
    intervalDays <= 0
  ) {
    throw new Error(
      `intervalDays must be a positive integer, got ${intervalDays}`,
    );
  }
}

/** The row behind a ref, or null when no row matches `(id, contact_id)`. */
async function readShareRowCore(
  exec: SqlExecutor,
  ref: ShareRowRef,
): Promise<{
  section: ShareSection | "other";
  fromShare: boolean;
  createdAt: string;
} | null> {
  if (ref.table === "memories") {
    const row = await exec.getFirstAsync<{
      type: string;
      provenance: string;
      created_at: string;
    }>(
      `SELECT type, provenance, created_at FROM memories
        WHERE id = ? AND contact_id = ? AND deleted_at IS NULL`,
      [ref.id, ref.contactId],
    );
    if (!row) return null;
    const section =
      row.type === "thought_of_them" || row.type === "gift_idea"
        ? row.type
        : row.type === "general"
          ? "memory"
          : "other";
    return {
      section,
      fromShare: row.provenance === "share",
      createdAt: row.created_at,
    };
  }
  if (ref.table === "current_state_entries") {
    const row = await exec.getFirstAsync<{
      field_key: string;
      from_share: number;
      created_at: string;
    }>(
      `SELECT field_key, from_share, created_at FROM current_state_entries
        WHERE id = ? AND contact_id = ?`,
      [ref.id, ref.contactId],
    );
    if (!row) return null;
    return {
      section:
        row.field_key === "last_talked_about" ? "last_talked_about" : "other",
      fromShare: row.from_share === 1,
      createdAt: row.created_at,
    };
  }
  return null;
}

// --- Guards (cores; never open a transaction) --------------------------------

/**
 * Refuse a share Undo that could delete anything but the share's own rows
 * (hardening of D-106): an empty list, a ref whose row is missing or belongs
 * to another contact, or a row that did not come from a share
 * (`memories.provenance = 'share'`, `current_state_entries.from_share = 1`).
 * A chip move keeps the share origin (D-108), so moved rows still pass.
 * Throws `ShareUndoRefusedError` before any write.
 */
export async function assertShareUndoRowsCore(
  exec: SqlExecutor,
  rows: readonly ShareRowRef[],
): Promise<void> {
  if (rows.length === 0) {
    throw new ShareUndoRefusedError("undoShareRows: no rows to undo");
  }
  for (const ref of rows) {
    const row = await readShareRowCore(exec, ref);
    if (row === null) {
      throw new ShareUndoRefusedError(
        `undoShareRows: no ${ref.table} row matched id=${ref.id} for contactId=${ref.contactId}`,
      );
    }
    if (!row.fromShare) {
      throw new ShareUndoRefusedError(
        `undoShareRows: ${ref.table} row id=${ref.id} did not come from a share`,
      );
    }
  }
}

/**
 * True only when `rows` is the batch `createContactAndShare` wrote with this
 * contact: non-empty, every ref owned by `contactId`, and every row's
 * `created_at` equal to the contact's (one `now`, one transaction). Plan 11's
 * D-100 guard uses it; false means the contact is kept and only the share is
 * removed (D-110). Whole-second equality is enough here.
 */
export async function shareRowsMatchCreatedContactCore(
  exec: SqlExecutor,
  contactId: number,
  rows: readonly ShareRowRef[],
): Promise<boolean> {
  if (rows.length === 0) return false;
  const contact = await exec.getFirstAsync<{ created_at: string }>(
    "SELECT created_at FROM contacts WHERE id = ?",
    [contactId],
  );
  if (!contact) return false;
  for (const ref of rows) {
    if (ref.contactId !== contactId) return false;
    const row = await readShareRowCore(exec, ref);
    if (row === null || row.createdAt !== contact.created_at) return false;
  }
  return true;
}

// --- Wrappers ----------------------------------------------------------------

/**
 * Save one share to each picked person as an independent Thought of Them
 * memory (D-12 multi-attach, D-79), in one transaction. Returns the rows in
 * input order. A throw for any person (e.g. a missing contact) rolls back all.
 */
export function shareToContacts(
  exec: SqlExecutor,
  contactIds: readonly number[],
  payload: CapturePayload,
  now: string,
): Promise<ShareRowRef[]> {
  if (contactIds.length === 0) {
    return Promise.reject(new Error("shareToContacts: no person picked"));
  }
  return inWriteTransaction(exec, async () => {
    const rows: ShareRowRef[] = [];
    for (const contactId of contactIds) {
      rows.push(await addShareMemoryCore(exec, contactId, payload, now));
    }
    await bumpDataRevisionCore(exec);
    return rows;
  });
}

/**
 * Create a name-only contact and save the share to it in one transaction
 * (D-28; NEW-3). The contact and its share rows share one `created_at` (`now`),
 * which `shareRowsMatchCreatedContactCore` relies on. The single revision bump
 * is `createContactFullCore`'s; the share memory is written inside the same
 * transaction, so this wrapper does not bump again.
 */
export function createContactAndShare(
  exec: SqlExecutor,
  contactInput: ShareContactInput,
  payload: CapturePayload,
  now: string,
): Promise<{ contactId: number; rows: ShareRowRef[] }> {
  try {
    assertShareContactInterval(contactInput.intervalDays);
    // Validate before any write, so a contentless share never creates a contact.
    shareValue(payload);
  } catch (err) {
    return Promise.reject(err);
  }
  return inWriteTransaction(exec, async () => {
    const { contactId } = await createContactFullCore(exec, {
      uid: contactInput.uid,
      name: contactInput.name,
      intervalDays: contactInput.intervalDays,
      methodDrafts: contactInput.methodDrafts,
      now,
    });
    const row = await addShareMemoryCore(exec, contactId, payload, now);
    return { contactId, rows: [row] };
  });
}

/**
 * Move a share's rows together to the chosen section (D-46, D-77, D-79), in
 * one transaction with one revision bump. Gift Ideas, Memories and Thought of
 * Them are type changes; Last Talked About is a cross-table move dated today
 * (D-46) that keeps the share's link, `created_at` and origin (D-108). A row
 * already in the chosen section is left as it is. A share's Last Talked About
 * date was made by the app on the chip tap, so a later chip move into a memory
 * leaves `meaningful_date` empty (`carryEntryDate: false`; convergence c10).
 * Returns the rows where they now live, in input order.
 */
export function moveShareRows(
  exec: SqlExecutor,
  rows: readonly ShareRowRef[],
  section: ShareSection,
  now: string,
): Promise<ShareRowRef[]> {
  if (!SHARE_SECTIONS.includes(section)) {
    return Promise.reject(
      new KnowledgeMoveTargetError(
        `moveShareRows: ${String(section)} is not a share section`,
      ),
    );
  }
  return inWriteTransaction(exec, async () => {
    const result: ShareRowRef[] = [...rows];
    const toMove: { index: number; ref: KnowledgeEntryRef }[] = [];
    for (const [index, ref] of rows.entries()) {
      const row = await readShareRowCore(exec, ref);
      // Missing rows go to the move core, which throws and rolls back.
      if (row !== null && row.section === section) continue;
      toMove.push({ index, ref });
    }
    if (toMove.length === 0) return result;

    const moved = await moveKnowledgeEntriesCore(
      exec,
      toMove.map((m) => m.ref),
      section,
      now,
      {
        bumpRevision: false,
        carryEntryDate: false,
        entryDate:
          section === "last_talked_about" ? now.slice(0, 10) : undefined,
      },
    );
    for (const [i, entry] of toMove.entries()) {
      const ref = moved[i];
      if (ref === undefined || ref.table === "off_limits") {
        // Unreachable: no share section maps to Off Limits.
        throw new Error("moveShareRows: a share cannot move to Off Limits");
      }
      result[entry.index] = {
        table: ref.table,
        id: ref.id,
        contactId: ref.contactId,
      };
    }
    await bumpDataRevisionCore(exec);
    return result;
  });
}

/**
 * Undo a share: delete its rows at once with tombstones (D-69), one
 * transaction, one revision bump. Refused before any write unless every ref is
 * this share's own row (`assertShareUndoRowsCore`). A share that also created
 * its contact is undone by plan 11's `undoCreateContactAndShare` (D-100).
 */
export function undoShareRows(
  exec: SqlExecutor,
  rows: readonly ShareRowRef[],
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await assertShareUndoRowsCore(exec, rows);
    for (const ref of rows) {
      const input = {
        id: ref.id,
        contactId: ref.contactId,
        now,
        bumpRevision: false,
      };
      if (ref.table === "memories") {
        await deleteMemoryNowCore(exec, input);
      } else {
        await deleteCurrentStateEntryCore(exec, input);
      }
    }
    await bumpDataRevisionCore(exec);
  });
}

/**
 * The confirmation card's Allow AI switch (D-78), one transaction, one bump.
 * Memories only: Last Talked About has no Allow AI, so those rows are skipped.
 */
export function setShareRowsAllowAi(
  exec: SqlExecutor,
  rows: readonly ShareRowRef[],
  allow: boolean,
  now: string,
): Promise<void> {
  const memoryRows = rows.filter((ref) => ref.table === "memories");
  if (memoryRows.length === 0) return Promise.resolve();
  return inWriteTransaction(exec, async () => {
    for (const ref of memoryRows) {
      await setMemoryAllowAiCore(exec, {
        id: ref.id,
        contactId: ref.contactId,
        allow,
        now,
      });
    }
    await bumpDataRevisionCore(exec);
  });
}

/**
 * Add the user's note to a share: the value is recomposed from the shared
 * payload with the note leading (`resolveCapturePayload`), then written to
 * every row, one transaction, one bump. The link is not touched.
 */
export function applyShareNote(
  exec: SqlExecutor,
  rows: readonly ShareRowRef[],
  note: string,
  base: Omit<CaptureInput, "note">,
  now: string,
): Promise<void> {
  if (rows.length === 0) return Promise.resolve();
  let value: string;
  try {
    value = shareValue(resolveCapturePayload({ ...base, note }));
  } catch (err) {
    return Promise.reject(err);
  }
  return inWriteTransaction(exec, async () => {
    for (const ref of rows) {
      if (ref.table === "memories") {
        await editMemoryCore(exec, {
          id: ref.id,
          contactId: ref.contactId,
          value,
          now,
        });
      } else {
        await editHistoryEntryCore(exec, {
          contactId: ref.contactId,
          fieldKey: "last_talked_about",
          entryId: ref.id,
          value,
          now,
        });
      }
    }
    await bumpDataRevisionCore(exec);
  });
}
