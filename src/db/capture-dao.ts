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
 * SHARE UNDO THAT ALSO REMOVES ITS CONTACT (D-100, D-106, D-109, D-110):
 *   `undoCreateContactAndShare` is the only caller anywhere that turns
 *   `purgeContactCore`'s archive gate off (an owner exception to ADR-018,
 *   D-106). It removes the contact only when the share rows are the batch the
 *   contact was created with and the contact owns nothing else the user added
 *   or changed (`SHARE_UNDO_OWNERSHIP`, D-109). Otherwise only the share goes
 *   and the contact stays active (D-110).
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
import {
  type PurgeExtensions,
  type PurgePostCommitCleanup,
  purgeContactCore,
} from "@/db/purge-dao";
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

/** Reject a section the share chips do not offer (never Off Limits). */
function assertShareSection(section: ShareSection, caller: string): void {
  if (!SHARE_SECTIONS.includes(section)) {
    throw new KnowledgeMoveTargetError(
      `${caller}: ${String(section)} is not a share section`,
    );
  }
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
 * The chip move itself, inside a caller's transaction (convergence c4): moves
 * a share's rows together to the chosen section (D-46, D-77, D-79). Gift
 * Ideas, Memories and Thought of Them are type changes; Last Talked About is a
 * cross-table move dated today (D-46) that keeps the share's link,
 * `created_at` and origin (D-108). A row already in the chosen section is left
 * as it is. A share's Last Talked About date was made by the app on the chip
 * tap, so a later chip move into a memory leaves `meaningful_date` empty
 * (`carryEntryDate: false`; convergence c10). Every core runs with
 * `bumpRevision: false`; the caller bumps once when `moved` is true.
 * Returns the rows where they now live, in input order.
 */
export async function moveShareRowsCore(
  exec: SqlExecutor,
  rows: readonly ShareRowRef[],
  section: ShareSection,
  now: string,
): Promise<{ rows: ShareRowRef[]; moved: boolean }> {
  assertShareSection(section, "moveShareRows");
  const result: ShareRowRef[] = [...rows];
  const toMove: { index: number; ref: KnowledgeEntryRef }[] = [];
  for (const [index, ref] of rows.entries()) {
    const row = await readShareRowCore(exec, ref);
    // Missing rows go to the move core, which throws and rolls back.
    if (row !== null && row.section === section) continue;
    toMove.push({ index, ref });
  }
  if (toMove.length === 0) return { rows: result, moved: false };

  const moved = await moveKnowledgeEntriesCore(
    exec,
    toMove.map((m) => m.ref),
    section,
    now,
    {
      bumpRevision: false,
      carryEntryDate: false,
      entryDate: section === "last_talked_about" ? now.slice(0, 10) : undefined,
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
  return { rows: result, moved: true };
}

/**
 * Move a share's rows together to the chosen section (`moveShareRowsCore`),
 * in one transaction with one revision bump when anything moved.
 * Returns the rows where they now live, in input order.
 */
export function moveShareRows(
  exec: SqlExecutor,
  rows: readonly ShareRowRef[],
  section: ShareSection,
  now: string,
): Promise<ShareRowRef[]> {
  try {
    assertShareSection(section, "moveShareRows");
  } catch (err) {
    return Promise.reject(err);
  }
  return inWriteTransaction(exec, async () => {
    const result = await moveShareRowsCore(exec, rows, section, now);
    if (result.moved) await bumpDataRevisionCore(exec);
    return result.rows;
  });
}

/**
 * The share card's Allow AI read (this plan only): true only when every ref
 * is a live `memories` row with `allow_ai = 1`. A Last Talked About ref has no
 * Allow AI, so it reads false; so does an empty list. Caller owns the
 * transaction.
 */
export async function readShareRowsAllowAiCore(
  exec: SqlExecutor,
  rows: readonly ShareRowRef[],
): Promise<boolean> {
  if (rows.length === 0) return false;
  for (const ref of rows) {
    if (ref.table !== "memories") return false;
    const row = await exec.getFirstAsync<{ allow_ai: number }>(
      `SELECT allow_ai FROM memories
        WHERE id = ? AND contact_id = ? AND deleted_at IS NULL`,
      [ref.id, ref.contactId],
    );
    if (row?.allow_ai !== 1) return false;
  }
  return true;
}

/**
 * A chip move plus the Allow AI it left, in one transaction (convergence c2
 * G-U1, c4): the card shows the stored permission, never one inferred from
 * the chip. A memory-type move keeps `allow_ai`; Last Talked About has none;
 * leaving it lands at 0 (plan 03). A throw anywhere, the read included, rolls
 * the move back, so the previous refs still name the stored rows. One
 * revision bump when anything moved.
 */
export function moveShareRowsWithAi(
  exec: SqlExecutor,
  rows: readonly ShareRowRef[],
  section: ShareSection,
  now: string,
): Promise<{ rows: ShareRowRef[]; aiOn: boolean }> {
  try {
    assertShareSection(section, "moveShareRowsWithAi");
  } catch (err) {
    return Promise.reject(err);
  }
  return inWriteTransaction(exec, async () => {
    const result = await moveShareRowsCore(exec, rows, section, now);
    const aiOn = await readShareRowsAllowAiCore(exec, result.rows);
    if (result.moved) await bumpDataRevisionCore(exec);
    return { rows: result.rows, aiOn };
  });
}

/** Delete a share's rows with tombstones, no revision bump. Caller owns the transaction. */
async function deleteShareRowsCore(
  exec: SqlExecutor,
  rows: readonly ShareRowRef[],
  now: string,
): Promise<void> {
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
}

/**
 * Undo a share: delete its rows at once with tombstones (D-69), one
 * transaction, one revision bump. Refused before any write unless every ref is
 * this share's own row (`assertShareUndoRowsCore`). A share that also created
 * its contact is undone by `undoCreateContactAndShare` (D-100).
 */
export function undoShareRows(
  exec: SqlExecutor,
  rows: readonly ShareRowRef[],
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await assertShareUndoRowsCore(exec, rows);
    await deleteShareRowsCore(exec, rows, now);
    await bumpDataRevisionCore(exec);
  });
}

// --- D-100 share Undo that also removes the created contact -----------------

/**
 * How a contact-owned column counts against removing a share-created contact
 * (D-106 as clarified by D-109). `blocks`: any row blocks. `creation-artefact`:
 * rows the app made with the contact count only while unchanged. Each entry
 * carries one literal `?`-bound query that returns a row exactly when the
 * column blocks the permanent delete.
 */
export interface ShareUndoOwnershipRule {
  disposition: "blocks" | "creation-artefact";
  blockingSql: string;
}

function blocksIfAnyRow(table: string, column: string): ShareUndoOwnershipRule {
  return {
    disposition: "blocks",
    blockingSql: `SELECT 1 AS hit FROM ${table} WHERE ${column} = ? LIMIT 1`,
  };
}

/**
 * Columns that hold a contact id with no foreign key, so the schema pragma
 * cannot find them (checker cycle 3 W-5). `field_history.contact_id` has no
 * REFERENCES (`001-initial.ts`).
 */
export const SHARE_UNDO_NO_FK_COLUMNS: readonly string[] = [
  "field_history.contact_id",
];

/**
 * Every contact-owned `(table, column)` at the migration head, each with one
 * disposition (D-109; checker cycle 2 W-11, cycle 3 W-5). A test derives the
 * key set from `pragma_foreign_key_list` (parent `contacts`) plus
 * `SHARE_UNDO_NO_FK_COLUMNS` and expects it to equal these keys, so a column
 * added later cannot be missed. The share rows being undone are deleted
 * before this guard runs, so `memories` and `current_state_entries` block on
 * any remaining row. The contact row itself is checked separately
 * (`photo IS NULL`, `modified_at = created_at`).
 */
export const SHARE_UNDO_OWNERSHIP: Readonly<
  Record<string, ShareUndoOwnershipRule>
> = Object.freeze({
  // The orrery sun reference (an ON DELETE SET NULL FK since migration 003).
  "app_settings.sun_contact_id": blocksIfAnyRow(
    "app_settings",
    "sun_contact_id",
  ),
  "contact_links.contact_id": blocksIfAnyRow("contact_links", "contact_id"),
  "contact_methods.contact_id": blocksIfAnyRow("contact_methods", "contact_id"),
  "current_state_entries.contact_id": blocksIfAnyRow(
    "current_state_entries",
    "contact_id",
  ),
  "custom_field_value_history.contact_id": blocksIfAnyRow(
    "custom_field_value_history",
    "contact_id",
  ),
  // createContactFullCore seeds one empty value per global definition,
  // quarantined ones included, with modified_at = created_at. Any later
  // upsert rewrites modified_at, so a field filled and cleared (history off)
  // still blocks. A value row for a non-global definition always blocks.
  "custom_field_values.contact_id": {
    disposition: "creation-artefact",
    blockingSql: `SELECT 1 AS hit
                    FROM custom_field_values v
                    LEFT JOIN custom_field_defs d ON d.id = v.field_def_id
                   WHERE v.contact_id = ?
                     AND NOT (COALESCE(d.scope, '') = 'global'
                              AND v.value IS NULL
                              AND v.modified_at = v.created_at)
                   LIMIT 1`,
  },
  "events.contact_id": blocksIfAnyRow("events", "contact_id"),
  "external_contact_links.contact_id": blocksIfAnyRow(
    "external_contact_links",
    "contact_id",
  ),
  "field_history.contact_id": blocksIfAnyRow("field_history", "contact_id"),
  "import_session_rows.contact_id": blocksIfAnyRow(
    "import_session_rows",
    "contact_id",
  ),
  "import_session_rows.matched_contact_id": blocksIfAnyRow(
    "import_session_rows",
    "matched_contact_id",
  ),
  "interaction_assists.contact_id": blocksIfAnyRow(
    "interaction_assists",
    "contact_id",
  ),
  // Interactions also cover group-event participation.
  "interactions.contact_id": blocksIfAnyRow("interactions", "contact_id"),
  "memories.contact_id": blocksIfAnyRow("memories", "contact_id"),
  "off_limits.contact_id": blocksIfAnyRow("off_limits", "contact_id"),
  "profile_contact_presentation.contact_id": blocksIfAnyRow(
    "profile_contact_presentation",
    "contact_id",
  ),
  "reconciliation_session_cards.contact_id": blocksIfAnyRow(
    "reconciliation_session_cards",
    "contact_id",
  ),
  // Inbound key-person links: another contact's key person is this contact.
  "relationships.linked_contact_id": blocksIfAnyRow(
    "relationships",
    "linked_contact_id",
  ),
  "relationships.contact_id": blocksIfAnyRow("relationships", "contact_id"),
  "system_overrides.contact_id": blocksIfAnyRow(
    "system_overrides",
    "contact_id",
  ),
});

/**
 * True while the contact owns nothing but what the app created with it,
 * unchanged (D-106, D-109): its own row with no photo and never modified, and
 * no row that `SHARE_UNDO_OWNERSHIP` says blocks. Run after the share rows
 * are deleted. Caller owns the transaction.
 */
export async function shareContactIsUntouchedCore(
  exec: SqlExecutor,
  contactId: number,
): Promise<boolean> {
  const contact = await exec.getFirstAsync<{
    photo: string | null;
    created_at: string;
    modified_at: string;
  }>("SELECT photo, created_at, modified_at FROM contacts WHERE id = ?", [
    contactId,
  ]);
  if (
    !contact ||
    contact.photo !== null ||
    contact.modified_at !== contact.created_at
  ) {
    return false;
  }
  for (const rule of Object.values(SHARE_UNDO_OWNERSHIP)) {
    const hit = await exec.getFirstAsync<{ hit: number }>(rule.blockingSql, [
      contactId,
    ]);
    if (hit) return false;
  }
  return true;
}

/**
 * Undo a share that also created its contact (D-100), in one transaction:
 *   0. refuse a list that is not this share's own rows (`ShareUndoRefusedError`,
 *      nothing deleted);
 *   0b. check, before any delete, that the rows are the batch the contact was
 *      created with (their `created_at` is gone once they are deleted);
 *   1. delete the share rows (tombstones);
 *   2. if the rows matched and the contact owns nothing else the user added or
 *      changed (D-109), purge it with the archive gate off (D-106); otherwise
 *      keep it active (D-110);
 *   3. one revision bump; every core ran with `bumpRevision: false`.
 * `onPurgeExtensions` runs after COMMIT only when the contact was removed;
 * a failure there is logged, never fatal.
 */
export async function undoCreateContactAndShare(
  exec: SqlExecutor,
  contactId: number,
  rows: readonly ShareRowRef[],
  now: string,
  opts: { onPurgeExtensions?: PurgeExtensions } = {},
): Promise<{ contactRemoved: boolean }> {
  const cleanup = await inWriteTransaction(
    exec,
    async (): Promise<PurgePostCommitCleanup | null> => {
      await assertShareUndoRowsCore(exec, rows);
      const createdWith = await shareRowsMatchCreatedContactCore(
        exec,
        contactId,
        rows,
      );
      await deleteShareRowsCore(exec, rows, now);
      let postCommit: PurgePostCommitCleanup | null = null;
      if (createdWith && (await shareContactIsUntouchedCore(exec, contactId))) {
        postCommit = await purgeContactCore(exec, contactId, {
          now,
          requireArchived: false,
          bumpRevision: false,
        });
      }
      await bumpDataRevisionCore(exec);
      return postCommit;
    },
  );
  if (cleanup === null) return { contactRemoved: false };
  await cleanup(opts.onPurgeExtensions);
  return { contactRemoved: true };
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
