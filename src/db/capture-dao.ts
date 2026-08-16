/**
 * Share-sheet capture writer (CAP-02 / CAP-04) — the two atomic fan-outs the
 * capture screen needs, kept OUT of the `.tsx` and in a node-tested DAO (per
 * CLAUDE.md "Queries go through DAOs in `src/db/`, never inline in components").
 *
 * =============================================================================
 * COMPOSE-THE-CORE, WRAP ONCE (transaction.ts non-reentrancy):
 *   The shared write mutex is NON-REENTRANT. Both functions here open exactly ONE
 *   `inWriteTransaction` and, inside it, call the NON-mutexed fuel cores
 *   (`addFuelCore` / `editFuelCore`) N times. They MUST NEVER call the standalone
 *   `addFuel` / `editFuel` wrappers (which each open their own transaction) inside
 *   the loop — nesting the non-reentrant mutex is a documented PERMANENT hang.
 *   A throw anywhere in the loop rolls back the WHOLE fan-out (all N, or none).
 *
 * CAPTURE IS NOT A TOUCHPOINT (CAP-04 / DATA-04 single-writer invariant):
 *   This module writes ONLY fuel rows via `addFuelCore`. It does NOT import or call
 *   `recomputeLastContactCore`, `insertInteractionCore`, or ANY recency/interaction
 *   writer, and it writes NO `last_contact` and NO interaction row. A capture onto a
 *   never-contacted contact leaves `last_contact` NULL — sharing a link is not
 *   "contacting", so the status engine stays uncorrupted (the LinkListener hazard).
 *
 * The caller mints each row's `uid` and sets `kind:'topic'`, `source:'share'`; this
 * DAO does not synthesise provenance. Every value reaches SQLite `?`-bound through
 * the fuel cores (fuel has FIXED columns — no identifier interpolation, T-10-01).
 * =============================================================================
 */
import { addFuelCore, editFuelCore, type NewFuelItem } from "@/db/fuel-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

/**
 * Fan N share-captured fuel rows into ONE transaction and return the inserted
 * `{ id, contactId }` pairs IN INPUT ORDER (A1). Each `id` is that row's
 * `addFuelCore` `lastInsertRowId`, accumulated INSIDE the single transaction —
 * 10-05 (single-tap) and 10-06 (note-recompose) locate the just-written rows by
 * `id + contact_id` (there is no uid-based fuel lookup). A throw mid-loop (e.g. a
 * bad contactId → FK violation) rolls back ALL N.
 *
 * NON-REENTRANCY: composes `addFuelCore` (the non-mutexed core) inside the ONE
 * outer `inWriteTransaction` — NEVER calls `addFuel` / `inWriteTransaction` inside
 * the loop.
 */
export function captureMultiAttach(
  exec: SqlExecutor,
  rows: NewFuelItem[],
): Promise<{ id: number; contactId: number }[]> {
  return inWriteTransaction(exec, async () => {
    const results: { id: number; contactId: number }[] = [];
    for (const row of rows) {
      const id = await addFuelCore(exec, row);
      results.push({ id, contactId: row.contactId });
    }
    return results;
  });
}

/**
 * Apply the SAME composed note `text` to N already-written fuel rows in ONE
 * transaction (B1) — the atomic multi-note apply that would otherwise live inline
 * in the 10-06 `.tsx`. Composes the patch-scoped `editFuelCore` N times, so ONLY
 * `text` + `modified_at` change while `url` and `created_at` stay untouched. Each
 * patch is keyed by BOTH `id` AND `contactId`; a mismatched pair changes 0 rows →
 * `editFuelCore` throws → the whole fan-out rolls back (no partially-noted set).
 *
 * The N=1 note path stays on the standalone `editFuel` wrapper (10-05/10-06 call
 * it directly for one row); this is the N>1 atomic apply. NON-REENTRANCY: composes
 * `editFuelCore` inside the ONE outer `inWriteTransaction` — NEVER calls `editFuel`
 * / `inWriteTransaction` inside the loop.
 */
export function captureMultiNote(
  exec: SqlExecutor,
  rows: { id: number; contactId: number }[],
  text: string,
  now: string,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    for (const { id, contactId } of rows) {
      await editFuelCore(exec, { id, contactId, text, now });
    }
  });
}
