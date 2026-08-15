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

// =============================================================================
// EDIT (CRUD-03) — updateContactFull: the metadata-edit writer.
//
// Composes updateContactMetadataCore + upsertValueCore × N + (conditional)
// recomputeLastContactCore + (optional, never-contacted-only) insertInteractionCore
// inside ONE inWriteTransaction — the SAME composition contract as create.
//
//   • The metadata UPDATE SET list OMITS `last_contact` entirely (single-writer
//     invariant DATA-04). last_contact is written ONLY via recomputeLastContactCore.
//   • recomputeLastContactCore fires IF AND ONLY IF the incoming `rarelyResponds`
//     differs from the STORED value (Pitfall 2 — the flag changes which rows count
//     toward recency, so a metadata-only UPDATE silently corrupts status math) OR a
//     first interaction was just inserted. The metadata UPDATE runs FIRST so the
//     recompute reads the NEW flag.
//   • FIRST-INTERACTION-ON-EDIT (owner ruling 2026-08-14, CONTEXT Area 3): a
//     `firstInteraction` is honoured ONLY when the STORED `last_contact IS NULL`
//     (re-checked INSIDE the transaction; throw → rollback for an already-contacted
//     contact — timeline edits stay Phase 6). It is written via insertInteractionCore
//     (source='manual', direction=null — the same single-writer path as create), never
//     as a direct last_contact write. A future occurredAt is rejected pre-transaction.
// =============================================================================

/** The edit payload — the mutable `contacts` columns + custom values + optional first-touch. */
export interface UpdateContactFullInput {
  /** The contact to edit. */
  id: number;
  name: string;
  intervalDays: number;
  /** Local wall-clock now — `modified_at` + any interaction stamps. */
  now: string;
  /** 0/1 incoming flag — the DAO reads the STORED value to decide whether to recompute. */
  rarelyResponds: number;
  /** 0/1 — suppress this contact's reminders. */
  remindersOff: number;
  categoryId?: number | null;
  socialBattery?: string | null;
  birthday?: string | null;
  phone?: string | null;
  email?: string | null;
  /**
   * The per-contact `contact_custom_values` ROW uid. When omitted (and values are
   * written), one is minted here (safe: `ON CONFLICT(contact_id) DO UPDATE` never
   * rewrites the persisted uid — mirrors create's always-mint resolution).
   */
  rowUid?: string;
  /** Custom values to write on the contact's values row. */
  customValues?: CustomValueInput[];
  /**
   * A FIRST interaction to record — honoured ONLY when the STORED `last_contact IS
   * NULL` (never-contacted). For an already-contacted contact it throws (rollback).
   */
  firstInteraction?: FirstInteractionInput;
}

/**
 * NON-mutexed metadata-edit CORE: ONE `UPDATE contacts` of every mutable column
 * EXCEPT `last_contact` (single-writer DATA-04). Asserts exactly one row changed
 * (a non-matching id throws → rollback, mirroring recency-dao's loud-failure guard).
 * Call ONLY inside an already-open `inWriteTransaction`.
 */
export async function updateContactMetadataCore(
  exec: SqlExecutor,
  input: UpdateContactFullInput,
): Promise<void> {
  const result = await exec.runAsync(
    `UPDATE contacts SET
       name=?, category_id=?, interval_days=?, social_battery=?, birthday=?,
       phone=?, email=?, rarely_responds=?, reminders_off=?, modified_at=?
     WHERE id=?`,
    [
      input.name,
      input.categoryId ?? null,
      input.intervalDays,
      input.socialBattery ?? null,
      input.birthday ?? null,
      input.phone ?? null,
      input.email ?? null,
      input.rarelyResponds,
      input.remindersOff,
      input.now,
      input.id,
    ],
  );
  if (result.changes !== 1) {
    throw new Error(
      `updateContactMetadataCore: no contact matched id=${input.id} (changed ${result.changes})`,
    );
  }
}

/**
 * Edit a contact's metadata + custom values atomically, recomputing recency only
 * when the `rarely_responds` flag flips or a first interaction is inserted. See the
 * composition contract above.
 */
export function updateContactFull(
  exec: SqlExecutor,
  input: UpdateContactFullInput,
): Promise<void> {
  // GUARD 1 (WR-02): positive-integer interval (mirrors createContactFull).
  if (!Number.isInteger(input.intervalDays) || input.intervalDays <= 0) {
    return Promise.reject(
      new Error(
        `intervalDays must be a positive integer, got ${input.intervalDays}`,
      ),
    );
  }
  // GUARD 2 (CRUD-02): reject a FUTURE first-interaction occurredAt BEFORE any
  // transaction opens. Local wall-clock strings sort chronologically.
  if (input.firstInteraction && input.firstInteraction.occurredAt > input.now) {
    return Promise.reject(
      new Error(
        `firstInteraction.occurredAt is in the future (${input.firstInteraction.occurredAt} > ${input.now})`,
      ),
    );
  }

  return inWriteTransaction(exec, async () => {
    // Read the STORED rarely_responds AND last_contact FIRST — before the metadata
    // UPDATE overwrites the flag — so we can (a) detect a flag flip and (b) enforce
    // the never-contacted-only rule for firstInteraction inside the transaction.
    const stored = await exec.getFirstAsync<{
      rarely_responds: number;
      last_contact: string | null;
    }>(
      "SELECT rarely_responds, last_contact FROM contacts WHERE id = ?",
      [input.id],
    );
    if (!stored) {
      throw new Error(`updateContactFull: no contact with id=${input.id}`);
    }

    // Metadata UPDATE (never writes last_contact). Runs FIRST so a later recompute
    // reads the NEW rarely_responds flag.
    await updateContactMetadataCore(exec, input);

    // Custom values — resolve the per-contact values-row uid ONCE (non-null string).
    const customValues = input.customValues ?? [];
    if (customValues.length > 0) {
      const valuesRowUid = input.rowUid ?? newUid();
      for (const cv of customValues) {
        await upsertValueCore(
          exec,
          input.id,
          valuesRowUid,
          cv.col,
          cv.value,
          input.now,
        );
      }
    }

    // FIRST-INTERACTION-ON-EDIT (owner ruling): honoured ONLY when the stored
    // last_contact IS NULL. An already-contacted contact's timeline stays Phase 6.
    let firstInteractionInserted = false;
    if (input.firstInteraction) {
      if (stored.last_contact !== null) {
        throw new Error(
          `updateContactFull: firstInteraction rejected — contact id=${input.id} already has last_contact set (timeline edits are Phase 6)`,
        );
      }
      await insertInteractionCore(
        exec,
        input.id,
        input.now,
        input.firstInteraction,
      );
      firstInteractionInserted = true;
    }

    // Recompute through the single writer IFF the flag flipped OR a first
    // interaction was inserted — inside the SAME transaction (Pitfall 2).
    if (input.rarelyResponds !== stored.rarely_responds || firstInteractionInserted) {
      await recomputeLastContactCore(exec, input.id, input.now);
    }
  });
}
