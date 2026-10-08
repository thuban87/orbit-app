/**
 * History seed, end to end (38.8 Plan 01, D-30): the seed writes the spec
 * through the real DAO Core writers (plus the wrapped createGroupEvent and
 * archiveContact, outside any seed transaction) into a FULLY migrated
 * node-sqlite database, and the canonical `readContactHistory` reads each
 * dataset back per family. The seed is idempotent, and a damaged fixture
 * reports `partial` and writes nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { localDateTime, MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { readContactHistory } from "@/db/history-read";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { formatLocalDate } from "@/utils/dates";
import { seedHistoryFixture, verifyHistoryFixture } from "./history-seed";
import {
  buildHistorySeedPlan,
  HISTORY_SEED_SPEC_VERSION,
  HISTORY_SEED_UID_PREFIX,
  type HistorySeedKey,
} from "./history-seed-spec";

vi.mock("expo-sqlite", () => ({}));

/** Mid-year, mid-morning local now (exercises the today clamp). */
const NOW = new Date(2026, 5, 17, 9, 30, 0);
const TODAY = formatLocalDate(NOW);
const plan = buildHistorySeedPlan(NOW);

let db: ReturnType<typeof openTestDb>;
let exec: SqlExecutor;
let seq = 0;

beforeEach(async () => {
  db = openTestDb();
  exec = nodeSqliteExecutor(db);
  seq = 0;
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: localDateTime(NOW),
    newUid: () => `mig-${++seq}`,
    defaultPhoneRegion: "US",
  });
});
afterEach(() => db.close());

function deps(now: Date = NOW) {
  const logs: string[] = [];
  return { logs, deps: { now: () => now, log: (m: string) => logs.push(m) } };
}

async function idOf(key: HistorySeedKey): Promise<number> {
  const row = await exec.getFirstAsync<{ id: number }>(
    "SELECT id FROM contacts WHERE uid = ?",
    [`${HISTORY_SEED_UID_PREFIX}${key}`],
  );
  if (!row) throw new Error(`no seeded contact ${key}`);
  return row.id;
}

