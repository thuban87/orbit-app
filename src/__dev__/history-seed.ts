/**
 * History seed — writes the synthetic History datasets (38.8 Plan 01, D-30).
 *
 * DEV-ONLY. Reached solely from the `__DEV__` dev menu (`uat-probes.ts`, which
 * App.tsx requires only inside `if (__DEV__)`), so it never enters a release
 * bundle (dev-override-release-guard.test.ts). It writes the deterministic plan
 * in `history-seed-spec.ts` on a TEST phone so every 38.8 device check runs on
 * the same data. No network, no device Contacts, no AI. Log lines carry counts
 * only (no names, notes or values).
 *
 * Every write goes through the app's own Core writers inside ONE
 * `inWriteTransaction` per contact (the mutex is non-reentrant, so nothing here
 * calls a wrapped writer from inside one):
 *   - `createContactFullCore` (contact row, no first interaction),
 *   - `insertInteractionCore` + `recomputeLastContactCore` (the single recency
 *     writer derives `last_contact`; it is never set directly).
 *
 * Idempotent: when any contact with the seed uid prefix exists, nothing is
 * written.
 */
import { createContactFullCore } from "@/db/contacts-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { localDateTime } from "@/db/database";
import {
  insertInteractionCore,
  recomputeLastContactCore,
} from "@/db/recency-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";
import { newUid } from "@/db/uid";
import {
  buildHistorySeedPlan,
  HISTORY_SEED_SPEC_VERSION,
  HISTORY_SEED_UID_PREFIX,
} from "./history-seed-spec";

export interface HistorySeedDeps {
  now(): Date;
  log(message: string): void;
}

export interface HistorySeedCounts {
  contacts: number;
  interactions: number;
  knowledge: number;
  lifecycle: number;
  groups: number;
}

export type HistorySeedResult =
  | { status: "created"; counts: HistorySeedCounts }
  | { status: "present" };

/** `LIKE` pattern for the seed uid prefix (the prefix holds no `%`/`_` escapes we rely on). */
const UID_LIKE = `${HISTORY_SEED_UID_PREFIX}%`;

async function seedPresent(exec: SqlExecutor): Promise<boolean> {
  const row = await exec.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM contacts WHERE uid LIKE ?",
    [UID_LIKE],
  );
  return (row?.n ?? 0) > 0;
}

/** Seed every dataset once. See the module header for the idempotency rule. */
export async function seedHistoryFixture(
  exec: SqlExecutor,
  deps: HistorySeedDeps,
): Promise<HistorySeedResult> {
  if (await seedPresent(exec)) {
    deps.log("history-seed present");
    return { status: "present" };
  }
  const nowDate = deps.now();
  const now = localDateTime(nowDate);
  const plan = buildHistorySeedPlan(nowDate);
  const counts: HistorySeedCounts = {
    contacts: 0,
    interactions: 0,
    knowledge: 0,
    lifecycle: 0,
    groups: 0,
  };

  for (const spec of plan.contacts) {
    await inWriteTransaction(exec, async () => {
      const { contactId } = await createContactFullCore(exec, {
        uid: spec.uid,
        name: spec.name,
        intervalDays: spec.intervalDays,
        trackingEnabled: spec.trackingEnabled,
        now,
      });
      for (const interaction of spec.interactions)
        await insertInteractionCore(exec, contactId, now, {
          uid: newUid(),
          ...interaction,
        });
      await recomputeLastContactCore(exec, contactId, now);
      await bumpDataRevisionCore(exec);
    });
    counts.contacts += 1;
    counts.interactions += spec.interactions.length;
  }

  deps.log(
    `history-seed created contacts=${counts.contacts} interactions=${counts.interactions} knowledge=${counts.knowledge} lifecycle=${counts.lifecycle} groups=${counts.groups} spec=${HISTORY_SEED_SPEC_VERSION}`,
  );
  return { status: "created", counts };
}

/** Device deps: the real clock and console (dev menu only). */
export const defaultHistorySeedDeps: HistorySeedDeps = {
  now: () => new Date(),
  log: (message) => console.log(message),
};
