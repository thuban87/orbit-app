/**
 * Public, transaction-owning relationship actions for Profile tiles.
 *
 * These wrappers compose existing non-mutexed cores beneath exactly one outer
 * transaction and publish exactly one data-revision bump. UI code must never
 * import the cores directly. A per-executor pending latch coalesces only an
 * accidental concurrent submission; after settlement, repeated same-state
 * snooze/unsnooze requests execute normally and retain their unconditional
 * immutable events (ADR-103).
 */

import { setContactFrequencyCore } from "@/db/contacts-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import {
  clearSnoozeCore,
  resolveSnoozeUntil,
  type SnoozePreset,
  snoozeContactCore,
} from "@/db/snooze-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import { formatLocalDate, parseLocalMs } from "@/utils/dates";

export interface SetProfileContactFrequencyInput {
  readonly contactId: number;
  readonly intervalDays: number;
  readonly now: string;
}

interface ProfileSnoozeBaseInput {
  readonly contactId: number;
  readonly now: string;
}

export type SnoozeProfileContactInput = ProfileSnoozeBaseInput &
  (
    | { readonly preset: SnoozePreset; readonly until?: never }
    | { readonly preset?: never; readonly until: string }
  );

export interface UnsnoozeProfileContactInput {
  readonly contactId: number;
  readonly now: string;
}

const pendingByExecutor = new WeakMap<
  SqlExecutor,
  Map<string, Promise<void>>
>();

function runWhilePending(
  exec: SqlExecutor,
  key: string,
  operation: () => Promise<void>,
): Promise<void> {
  let pending = pendingByExecutor.get(exec);
  if (!pending) {
    pending = new Map();
    pendingByExecutor.set(exec, pending);
  }
  const existing = pending.get(key);
  if (existing) return existing;

  const promise = operation().finally(() => {
    if (pending?.get(key) === promise) {
      pending.delete(key);
      if (pending.size === 0) pendingByExecutor.delete(exec);
    }
  });
  pending.set(key, promise);
  return promise;
}

function assertPositiveFrequency(intervalDays: number): void {
  if (!Number.isInteger(intervalDays) || intervalDays <= 0) {
    throw new Error(
      `intervalDays must be a positive integer, got ${intervalDays}`,
    );
  }
}

function assertFutureLocalDate(until: string, now: string): void {
  const match = until.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`snoozeProfileContact: until must be a future local date`);
  }
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  const today = formatLocalDate(new Date(parseLocalMs(now)));
  if (formatLocalDate(date) !== until || until <= today) {
    throw new Error(`snoozeProfileContact: until must be a future local date`);
  }
}

/** Apply the canonical scalar cadence writer and one revision publication. */
export function setProfileContactFrequency(
  exec: SqlExecutor,
  input: SetProfileContactFrequencyInput,
): Promise<void> {
  try {
    assertPositiveFrequency(input.intervalDays);
  } catch (error) {
    return Promise.reject(error);
  }
  return runWhilePending(exec, `frequency:${input.contactId}`, () =>
    inWriteTransaction(exec, async () => {
      // Exact live setContactFrequencyCore behavior: this changes cadence only.
      // In particular, assigning a dormant cadence does not bind an Unbound row.
      await setContactFrequencyCore(
        exec,
        input.contactId,
        input.intervalDays,
        input.now,
      );
      await bumpDataRevisionCore(exec);
    }),
  );
}

/** Apply a preset or already-resolved custom local snooze end date. */
export function snoozeProfileContact(
  exec: SqlExecutor,
  input: SnoozeProfileContactInput,
): Promise<void> {
  if (input.until !== undefined) {
    try {
      assertFutureLocalDate(input.until, input.now);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  return runWhilePending(exec, `snooze:${input.contactId}`, async () => {
    const until =
      input.until ??
      (await resolveSnoozeUntil(exec, input.preset as SnoozePreset));
    await inWriteTransaction(exec, async () => {
      await snoozeContactCore(exec, {
        contactId: input.contactId,
        uid: newUid(),
        until,
        now: input.now,
      });
      await bumpDataRevisionCore(exec);
    });
  });
}

/** Clear snooze while preserving the core's unconditional immutable event. */
export function unsnoozeProfileContact(
  exec: SqlExecutor,
  input: UnsnoozeProfileContactInput,
): Promise<void> {
  return runWhilePending(exec, `unsnooze:${input.contactId}`, () =>
    inWriteTransaction(exec, async () => {
      await clearSnoozeCore(exec, {
        contactId: input.contactId,
        uid: newUid(),
        now: input.now,
      });
      await bumpDataRevisionCore(exec);
    }),
  );
}