async function count(table: string): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ${table}`,
  );
  return row?.n ?? 0;
}

async function totals() {
  return {
    contacts: await count("contacts"),
    interactions: await count("interactions"),
    events: await count("events"),
    knowledge: await count("current_state_entries"),
    groups: await count("group_events"),
  };
}

const sorted = (values: readonly string[]) => [...values].sort();

describe("seedHistoryFixture", () => {
  it("writes every dataset and readContactHistory reproduces each family's counts and dates", async () => {
    const { deps: d } = deps();
    const result = await seedHistoryFixture(exec, d);
    expect(result.status).toBe("created");

    for (const spec of plan.contacts) {
      const history = await readContactHistory(exec, await idOf(spec.key));
      const groupDates = plan.groupEvents
        .filter((g) => g.participants.includes(spec.key))
        .map((g) => g.occurredAt.slice(0, 10));
      const wantInteractions = [
        ...spec.interactions.map((i) => i.occurredAt.slice(0, 10)),
        ...groupDates,
      ];
      const wantLifecycle = [
        ...spec.lifecycle.map((l) => l.occurredAt.slice(0, 10)),
        ...(spec.archive ? [TODAY] : []),
      ];
      expect(sorted(history.interactions.map((i) => i.date)), spec.key).toEqual(
        sorted(wantInteractions),
      );
      expect(
        sorted(history.lifecycleEvents.map((l) => l.date)),
        spec.key,
      ).toEqual(sorted(wantLifecycle));
      expect(
        sorted(history.knowledgeChanges.map((k) => k.date)),
        spec.key,
      ).toEqual(sorted(spec.knowledge.map((k) => k.at.slice(0, 10))));
    }
  });

  it("links group events to Long and Sparse, archives Archived and leaves Empty empty", async () => {
    await seedHistoryFixture(exec, deps().deps);
    for (const key of ["long", "sparse"] as const) {
      const history = await readContactHistory(exec, await idOf(key));
      expect(
        history.interactions.some((i) => i.groupTitle !== null),
        key,
      ).toBe(true);
    }
    const archivedId = await idOf("archived");
    const row = await exec.getFirstAsync<{ archived_at: string | null }>(
      "SELECT archived_at FROM contacts WHERE id = ?",
      [archivedId],
    );
    expect(row?.archived_at).not.toBeNull();
    const archived = await readContactHistory(exec, archivedId);
    expect(archived.lifecycleEvents.some((l) => l.type === "archive")).toBe(
      true,
    );
    const empty = await readContactHistory(exec, await idOf("empty"));
    expect(empty.interactions).toEqual([]);
    expect(empty.lifecycleEvents).toEqual([]);
    expect(empty.knowledgeChanges).toEqual([]);
  });

  it("derives last_contact through the recency writer and never in the future", async () => {
    await seedHistoryFixture(exec, deps().deps);
    const rows = await exec.getAllAsync<{ last_contact: string | null }>(
      "SELECT last_contact FROM contacts WHERE uid LIKE ?",
      [`${HISTORY_SEED_UID_PREFIX}%`],
    );
    expect(rows).toHaveLength(8);
    for (const r of rows)
      if (r.last_contact !== null)
        expect(r.last_contact <= localDateTime(NOW)).toBe(true);
    const long = await exec.getFirstAsync<{ last_contact: string | null }>(
      "SELECT last_contact FROM contacts WHERE id = ?",
      [await idOf("long")],
    );
    expect(long?.last_contact?.slice(0, 10)).toBe(TODAY);
  });

  it("logs a counts-only line", async () => {
    const { deps: d, logs } = deps();
    const result = await seedHistoryFixture(exec, d);
    if (result.status !== "created") throw new Error("not created");
    const t = await totals();
    expect(result.counts).toEqual({
      contacts: 8,
      interactions: t.interactions,
      knowledge: t.knowledge,
      lifecycle: t.events,
      groups: 2,
    });
    expect(logs).toEqual([
      `history-seed created contacts=8 interactions=${t.interactions} knowledge=${t.knowledge} lifecycle=${t.events} groups=2 spec=${HISTORY_SEED_SPEC_VERSION}`,
    ]);
  });

  it("is idempotent: a second run reports present and writes nothing", async () => {
    await seedHistoryFixture(exec, deps().deps);
    const before = await totals();
    const later = new Date(2026, 5, 20, 18, 0, 0);
    const { deps: d, logs } = deps(later);
    expect(await seedHistoryFixture(exec, d)).toEqual({ status: "present" });
    expect(await totals()).toEqual(before);
    expect(logs).toEqual(["history-seed present"]);
    expect(await verifyHistoryFixture(exec, later)).toEqual([]);
  });

  it("reports partial (naming the dataset) and writes nothing when a group link is gone", async () => {
    await seedHistoryFixture(exec, deps().deps);
    await exec.runAsync(
      "UPDATE interactions SET group_event_id = NULL WHERE contact_id = ?",
      [await idOf("sparse")],
    );
    const before = await totals();
    const { deps: d, logs } = deps();
    const result = await seedHistoryFixture(exec, d);
    expect(result.status).toBe("partial");
    if (result.status !== "partial") throw new Error("not partial");
    expect(result.problems.some((p) => p.startsWith("sparse:"))).toBe(true);
    expect(await totals()).toEqual(before);
    expect(logs[0]).toMatch(/^history-seed partial \d+ problems/);
  });

  it("reports partial when Archived has been un-archived", async () => {
    await seedHistoryFixture(exec, deps().deps);
    await exec.runAsync("UPDATE contacts SET archived_at = NULL WHERE id = ?", [
      await idOf("archived"),
    ]);
    const before = await totals();
    const result = await seedHistoryFixture(exec, deps().deps);
    expect(result.status).toBe("partial");
    if (result.status !== "partial") throw new Error("not partial");
    expect(result.problems.some((p) => p.startsWith("archived:"))).toBe(true);
    expect(await totals()).toEqual(before);
  });
});
