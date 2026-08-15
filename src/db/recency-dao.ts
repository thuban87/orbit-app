/**
 * Single-writer recency DAO — THE ONLY writer of `contacts.last_contact` (DATA-04).
 *
 * =============================================================================
 * INVARIANT (load-bearing across the whole project — ROADMAP cross-phase):
 *   `contacts.last_contact` is written by NO other module. Every insert, edit,
 *   or delete of an interaction routes through here, and each one RECOMPUTES
 *   last_contact as MAX(occurred_at) over the contact's CURRENT interaction rows
 *   — never last-write-wins on the touched row. Correcting or deleting a
 *   non-newest row must not move recency; lowering the newest row must move it
 *   back to the next-highest remaining row.
 * =============================================================================
 *
 * Two subtle correctness rules:
 *   1. Recompute is a MAX over CURRENT rows (a correlated subquery), so it is
 *      correct after ANY mutation without special-casing which row changed.
 *   2. For a `rarely_responds = 1` contact the MAX is over CONNECTED rows only
 *      (`connected = 1`); a non-connecting attempt never advances recency. The
 *      filter lives IN THE SQL (`contacts.rarely_responds = 0 OR i.connected = 1`)
 *      so no separate read of the flag is needed. No qualifying row → NULL.
 *
 * Concurrency + atomicity (RESEARCH Pitfalls P3/P4):
 *   Every exported function wraps its body in `withMutex(...)` (the ONE shared
 *   mutex, also imported by the Phase-11/12 headless writers) so only one write
 *   transaction is ever in flight on the shared connection. Inside, each write
 *   is a HAND-ROLLED `BEGIN` / try { ... } / `COMMIT` / catch { `ROLLBACK`;
 *   throw } transaction. We NEVER use expo `withTransactionAsync` /
 *   `withExclusiveTransactionAsync` — they issue a DEFERRED BEGIN on the shared
 *   connection (capturing unrelated writes) and mask the original error on a
 *   throwing rollback.
 *
 * SECURITY (T-02-06): every value is bound with `?` — no string interpolation of
 * any input anywhere in this module.
 *
 * -----------------------------------------------------------------------------
 * TIMESTAMP WRITE CONTRACT (DATA-05 day-granular status correctness DEPENDS on this):
 *   `occurred_at`, `recorded_at`, and the derived `contacts.last_contact` are
 *   persisted as LOCAL wall-clock strings (`YYYY-MM-DD HH:MM:SS`), produced
 *   WITHOUT any UTC conversion. Callers supply local datetimes (via
 *   `localDateTime()` / `formatLocalDate()`, or SQL `date('now','localtime')`) —
 *   NEVER `toISOString()` or a bare `date('now')`. Plan 04's status reads
 *   `last_contact` as ALREADY-LOCAL (`date(last_contact, 'localtime')` truncates
 *   an already-local string idempotently); a future CRUD/log caller that wrote
 *   UTC here would silently re-introduce the near-midnight day-shift bug that was
 *   already fixed once in the plugin. The DAO merely stores the strings it is
 *   given verbatim and copies them into `last_contact` via SQL MAX — it performs
 *   no date math — so the contract is upheld as long as callers pass local
 *   strings. `recency-dao.test.ts` asserts an evening `occurred_at` round-trips
 *   byte-identical. Phases 4/6 inherit this contract.
 * -----------------------------------------------------------------------------
 */
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

/** A touchpoint to record against an existing contact. */
export interface RecordTouchpointInput {
  contactId: number;
  /** Merge-key UUID for the new interaction row (caller-minted, e.g. `newUid()`). */
  uid: string;
  /** Local wall-clock `YYYY-MM-DD HH:MM:SS` (editable; status reads this). */
  occurredAt: string;
  /** Local wall-clock now — immutable `recorded_at` + `modified_at` stamps. */
  now: string;
  /** call|text|in-person|email|other|unspecified. */
  channel?: string;
  /** outbound|inbound|mutual|null. */
  direction?: string | null;
  /** 0/1 — drives the rarely_responds recency filter (default 1 = connected). */
  connected?: number;
  /** good|fine|hard|null. */
  quality?: string | null;
  note?: string | null;
  /** manual|widget|notification|ai (default 'manual'). */
  source?: string;
}

