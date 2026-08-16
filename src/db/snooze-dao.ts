/**
 * Snooze write layer (NOTIF-03) — the FIRST writer of `contacts.snooze_until`
 * and the first PRODUCER of the reserved `snooze`/`unsnooze` events.
 *
 * =============================================================================
 * SNOOZE STORAGE CONTRACT (dashboard-read.ts:33-36, the contract this DAO is the
 * first writer of): `snooze_until` is a local `YYYY-MM-DD` string, comparable via
 * a BARE `date(snooze_until) <= date('now','localtime')` (dashboard-read.ts:144 —
 * a future date reads as "still snoozed"). It is computed by SQLite itself via
 * `date('now','localtime', <modifier>)` — NEVER `toISOString()` / a bare
 * `date('now')` (RESEARCH Pitfall 8), and never JS month-length math, so "+1
 * month" stays calendar-correct AND local. The `countSnoozed` /'snoozed' filter
 * segment (dashboard-read.ts) go live once this ships.
 * =============================================================================
 *
 * SINGLE-WRITER / MUTEX (DATA-04): both paths run inside the ONE shared
 * `inWriteTransaction` (the non-reentrant mutex). The immutable events row is
 * composed with `recordEventCore` — the NON-mutexed core (events-dao.ts:62-81),
 * NEVER the mutexed `recordEvent` wrapper: nesting `inWriteTransaction` is a
 * PERMANENT hang (transaction.ts:11-29). Mirrors the favourites-dao `?`-bound
 * single-column UPDATE + `changes===1` loud-failure guard (a bad id throws →
 * whole transaction rolls back). NEITHER path writes or references
 * `last_contact` — recency-dao stays its sole writer (grep-verified: this file
 * references no recency column).
 *
 * Both the in-app profile presets (3d/1w/1m, Plan 11-09) and the headless
 * +1-week notification snooze (Plan 11-07, `preset: "1w"`) call THIS DAO — one
 * writer, one contract.
 *
 * SECURITY: every value is bound with `?`; only static column names and the
 * closed preset→modifier constants are literal text.
 */
import { recordEventCore } from "@/db/events-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

/** The in-app snooze presets (profile) and the headless action's fixed length. */
export type SnoozePreset = "3d" | "1w" | "1m";

/**
 * Preset → SQLite date modifier. The single top-of-file tunable so preset
 * lengths are a one-line edit. `"1w"` is the headless +1-week action; `"3d"` /
 * `"1m"` are the extra in-app profile presets.
 */
export const PRESET_MODIFIERS: Record<SnoozePreset, string> = {
  "3d": "+3 days",
  "1w": "+7 days",
  "1m": "+1 month",
};

/** Snooze a contact until a preset-derived local date. */
export interface SnoozeContactInput {
  contactId: number;
  /** Merge-key UUID for the new "snooze" events row (caller-minted, `newUid()`). */
  uid: string;
  /** How long to snooze — drives the local `snooze_until` date. */
  preset: SnoozePreset;
  /** Local wall-clock now — event `occurred_at`/stamps + contact `modified_at`. */
  now: string;
}

/** Clear a contact's snooze. `uid` is REQUIRED (review item 10). */
export interface ClearSnoozeInput {
  contactId: number;
  /** Merge-key UUID for the new "unsnooze" events row (caller-minted, `newUid()`). */
  uid: string;
  /** Local wall-clock now — event `occurred_at`/stamps + contact `modified_at`. */
  now: string;
}

/**
 * Set `snooze_until` to the local date `date('now','localtime', <preset modifier>)`
 * AND insert one immutable "snooze" event, in ONE transaction (both or neither).
 * SQLite computes the date so "+1 month" is calendar-correct and local, honouring
 * the bare-`date()` dashboard contract. Asserts `changes===1` on the contacts
 * UPDATE (a bad id throws → rollback). `last_contact` is never touched.
 */
export function snoozeContact(
  exec: SqlExecutor,
  input: SnoozeContactInput,
): Promise<void> {
  const modifier = PRESET_MODIFIERS[input.preset];
  return inWriteTransaction(exec, async () => {
    // Compute the target date via SQLite (local, calendar-correct, no JS date
    // math, no toISOString). A bound `?` modifier — never interpolated.
    const dateRow = await exec.getFirstAsync<{ until: string }>(
      "SELECT date('now','localtime', ?) AS until",
      [modifier],
    );
    const until = dateRow?.until ?? null;
    const result = await exec.runAsync(
      "UPDATE contacts SET snooze_until = ?, modified_at = ? WHERE id = ?",
      [until, input.now, input.contactId],
    );
    if (result.changes !== 1) {
      throw new Error(
        `snoozeContact: no contact matched id=${input.contactId} (changed ${result.changes})`,
      );
    }
    // Immutable audit row, composed in the SAME transaction via the NON-mutexed
    // core (never the mutexed recordEvent wrapper — nesting the mutex hangs).
    await recordEventCore(exec, {
      contactId: input.contactId,
      uid: input.uid,
      type: "snooze",
      occurredAt: input.now,
      now: input.now,
      detail: null,
    });
  });
}

/**
 * Clear a contact's snooze (`snooze_until = NULL`) AND ALWAYS insert one
 * immutable "unsnooze" event, in ONE transaction (review item 10 — the events
 * log is the only recovery mechanism, so the audit trail must stay consistent;
 * `uid` is REQUIRED, the insert is unconditional). Asserts `changes===1` on the
 * contacts UPDATE (a bad id throws → rollback). `last_contact` is never touched.
 */
export function clearSnooze(
  exec: SqlExecutor,
  input: ClearSnoozeInput,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    const result = await exec.runAsync(
      "UPDATE contacts SET snooze_until = NULL, modified_at = ? WHERE id = ?",
      [input.now, input.contactId],
    );
    if (result.changes !== 1) {
      throw new Error(
        `clearSnooze: no contact matched id=${input.contactId} (changed ${result.changes})`,
      );
    }
    await recordEventCore(exec, {
      contactId: input.contactId,
      uid: input.uid,
      type: "unsnooze",
      occurredAt: input.now,
      now: input.now,
      detail: null,
    });
  });
}
