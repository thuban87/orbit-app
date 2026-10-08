/**
 * History seed — writes the synthetic History datasets (38.8 Plan 01, D-30).
 *
 * DEV-ONLY. Reached solely from the `__DEV__` dev menu (`uat-probes.ts`, which
 * App.tsx requires only inside `if (__DEV__)`), so it never enters a release
 * bundle (dev-override-release-guard.test.ts). It writes the deterministic plan
 * in `history-seed-spec.ts` on a TEST phone so every 38.8 device check runs on
 * the same data. No network, no device Contacts, no AI. Log lines carry counts
 * and dataset keys only (no names, notes or values).
 *
 * Every per-contact write goes through the app's own Core writers inside ONE
 * `inWriteTransaction` per contact (the mutex is non-reentrant, so nothing here
 * calls a wrapped writer from inside one):
 *   - `createContactFullCore` (contact row, no first interaction),
 *   - `insertInteractionCore` + `recomputeLastContactCore` (the single recency
 *     writer derives `last_contact`; it is never set directly),
 *   - `recordEventCore` (lifecycle history rows),
 *   - `setCurrentStateValueCore` (knowledge changes, chronological per field).
 * After every contact transaction commits, the WRAPPED `createGroupEvent` (its
 * own transaction; dated strictly before today and given `now` explicitly, so
 * its future-date guard cannot throw mid-seed) and `archiveContact` run.
 *
 * Idempotent and never silently partial: when any contact with the seed uid
 * prefix exists, nothing is written; `verifyHistoryFixture` decides between
 * `present` (it matches the spec's per-family counts) and `partial` (with its
 * content-free problems).
 */
import { archiveContact, createContactFullCore } from "@/db/contacts-dao";
import { setCurrentStateValueCore } from "@/db/current-state-history-dao";
import { bumpDataRevisionCore } from "@/db/data-revision-dao";
import { localDateTime } from "@/db/database";
import { recordEventCore } from "@/db/events-dao";
import { createGroupEvent } from "@/db/group-events-dao";
import { readContactHistory } from "@/db/history-read";
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
  type HistorySeedContact,
  type HistorySeedKey,
  type HistorySeedPlan,
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
  | { status: "present" }
  | { status: "partial"; problems: string[] };

/** `LIKE` pattern for the seed uid prefix (it holds no `%` or `_`). */
const UID_LIKE = `${HISTORY_SEED_UID_PREFIX}%`;

async function seedPresent(exec: SqlExecutor): Promise<boolean> {
  const row = await exec.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM contacts WHERE uid LIKE ?",
    [UID_LIKE],
  );
  return (row?.n ?? 0) > 0;
}

/** Group children this dataset receives from the plan's group events. */
function groupChildren(plan: HistorySeedPlan, key: HistorySeedKey): number {
  return plan.groupEvents.filter((g) => g.participants.includes(key)).length;
}

/** Expected per-family counts as read back by `readContactHistory`. */
function expectedCounts(plan: HistorySeedPlan, spec: HistorySeedContact) {
  return {
    interactions: spec.interactions.length + groupChildren(plan, spec.key),
    lifecycle: spec.lifecycle.length + (spec.archive ? 1 : 0),
    knowledge: spec.knowledge.length,
  };
}

// --- Verify ---------------------------------------------------------------------
/**
 * Check the seeded fixture against the spec: every dataset contact exists, its
 * per-family counts match (counts only — a later run's today differs from the
 * seed day, and counts do not depend on it), each group participant has a
 * group-linked row, and Archived is archived. Returns content-free problems
 * (`<dataset key>: <what is wrong>`); empty when the fixture is intact.
 */