/** An edit to an existing interaction's recency-relevant fields. */
export interface EditTouchpointInput {
  interactionId: number;
  contactId: number;
  /** New local wall-clock `occurred_at`. */
  occurredAt: string;
  /** Local wall-clock now — new `modified_at`. */
  now: string;
  /** Optional new connected flag (0/1); omitted keeps the stored value. */
  connected?: number;
}

/** A deletion of an existing interaction. */
export interface DeleteTouchpointInput {
  interactionId: number;
  contactId: number;
  /** Local wall-clock now — new contact `modified_at`. */
  now: string;
}

/** The first interaction created alongside a brand-new contact (optional). */
export interface FirstInteractionInput {
  uid: string;
  occurredAt: string;
  channel?: string;
  direction?: string | null;
  connected?: number;
  quality?: string | null;
  note?: string | null;
  source?: string;
}

/** A new contact, optionally with its first touchpoint, created atomically. */
export interface CreateContactInput {
  uid: string;
  name: string;
  intervalDays: number;
  /** Local wall-clock now — `created_at` + `modified_at`. */
  now: string;
  categoryId?: number | null;
  /** 0/1 — scopes recency to connected rows (default 0). */
  rarelyResponds?: number;
  /**
   * The first interaction. OMIT for the "not yet / don't know" path: no
   * interaction row is written and `last_contact` stays NULL (never-contacted).
   */
  firstInteraction?: FirstInteractionInput;
}

const DEFAULT_CHANNEL = "unspecified";
const DEFAULT_SOURCE = "manual";
const DEFAULT_CONNECTED = 1;

/**
 * The single recency recompute. ONE correlated UPDATE: sets `last_contact` to
 * MAX(occurred_at) over the contact's current rows — connected-only when the
 * contact is `rarely_responds` — and refreshes `modified_at`. No qualifying row
 * yields NULL. This is the ONLY statement in the codebase that writes
 * `contacts.last_contact`.
 */
async function recomputeLastContact(
  exec: SqlExecutor,
  contactId: number,
  now: string,
): Promise<void> {
  await exec.runAsync(
    `UPDATE contacts
        SET last_contact = (
              SELECT MAX(i.occurred_at)
                FROM interactions i
               WHERE i.contact_id = contacts.id
                 AND (contacts.rarely_responds = 0 OR i.connected = 1)
            ),
            modified_at = ?
      WHERE id = ?`,
    [now, contactId],
  );
}

/** Insert one interaction row (all values bound). Returns its rowid. */
async function insertInteraction(
  exec: SqlExecutor,
  contactId: number,
  now: string,
  i: {
    uid: string;
    occurredAt: string;
    channel?: string;
    direction?: string | null;
    connected?: number;
    quality?: string | null;
    note?: string | null;
    source?: string;
  },
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO interactions
       (uid, contact_id, occurred_at, recorded_at, channel, direction,
        connected, quality, note, source, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      i.uid,
      contactId,
      i.occurredAt,
      now,
      i.channel ?? DEFAULT_CHANNEL,
      i.direction ?? null,
      i.connected ?? DEFAULT_CONNECTED,
      i.quality ?? null,
      i.note ?? null,
      i.source ?? DEFAULT_SOURCE,
      now,
    ],
  );
  return result.lastInsertRowId;
}

/** Record a touchpoint against an existing contact, then recompute recency. */
export function recordTouchpoint(
  exec: SqlExecutor,
  input: RecordTouchpointInput,
): Promise<{ interactionId: number }> {
  return inWriteTransaction(exec, async () => {
    const interactionId = await insertInteraction(
      exec,
      input.contactId,
      input.now,
      input,
    );
    await recomputeLastContact(exec, input.contactId, input.now);
    return { interactionId };
  });
}

/**
 * Edit an existing interaction's `occurred_at` (and optionally `connected`),
 * then recompute recency. Lowering the newest row moves last_contact back to the
 * next-highest remaining row — recompute, not last-write-wins.
 */
