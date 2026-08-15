/**
 * Composed atomic-create DAO (CRUD-01 / CRUD-02) — the phase's central
 * architectural task (RESEARCH Pattern 2).
 *
 * `createContactFull` writes a contact row + (for the Today / Pick-date path) its
 * first interaction through the single-writer recompute + any `show_on_new`
 * custom values — ALL in ONE `inWriteTransaction`. It COMPOSES the non-mutexed
 * cores extracted from the recency + field-values DAOs; it must NEVER call the
 * wrapped `createContactWithInteraction` / `upsertValue` (each opens its own
 * `inWriteTransaction`, and the shared mutex is NON-REENTRANT — nesting it is a
 * PERMANENT hang; transaction.ts, RESEARCH Pitfall 1 / review HIGH-1).
 *
 * =============================================================================
 * COMPOSITION CONTRACT — READ BEFORE EDITING:
 *   • Enter the mutex EXACTLY ONCE (one `inWriteTransaction`). Inside, call the
 *     `*Core` variants only — `insertInteractionCore`, `recomputeLastContactCore`
 *     (recency-dao), `upsertValueCore` (field-values-dao) — each assumes BEGIN is
 *     already open and takes no mutex.
 *   • `last_contact` is written ONLY via `recomputeLastContactCore` — the
 *     single-writer invariant (DATA-04) stays intact.
 *   • The first interaction is `source='manual'`, `direction=null` (defaults in
 *     `insertInteractionCore`) — never `outbound`, which would pollute intensity
 *     math (T-04-04).
 *   • A throw ANYWHERE in the body (bad custom-values column, UNIQUE clash, …)
 *     rolls back the contact + interaction + values TOGETHER — one transaction,
 *     not two (T-04-03; proven by the mid-composition ROLLBACK test).
 * =============================================================================
 *
 * PRE-TRANSACTION GUARDS (return a rejected Promise so no transaction opens and a
 * caller's `.catch()` sees them — mirrors recency-dao.ts):
 *   1. `interval_days` must be a positive integer (WR-02 — a 0/negative interval
 *      makes PROGRESS_SQL NULL and the row buckets 'stable' forever; migration 1
 *      is irreversible so the guard lives in TS).
 *   2. When `firstInteraction` is supplied, its `occurredAt` must be <= `now`
 *      (CRUD-02 — a future `occurred_at`→`last_contact` would pin the contact
 *      permanently 'stable'; enforced at the DAO chokepoint, defence-in-depth
 *      behind the UI). Both are local `YYYY-MM-DD HH:MM:SS` strings, so a lexical
 *      `>` comparison is a correct chronological future-date check.
 *
 * CRUD-01 LEAN SET: the create INSERT carries `phone` (the previously-dropped
 * field). `email` / `social_battery` / `birthday` are INTENTIONALLY create-
 * excluded (edit-only per 06-crud Cluster A) — the omission is deliberate.
 *
 * SECURITY (T-04-02): every runtime value is `?`-bound. The ONLY interpolated
 * identifier is a custom `col_name`, and it reaches SQL solely through the guarded
 * `upsertValueCore` (`isSafeColName` + double-quote). No new interpolation site.
 *
 * Node-pure: takes `exec: SqlExecutor`; imports the shared `inWriteTransaction`.
 */
import {
  insertInteractionCore,
  recomputeLastContactCore,
  type FirstInteractionInput,
} from "@/db/recency-dao";
import { upsertValueCore } from "@/db/field-values-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";

/** One custom value to write on the new contact's `contact_custom_values` row. */
export interface CustomValueInput {
  /** The physical value column (an `isSafeColName`-constructed identifier). */
  col: string;
  value: string | null;
}

/**
 * A brand-new contact plus (optionally) its first touchpoint and `show_on_new`
 * custom values, created atomically. `phone` is the ONLY reach field on create
 * (CRUD-01 lean set); email/social_battery/birthday are edit-only.
 */