export async function verifyHistoryFixture(
  exec: SqlExecutor,
  now: Date,
): Promise<string[]> {
  const plan = buildHistorySeedPlan(now);
  const problems: string[] = [];
  for (const spec of plan.contacts) {
    const row = await exec.getFirstAsync<{
      id: number;
      archived_at: string | null;
    }>("SELECT id, archived_at FROM contacts WHERE uid = ?", [spec.uid]);
    if (!row) {
      problems.push(`${spec.key}: contact missing`);
      continue;
    }
    const history = await readContactHistory(exec, row.id);
    const want = expectedCounts(plan, spec);
    const got = {
      interactions: history.interactions.length,
      lifecycle: history.lifecycleEvents.length,
      knowledge: history.knowledgeChanges.length,
    };
    for (const family of ["interactions", "lifecycle", "knowledge"] as const)
      if (got[family] !== want[family])
        problems.push(
          `${spec.key}: ${got[family]} ${family} != spec ${want[family]}`,
        );
    if (
      groupChildren(plan, spec.key) > 0 &&
      !history.interactions.some((i) => i.groupTitle !== null)
    )
      problems.push(`${spec.key}: no group-linked interaction`);
    if (spec.archive && row.archived_at === null)
      problems.push(`${spec.key}: not archived`);
    if (!spec.archive && row.archived_at !== null)
      problems.push(`${spec.key}: unexpectedly archived`);
  }
  return problems;
}

// --- Seed -----------------------------------------------------------------------
/** Seed every dataset once. See the module header for the idempotency rule. */
export async function seedHistoryFixture(
  exec: SqlExecutor,
  deps: HistorySeedDeps,
): Promise<HistorySeedResult> {
  const nowDate = deps.now();
  if (await seedPresent(exec)) {
    const problems = await verifyHistoryFixture(exec, nowDate);
    if (problems.length === 0) {
      deps.log("history-seed present");
      return { status: "present" };
    }
    deps.log(`history-seed partial ${problems.length} problems`);
    for (const problem of problems) deps.log(`history-seed problem ${problem}`);
    return { status: "partial", problems };
  }

  const now = localDateTime(nowDate);
  const plan = buildHistorySeedPlan(nowDate);
  const counts: HistorySeedCounts = {
    contacts: 0,
    interactions: 0,
    knowledge: 0,
    lifecycle: 0,
    groups: 0,
  };
  const ids = new Map<HistorySeedKey, number>();

  for (const spec of plan.contacts) {
    const contactId = await inWriteTransaction(exec, async () => {
      const { contactId: id } = await createContactFullCore(exec, {
        uid: spec.uid,
        name: spec.name,
        intervalDays: spec.intervalDays,
        trackingEnabled: spec.trackingEnabled,
        now,
      });
      for (const interaction of spec.interactions)
        await insertInteractionCore(exec, id, now, {
          uid: newUid(),
          ...interaction,
        });
      for (const event of spec.lifecycle)
        await recordEventCore(exec, {
          contactId: id,
          uid: newUid(),
          type: event.type,
          occurredAt: event.occurredAt,
          detail: event.detail,
          now: event.occurredAt,
        });
      // Chronological, so each call demotes the previous current value.
      for (const change of spec.knowledge)
        await setCurrentStateValueCore(exec, {
          contactId: id,
          fieldKey: change.fieldKey,
          value: change.value,
          now: change.at,
        });
      await recomputeLastContactCore(exec, id, now);
      await bumpDataRevisionCore(exec);
      return id;
    });
    ids.set(spec.key, contactId);
    counts.contacts += 1;
    counts.interactions += spec.interactions.length;
    counts.lifecycle += spec.lifecycle.length;
    counts.knowledge += spec.knowledge.length;
  }

  // Wrapped writers: each opens its own transaction, so never inside one above.
  for (const event of plan.groupEvents) {
    await createGroupEvent(exec, {
      uid: newUid(),
      title: event.title,
      occurredAt: event.occurredAt,
      now,
      channel: event.channel,
      quality: event.quality,
      groupNote: event.groupNote,
      participants: event.participants.map((key) => {
        const contactId = ids.get(key);
        if (contactId === undefined)
          throw new Error(`history-seed: group participant ${key} not seeded`);
        return { contactId, uid: newUid() };
      }),
    });
    counts.groups += 1;
    counts.interactions += event.participants.length;
  }
  for (const spec of plan.contacts)
    if (spec.archive) {
      const contactId = ids.get(spec.key);
      if (contactId === undefined) continue;
      await archiveContact(exec, contactId, now);
      counts.lifecycle += 1;
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
