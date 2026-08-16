/**
 * snooze-dao — behavioural proof (NOTIF-03).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL snooze-dao, asserting the dashboard-read SNOOZE STORAGE CONTRACT
 * (dashboard-read.ts:33-36) and the single-writer / immutable-events invariants:
 *   - snoozeContact writes snooze_until = local `date('now','localtime', <modifier>)`
 *     per preset (3d/1w/1m), bumps modified_at, and inserts ONE immutable "snooze"
 *     event — both in ONE transaction; last_contact is never touched;
 *   - a future snooze is "still snoozed": bare `date(snooze_until) <= date('now',
 *     'localtime')` is false;
 *   - clearSnooze NULLs snooze_until AND ALWAYS inserts one "unsnooze" event
 *     (review item 10) in the SAME transaction; last_contact untouched;
 *   - a bad contactId throws + rolls back with NOTHING written (neither the
 *     contacts UPDATE nor the event);
 *   - PRESET_MODIFIERS is the single top-of-file tunable for preset lengths.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import { clearSnooze, PRESET_MODIFIERS, snoozeContact } from "@/db/snooze-dao";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-15 12:00:00";
const LATER = "2026-08-16 09:30:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
});

async function seedContact(name = "Alex"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, last_contact, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function readRow(id: number): Promise<{
  snooze_until: string | null;
  last_contact: string | null;
  modified_at: string;
}> {
  const row = await exec.getFirstAsync<{
    snooze_until: string | null;
    last_contact: string | null;
    modified_at: string;
  }>(
    "SELECT snooze_until, last_contact, modified_at FROM contacts WHERE id = ?",
    [id],
  );
  if (!row) throw new Error(`no contact id=${id}`);
  return row;
}

async function eventsOf(
  id: number,
): Promise<{ type: string; occurred_at: string; detail: string | null }[]> {
  return exec.getAllAsync<{
    type: string;
    occurred_at: string;
    detail: string | null;
  }>(
    "SELECT type, occurred_at, detail FROM events WHERE contact_id = ? ORDER BY id ASC",
    [id],
  );
}

/** The DB's own local date with a modifier — the value the DAO must produce. */
async function localDate(modifier: string): Promise<string> {
  const row = await exec.getFirstAsync<{ d: string }>(
    "SELECT date('now','localtime', ?) AS d",
    [modifier],
  );
  if (!row) throw new Error("no date");
  return row.d;
}

describe("PRESET_MODIFIERS — the single top-of-file preset tunable", () => {
  it("maps 3d/1w/1m to the SQLite date modifiers", () => {
    expect(PRESET_MODIFIERS).toEqual({
      "3d": "+3 days",
      "1w": "+7 days",
      "1m": "+1 month",
    });
  });
});

describe("snoozeContact — set snooze_until (local date) + immutable snooze event", () => {
  it("writes snooze_until = local date('now','localtime','+7 days') for the 1w preset", async () => {
    const a = await seedContact();
    await snoozeContact(exec, { contactId: a, uid: uid(), preset: "1w", now: LATER });
    const row = await readRow(a);
    expect(row.snooze_until).toBe(await localDate("+7 days"));
  });

  it("honours the 3d and 1m presets", async () => {
    const a = await seedContact("A");
    const b = await seedContact("B");
    await snoozeContact(exec, { contactId: a, uid: uid(), preset: "3d", now: LATER });
    await snoozeContact(exec, { contactId: b, uid: uid(), preset: "1m", now: LATER });
    expect((await readRow(a)).snooze_until).toBe(await localDate("+3 days"));
    expect((await readRow(b)).snooze_until).toBe(await localDate("+1 month"));
  });

  it("a future snooze reads as STILL snoozed under the bare date() dashboard contract", async () => {
    const a = await seedContact();
    await snoozeContact(exec, { contactId: a, uid: uid(), preset: "1w", now: LATER });
    const row = await exec.getFirstAsync<{ expired: number }>(
      `SELECT (date(snooze_until) <= date('now','localtime')) AS expired
         FROM contacts WHERE id = ?`,
      [a],
    );
    expect(row?.expired).toBe(0); // future date → NOT expired → still snoozed
  });

  it("inserts exactly ONE immutable 'snooze' event, bumps modified_at, and NEVER touches last_contact", async () => {
    const a = await seedContact();
    const before = await readRow(a);
    expect(before.last_contact).toBe(NOW);
    await snoozeContact(exec, { contactId: a, uid: uid(), preset: "1w", now: LATER });
    const after = await readRow(a);
    expect(after.modified_at).toBe(LATER);
    expect(after.last_contact).toBe(NOW); // unchanged — recency-dao stays sole writer
    const events = await eventsOf(a);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("snooze");
    expect(events[0].occurred_at).toBe(LATER);
    expect(events[0].detail).toBeNull();
  });

  it("throws + rolls back on a bad id, writing NEITHER the update NOR the event", async () => {
    await expect(
      snoozeContact(exec, { contactId: 9999, uid: uid(), preset: "1w", now: LATER }),
    ).rejects.toThrow(/no contact matched id=9999/);
    const orphanEvents = await exec.getAllAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM events",
    );
    expect(orphanEvents[0].n).toBe(0);
  });
});

describe("clearSnooze — NULL snooze_until + ALWAYS an unsnooze event (item 10)", () => {
  it("clears to NULL and ALWAYS writes exactly one unsnooze event, last_contact untouched", async () => {
    const a = await seedContact();
    await snoozeContact(exec, { contactId: a, uid: uid(), preset: "1m", now: NOW });
    await clearSnooze(exec, { contactId: a, uid: uid(), now: LATER });
    const row = await readRow(a);
    expect(row.snooze_until).toBeNull();
    expect(row.modified_at).toBe(LATER);
    expect(row.last_contact).toBe(NOW);
    const events = await eventsOf(a);
    expect(events.map((e) => e.type)).toEqual(["snooze", "unsnooze"]);
    const unsnooze = events.filter((e) => e.type === "unsnooze");
    expect(unsnooze).toHaveLength(1);
    expect(unsnooze[0].occurred_at).toBe(LATER);
    expect(unsnooze[0].detail).toBeNull();
  });

  it("writes an unsnooze event even when the contact was never snoozed (audit trail stays consistent)", async () => {
    const a = await seedContact();
    await clearSnooze(exec, { contactId: a, uid: uid(), now: LATER });
    const events = await eventsOf(a);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("unsnooze");
    expect((await readRow(a)).snooze_until).toBeNull();
  });

  it("throws + rolls back on a bad id, writing no unsnooze event", async () => {
    await expect(
      clearSnooze(exec, { contactId: 9999, uid: uid(), now: LATER }),
    ).rejects.toThrow(/no contact matched id=9999/);
    const events = await exec.getAllAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM events",
    );
    expect(events[0].n).toBe(0);
  });
});