export interface CreateContactFullInput {
  /** Contact-row merge-key uid (caller-minted). */
  uid: string;
  name: string;
  intervalDays: number;
  /** Local wall-clock now — `created_at` + `modified_at` + interaction stamps. */
  now: string;
  /** CRUD-01 lean set. Omitted → stored NULL. */
  phone?: string | null;
  categoryId?: number | null;
  /** 0/1 — scopes recency to connected rows (default 0). */
  rarelyResponds?: number;
  /**
   * The first interaction. OMIT for the "not yet / don't know" path: no
   * interaction row is written and `last_contact` stays NULL (never-contacted).
   */
  firstInteraction?: FirstInteractionInput;
  /**
   * The per-contact `contact_custom_values` ROW uid. When omitted, one is minted
   * here (safe: `ON CONFLICT(contact_id) DO UPDATE` never rewrites the persisted
   * uid — mirrors Plan 06's always-mint resolution).
   */
  rowUid?: string;
  /** `show_on_new` custom values to write on the new contact's values row. */
  customValues?: CustomValueInput[];
}

/**
 * Create a contact + (optionally) first interaction + custom values atomically.
 * Returns the new contact id and the interaction id (null on the "not yet" path).
 */
export function createContactFull(
  exec: SqlExecutor,
  input: CreateContactFullInput,
): Promise<{ contactId: number; interactionId: number | null }> {
  // GUARD 1 (WR-02): positive-integer interval. Reject BEFORE any transaction
  // opens (return, not throw — keeps the Promise contract; no BEGIN is issued).
  if (!Number.isInteger(input.intervalDays) || input.intervalDays <= 0) {
    return Promise.reject(
      new Error(
        `intervalDays must be a positive integer, got ${input.intervalDays}`,
      ),
    );
  }
  // GUARD 2 (CRUD-02): reject a FUTURE first-interaction occurredAt. Local
  // wall-clock strings sort chronologically, so `> now` is a correct future test.
  if (input.firstInteraction && input.firstInteraction.occurredAt > input.now) {
    return Promise.reject(
      new Error(
        `firstInteraction.occurredAt is in the future (${input.firstInteraction.occurredAt} > ${input.now})`,
      ),
    );
  }

  return inWriteTransaction(exec, async () => {
    // Contact row — CRUD-01 lean set INCLUDING phone. email/social_battery/
    // birthday are deliberately absent (edit-only).
    const contactResult = await exec.runAsync(
      `INSERT INTO contacts
         (uid, name, category_id, interval_days, rarely_responds, phone,
          created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.uid,
        input.name,
        input.categoryId ?? null,
        input.intervalDays,
        input.rarelyResponds ?? 0,
        input.phone ?? null,
        input.now,
        input.now,
      ],
    );
    const contactId = contactResult.lastInsertRowId;

    // First interaction (Today / Pick-date path) → recompute last_contact via the
    // single writer. Skipped on the "not yet" path (last_contact stays NULL).
    let interactionId: number | null = null;
    if (input.firstInteraction) {
      interactionId = await insertInteractionCore(
        exec,
        contactId,
        input.now,
        input.firstInteraction,
      );
      await recomputeLastContactCore(exec, contactId, input.now);
    }

    // Custom values — resolve the per-contact values-row uid to a NON-NULL string
    // ONCE before the loop, so an `undefined` uid can never reach upsertValueCore
    // (strict TS: it requires a non-null string). Minting here is safe because the
    // values row's persisted uid is written on INSERT only.
    const customValues = input.customValues ?? [];
    if (customValues.length > 0) {
      const valuesRowUid = input.rowUid ?? newUid();
      for (const cv of customValues) {
        await upsertValueCore(
          exec,
          contactId,
          valuesRowUid,
          cv.col,
          cv.value,
          input.now,
        );
      }
    }

    return { contactId, interactionId };
  });
}
