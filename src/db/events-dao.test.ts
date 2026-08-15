/**
 * Immutable events writer — behavioural proof (LOG-02).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL events DAO, asserting the load-bearing writer contract:
 *   - recordEvent inserts EXACTLY ONE immutable events row with type/occurred_at/
 *     detail stored verbatim and recorded_at/modified_at both = `now`;
 *   - recordEventCore composes inside a caller-opened inWriteTransaction WITHOUT
 *     taking its own mutex (the non-mutexed composition primitive the archive/
 *     restore retrofit calls);
 *   - both an 'archive' and a 'restore' event persist with their type verbatim;
 *   - an omitted `detail` stores NULL.
 *
 * The DAO is INSERT-ONLY: events are "a record of what the app did" and are never
 * edited — there is no update/mutate path to test because none exists.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { recordEvent, recordEventCore } from "@/db/events-dao";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-15 12:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
});

/** Insert a bare contact so the events FK (contact_id) is satisfiable. */
async function seedContact(name = "Alex"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

type EventRow = {
  id: number;
  uid: string;
  contact_id: number;
  type: string;
  occurred_at: string;
  detail: string | null;
  recorded_at: string;
  modified_at: string;
};

async function allEvents(contactId: number): Promise<EventRow[]> {
  return exec.getAllAsync<EventRow>(
    "SELECT * FROM events WHERE contact_id = ? ORDER BY id",
    [contactId],
  );
}

describe("recordEvent — one immutable row, ?-bound, stamped now", () => {
  it("inserts exactly one row with type/occurred_at/detail verbatim and recorded_at=modified_at=now", async () => {
    const c = await seedContact();

    const id = await recordEvent(exec, {
      contactId: c,
      uid: "evt-uid-1",
      type: "archive",
      occurredAt: "2026-08-15 09:30:00",
      detail: "left the room",
      now: NOW,
    });

    const rows = await allEvents(c);
    expect(rows.length).toBe(1);
    expect(id).toBe(rows[0]?.id);
    expect(rows[0]).toMatchObject({
      uid: "evt-uid-1",
      contact_id: c,
      type: "archive",
      occurred_at: "2026-08-15 09:30:00",
      detail: "left the room",
      recorded_at: NOW,
      modified_at: NOW,
    });
  });

  it("stores detail NULL when detail is omitted", async () => {
    const c = await seedContact();

    await recordEvent(exec, {
      contactId: c,
      uid: uid(),
      type: "restore",
      occurredAt: NOW,
      now: NOW,
    });

    const rows = await allEvents(c);
    expect(rows.length).toBe(1);
    expect(rows[0]?.detail).toBeNull();
  });

  it("persists an 'archive' and a 'restore' event with their type verbatim", async () => {
    const c = await seedContact();

    await recordEvent(exec, {
      contactId: c,
      uid: uid(),
      type: "archive",
      occurredAt: "2026-08-15 09:00:00",
      now: NOW,
    });
    await recordEvent(exec, {
      contactId: c,
      uid: uid(),
      type: "restore",
      occurredAt: "2026-08-15 10:00:00",
      now: NOW,
    });

    const rows = await allEvents(c);
    expect(rows.map((r) => r.type)).toEqual(["archive", "restore"]);
  });
});

describe("recordEventCore — composes inside an open transaction, no own mutex", () => {
  it("inserts one row when called inside a caller-opened inWriteTransaction", async () => {
    const c = await seedContact();

    await inWriteTransaction(exec, async () => {
      await recordEventCore(exec, {
        contactId: c,
        uid: uid(),
        type: "archive",
        occurredAt: NOW,
        detail: null,
        now: NOW,
      });
    });

    const rows = await allEvents(c);
    expect(rows.length).toBe(1);
    expect(rows[0]?.type).toBe("archive");
  });
});