export function editTouchpoint(
  exec: SqlExecutor,
  input: EditTouchpointInput,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    // WR-04: scope by BOTH keys. Recompute uses the caller-supplied contactId,
    // so if (interactionId, contactId) don't actually pair, an id-only UPDATE
    // would edit contact A's row while recomputing contact B — leaving A's
    // last_contact stale (the exact "recency silently wrong after a mutation"
    // failure this module's invariant guards against). Scoping by contact_id
    // makes a mismatch update 0 rows; asserting changes === 1 turns that into a
    // loud rollback instead of silent corruption.
    const result = await exec.runAsync(
      `UPDATE interactions
          SET occurred_at = ?,
              connected   = COALESCE(?, connected),
              modified_at = ?
        WHERE id = ? AND contact_id = ?`,
      [
        input.occurredAt,
        input.connected ?? null,
        input.now,
        input.interactionId,
        input.contactId,
      ],
    );
    if (result.changes !== 1) {
      throw new Error(
        `editTouchpoint: no interaction matched id=${input.interactionId} for contactId=${input.contactId} (changed ${result.changes})`,
      );
    }
    await recomputeLastContact(exec, input.contactId, input.now);
  });
}

/** Delete an interaction, then recompute recency (NULL when none remain). */
export function deleteTouchpoint(
  exec: SqlExecutor,
  input: DeleteTouchpointInput,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    // WR-04: scope by BOTH keys (see editTouchpoint). A mismatched pair must not
    // delete contact A's interaction while recomputing contact B — assert
    // exactly one row was deleted, else roll back loudly.
    const result = await exec.runAsync(
      "DELETE FROM interactions WHERE id = ? AND contact_id = ?",
      [input.interactionId, input.contactId],
    );
    if (result.changes !== 1) {
      throw new Error(
        `deleteTouchpoint: no interaction matched id=${input.interactionId} for contactId=${input.contactId} (changed ${result.changes})`,
      );
    }
    await recomputeLastContact(exec, input.contactId, input.now);
  });
}

/**
 * Create a contact and — unless it is the "not yet / don't know" path — its
 * first interaction, in ONE transaction. When `firstInteraction` is omitted, no
 * interaction row is written and `last_contact` stays NULL (never-contacted).
 */
export function createContactWithInteraction(
  exec: SqlExecutor,
  input: CreateContactInput,
): Promise<{ contactId: number; interactionId: number | null }> {
  // WR-02: `interval_days` divides PROGRESS_SQL (status.ts). A 0 or negative
  // interval makes `elapsed / interval_days` evaluate to SQL NULL, every
  // STATUS_SQL comparison against NULL is false, and the row silently buckets
  // as 'stable' forever. Migration 1 is irreversible so a `CHECK (interval_days
  // > 0)` cannot be retrofitted without a table rebuild — the guard lives in TS
  // (CLAUDE.md: "logic that would live in a Postgres function lives in
  // TypeScript"). Reject at this single write chokepoint before the insert.
  if (!Number.isInteger(input.intervalDays) || input.intervalDays <= 0) {
    // Reject (not synchronously throw) so this stays consistent with the
    // Promise-returning contract — a caller's `.catch()` sees it, and no
    // transaction is ever opened.
    return Promise.reject(
      new Error(
        `intervalDays must be a positive integer, got ${input.intervalDays}`,
      ),
    );
  }
  return inWriteTransaction(exec, async () => {
    const contactResult = await exec.runAsync(
      `INSERT INTO contacts
         (uid, name, category_id, interval_days, rarely_responds,
          created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.uid,
        input.name,
        input.categoryId ?? null,
        input.intervalDays,
        input.rarelyResponds ?? 0,
        input.now,
        input.now,
      ],
    );
    const contactId = contactResult.lastInsertRowId;

    let interactionId: number | null = null;
    if (input.firstInteraction) {
      interactionId = await insertInteraction(
        exec,
        contactId,
        input.now,
        input.firstInteraction,
      );
      await recomputeLastContact(exec, contactId, input.now);
    }

    return { contactId, interactionId };
  });
}
