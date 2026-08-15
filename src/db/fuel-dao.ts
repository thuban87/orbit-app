/**
 * Conversational-fuel writer (FUEL-01/FUEL-02) — per-item fuel on a contact:
 * add / edit / delete, across 5 kinds, with optional label/text/url.
 *
 * The `fuel` table already ships in migration 1 (`001-initial.ts`:167-179): `uid
 * TEXT UNIQUE`, `contact_id → contacts ON DELETE CASCADE`, `kind TEXT NOT NULL`
 * (no CHECK), `label`/`text`/`url` nullable TEXT, `created_at`/`source`/
 * `modified_at` NOT NULL. This is DAO-only; there is NO migration this phase and
 * NEVER an index/UNIQUE on any fuel column (nothing here needs one at tens-of-rows
 * scale, and a ranking index would require a forbidden migration 2).
 *
 * =============================================================================
 * CORE / WRAPPER SPLIT (the phase's central pattern — see transaction.ts):
 *   The shared mutex is NON-REENTRANT. The mutating CORES (`addFuelCore`,
 *   `editFuelCore`, `deleteFuelCore`) open NO transaction — they assume a BEGIN is
 *   already held. The standalone WRAPPERS (`addFuel`/`editFuel`/`deleteFuel`) each
 *   wrap their core in exactly ONE `inWriteTransaction` for single callers. Phase
 *   10's multi-attach capture will compose `addFuelCore` N times inside ONE outer
 *   `inWriteTransaction` so a whole fan-out is atomic — never nesting the mutex.
 * =============================================================================
 *
 * EVERY mutation is scoped by BOTH `id` AND `contact_id` and asserts exactly one
 * change (WR-04 both-keys precedent, contact-links-dao): a mismatched pair changes
 * 0 rows → a loud rollback instead of silent cross-contact corruption. Every value
 * is `?`-bound; fuel has FIXED columns so no identifier is ever interpolated
 * (unlike custom fields) — T-07-01. `created_at` is NEVER touched on edit (age is
 * stable from creation, FUEL-04). Timestamps are caller-supplied local wall-clock
 * (`localDateTime()`, never `toISOString`).
 *
 * Node-pure: takes `exec: SqlExecutor`; imports the shared `inWriteTransaction`.
 */
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

/**
 * The 5-kind fuel vocabulary (FUEL-02). The column has no CHECK — the union is the
 * enforcement boundary. `off_limits` is a first-class kind: it is editable on the
 * profile (surfaced only by `fuel-read`'s `listFuelForEditor`) but every projection
 * (ranked line, search — Plans 02/04) MUST exclude it in-query.
 */
export type FuelKind = "recent" | "topic" | "fact" | "gift" | "off_limits";

/**
 * The provenance of a fuel row. A `string` alias (the column has no CHECK) whose
 * documented vocabulary is: 'user' (typed on the profile), 'share' (Phase-10
 * multi-attach), 'ai' (an AI suggestion, unconfirmed), 'manual' (an AI suggestion
 * a user confirmed — the confirm-flip target, resolved owner decision 2026-08-15,
 * recorded in Plan 03).
 */
export type FuelSource = string;

/** One new fuel row to insert against an existing contact. */
export interface NewFuelItem {
  /** Merge-key UUID for the new row (caller-minted, e.g. `newUid()`). */
  uid: string;
  contactId: number;
  kind: FuelKind;
  /** Optional short label; stored NULL when null/undefined. */
  label?: string | null;
  /** Optional body text; stored NULL when null/undefined. */
  text?: string | null;
  /** Optional link; stored NULL when null/undefined. */
  url?: string | null;
  /** Local wall-clock creation stamp — immutable once set (FUEL-04 age). */
  createdAt: string;
  /** Provenance (see `FuelSource`). */
  source: FuelSource;
  /** Local wall-clock now — the `modified_at` stamp. */
  now: string;
}

/** An edit to an existing fuel row, scoped by BOTH id AND contactId. */
export interface EditFuelInput {
  id: number;
  contactId: number;
  kind: FuelKind;
  /** Nullable — a blank optional is normalized to NULL at the commit boundary. */
  label: string | null;
  text: string | null;
  url: string | null;
  /** Local wall-clock now — bumps `modified_at`; `created_at` is left untouched. */
  now: string;
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
      `${op}: no fuel matched id=${id} for contactId=${contactId} (changed ${changes})`,
    );
  }
}

// --- Non-mutexed cores (assume BEGIN already open — never open a transaction) --

/**
 * Insert ONE fuel row, assuming BEGIN is already open. The composition primitive
 * Phase-10 multi-attach calls N times inside its ONE outer `inWriteTransaction`.
 * The 9 columns are INSERTed in migration order; every value is `?`-bound; only
 * the column names are static text. Returns the new row's rowid.
 */
export async function addFuelCore(
  exec: SqlExecutor,
  input: NewFuelItem,
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO fuel
       (uid, contact_id, kind, label, text, url, created_at, source, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.uid,
      input.contactId,
      input.kind,
      input.label ?? null,
      input.text ?? null,
      input.url ?? null,
      input.createdAt,
      input.source,
      input.now,
    ],
  );
  return result.lastInsertRowId;
}

/**
 * UPDATE kind/label/text/url + modified_at for the matching (id, contact_id) +
 * assertOneChange. NEVER touches `created_at` (age is stable from creation).
 */
export async function editFuelCore(
  exec: SqlExecutor,
  input: EditFuelInput,
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE fuel
        SET kind = ?, label = ?, text = ?, url = ?, modified_at = ?
      WHERE id = ? AND contact_id = ?`,
    [
      input.kind,
      input.label,
      input.text,
      input.url,
      input.now,
      input.id,
      input.contactId,
    ],
  );
  assertOneChange("editFuel", input.id, input.contactId, result.changes);
}

/** DELETE the matching (id, contact_id) + assertOneChange. */
export async function deleteFuelCore(
  exec: SqlExecutor,
  input: { id: number; contactId: number },
): Promise<void> {
  const result = await exec.runAsync(
    "DELETE FROM fuel WHERE id = ? AND contact_id = ?",
    [input.id, input.contactId],
  );
  assertOneChange("deleteFuel", input.id, input.contactId, result.changes);
}

// --- Standalone wrappers (own ONE transaction each) --------------------------

/** Add one fuel row (standalone). Wraps `addFuelCore` in one transaction. */
export function addFuel(
  exec: SqlExecutor,
  input: NewFuelItem,
): Promise<number> {
  return inWriteTransaction(exec, () => addFuelCore(exec, input));
}

/** Edit one fuel row (standalone). Wraps `editFuelCore` in one transaction. */
export function editFuel(
  exec: SqlExecutor,
  input: EditFuelInput,
): Promise<void> {
  return inWriteTransaction(exec, () => editFuelCore(exec, input));
}

/** Delete one fuel row (standalone). Wraps `deleteFuelCore` in one transaction. */
export function deleteFuel(
  exec: SqlExecutor,
  input: { id: number; contactId: number },
): Promise<void> {
  return inWriteTransaction(exec, () => deleteFuelCore(exec, input));
}
