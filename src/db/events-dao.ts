/**
 * Immutable events writer (LOG-02) — the durable "record of what the app did".
 *
 * =============================================================================
 * INSERT-ONLY / IMMUTABLE (dossier §"Event rows are immutable", 04-log.md):
 *   An events row records a lifecycle fact after it happened; it is NEVER edited.
 *   This module therefore exposes ONLY an insert path — `recordEvent` (mutexed)
 *   and `recordEventCore` (the non-mutexed composition primitive). There is NO
 *   update/edit/mutate function, deliberately: the sole removal path is the
 *   contact FK / purge fan-out (purge-dao's explicit DELETE FROM events). Do not
 *   add an `UPDATE events` here — it would break the immutability contract.
 * =============================================================================
 *
 * v1 vocabulary (`EventType`) is the full dossier set archive|restore|snooze|
 * unsnooze ([log → data] ~line 571 "a record of what the app did"). Only
 * `archive`/`restore` have a PRODUCER this phase — the archiveContact/
 * restoreContact retrofit (contacts-dao) composes `recordEventCore` inside its
 * one existing transaction. `snooze`/`unsnooze` are RESERVED (forward-compatible)
 * and have no producing feature until a later phase — do not write them here.
 *
 * NON-REENTRANCY (mirrors recency-dao's *Core split + transaction.ts):
 *   `recordEventCore` takes NO mutex and opens NO transaction — it assumes BEGIN
 *   is already open and is correct ONLY when called inside an already-open
 *   `inWriteTransaction` (never bare, never nested — a nested `inWriteTransaction`
 *   is a PERMANENT hang, mutex.ts:32-36). `recordEvent` is the mutexed public
 *   wrapper that runs the same core inside ONE `inWriteTransaction`.
 *
 * SECURITY (T-06-04): every value is bound with `?` — no string interpolation of
 * any input anywhere in this module; only static column names are literal text.
 */
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

/**
 * The v1 lifecycle-event vocabulary. `archive`/`restore` have producers this
 * phase; `snooze`/`unsnooze` are RESERVED for a later phase (no producer yet).
 */
export type EventType = "archive" | "restore" | "snooze" | "unsnooze";

/** One immutable events row to record against an existing contact. */
export interface RecordEventInput {
  contactId: number;
  /** Merge-key UUID for the new events row (caller-minted, e.g. `newUid()`). */
  uid: string;
  /** The lifecycle fact this row records. */
  type: EventType;
  /** Local wall-clock `YYYY-MM-DD HH:MM:SS` — when the event happened. */
  occurredAt: string;
  /** Optional free-text detail; archive/restore carry none (stored NULL). */
  detail?: string | null;
  /** Local wall-clock now — immutable `recorded_at` + `modified_at` stamps. */
  now: string;
}

/**
 * NON-mutexed CORE: insert ONE immutable events row, assuming BEGIN is already
 * open. This is the composition primitive the archive/restore retrofit calls
 * inside its ONE existing `inWriteTransaction` — call it ONLY inside an already-
 * open transaction (never bare, never nested). Every value is `?`-bound; only the
 * column names are static text. Returns the new row's rowid.
 */
export async function recordEventCore(
  exec: SqlExecutor,
  input: RecordEventInput,
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO events
       (uid, contact_id, type, occurred_at, detail, recorded_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.uid,
      input.contactId,
      input.type,
      input.occurredAt,
      input.detail ?? null,
      input.now,
      input.now,
    ],
  );
  return result.lastInsertRowId;
}

/**
 * Record one immutable event against an existing contact. The mutexed public
 * entry point: wraps `recordEventCore` in ONE `inWriteTransaction` (mirrors
 * recency-dao's recordTouchpoint). Returns the new row's rowid.
 */
export function recordEvent(
  exec: SqlExecutor,
  input: RecordEventInput,
): Promise<number> {
  return inWriteTransaction(exec, () => recordEventCore(exec, input));
}
