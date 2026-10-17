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
 *
 * INDEFINITE SNOOZE (38.12 D-96, D-98): "Until I turn it off" is stored as the
 * sentinel `INDEFINITE_SNOOZE_UNTIL` (`'9999-12-31'`). It is a real local
 * `YYYY-MM-DD` that passes `assertFutureLocalSnoozeDate`, so the existing
 * writers, Undo (`onRestore`) and every snooze reader treat it exactly like a
 * dated snooze with no change; only display sites special-case it, through
 * `snoozeUntilLabel` (relationship-sheet-model.ts), so no surface prints the
 * year 9999. Migration 034 converts every legacy per-person mute
 * (`reminders_off = 1`) to this sentinel (D-134).
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

import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { recordEventCore } from "@/db/events-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { formatLocalDate, parseLocalMs } from "@/utils/dates";

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

/**
 * The indefinite snooze ("Until I turn it off", D-96): a far-future local date
 * every snooze reader already honours as an active snooze (D-98). Migration 034
 * writes the same literal; its test pins the two equal.
 */
export const INDEFINITE_SNOOZE_UNTIL = "9999-12-31";

/** True only for the exact indefinite-snooze sentinel. */
export function isIndefiniteSnooze(value: string | null | undefined): boolean {
  return value === INDEFINITE_SNOOZE_UNTIL;
}

/**
 * Reject a custom snooze end that is not a real local `YYYY-MM-DD` strictly
 * after the local date of `now` (the Profile and bulk Choose date writers,
 * 38.11 D-37/D-45). Callers run it BEFORE any transaction.
 */
export function assertFutureLocalSnoozeDate(until: string, now: string): void {
  const match = until.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error("snooze: until must be a future local date");
  }
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  const today = formatLocalDate(new Date(parseLocalMs(now)));
  if (formatLocalDate(date) !== until || until <= today) {
    throw new Error("snooze: until must be a future local date");
  }
}

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

/** Resolved input for a caller that already owns the write transaction. */
export interface SnoozeContactCoreInput
  extends Omit<SnoozeContactInput, "preset"> {
  until: string;
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
/** Resolve the SQLite-local target date for one Snooze operation. */
export async function resolveSnoozeUntil(
  exec: SqlExecutor,
  preset: SnoozePreset,
): Promise<string> {
  const dateRow = await exec.getFirstAsync<{ until: string }>(
    "SELECT date('now','localtime', ?) AS until",
    [PRESET_MODIFIERS[preset]],
  );
  if (!dateRow?.until)
    throw new Error("snoozeContact: could not resolve local target date");
  return dateRow.until;
}

/** Non-mutexed snooze primitive for callers that already own a transaction. */
export async function snoozeContactCore(
  exec: SqlExecutor,
  input: SnoozeContactCoreInput,
): Promise<void> {
  const result = await exec.runAsync(
    "UPDATE contacts SET snooze_until = ?, modified_at = ? WHERE id = ?",
    [input.until, input.now, input.contactId],
  );
  if (result.changes !== 1) {
    throw new Error(
      `snoozeContact: no contact matched id=${input.contactId} (changed ${result.changes})`,
    );
  }
  await recordEventCore(exec, {
    contactId: input.contactId,
    uid: input.uid,
    type: "snooze",
    occurredAt: input.now,
    now: input.now,
    detail: null,
  });
}

export function snoozeContact(
  exec: SqlExecutor,
  input: SnoozeContactInput,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await snoozeContactCore(exec, {
      contactId: input.contactId,
      uid: input.uid,
      until: await resolveSnoozeUntil(exec, input.preset),
      now: input.now,
    });
    await bumpDataRevisionCore(exec);
  });
}

/**
 * Clear a contact's snooze (`snooze_until = NULL`) AND ALWAYS insert one
 * immutable "unsnooze" event, in ONE transaction (review item 10 — the events
 * log is the only recovery mechanism, so the audit trail must stay consistent;
 * `uid` is REQUIRED, the insert is unconditional). Asserts `changes===1` on the
 * contacts UPDATE (a bad id throws → rollback). `last_contact` is never touched.
 */
/** Non-mutexed unsnooze primitive for callers that already own a transaction. */
export async function clearSnoozeCore(
  exec: SqlExecutor,
  input: ClearSnoozeInput,
): Promise<void> {
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
}

export function clearSnooze(
  exec: SqlExecutor,
  input: ClearSnoozeInput,
): Promise<void> {
  return inWriteTransaction(exec, async () => {
    await clearSnoozeCore(exec, input);
    await bumpDataRevisionCore(exec);
  });
}
