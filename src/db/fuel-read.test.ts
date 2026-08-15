/**
 * Conversational-fuel editor read — behavioural proof (FUEL-01/FUEL-02).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL fuel-read module, asserting the choke-point read contract:
 *   - listFuelForEditor returns ALL of a contact's fuel — every kind INCLUDING
 *     off_limits, every source INCLUDING 'ai' — newest-first (created_at DESC,
 *     id DESC), because this is the ONE read you edit off_limits through;
 *   - a second contact's rows are excluded (contact_id bound);
 *   - a contact with no fuel returns [] (never throws).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { addFuel } from "@/db/fuel-dao";
import { listFuelForEditor } from "@/db/fuel-read";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
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

async function seedContact(name = "Alex"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

describe("listFuelForEditor — all kinds incl off_limits, newest-first, isolated", () => {
  it("returns all 5 kinds (off_limits present) newest-first by created_at then id", async () => {
    const c = await seedContact();
    // Two rows share a created_at → the id DESC tiebreak decides their order.
    await addFuel(exec, {
      uid: uid(),
      contactId: c,
      kind: "recent",
      text: "oldest",
      createdAt: "2026-08-10 09:00:00",
      source: "user",
      now: NOW,
    });
    await addFuel(exec, {
      uid: uid(),
      contactId: c,
      kind: "topic",
      text: "same-day A",
      createdAt: "2026-08-12 09:00:00",
      source: "user",
      now: NOW,
    });
    await addFuel(exec, {
      uid: uid(),
      contactId: c,
      kind: "fact",
      text: "same-day B",
      createdAt: "2026-08-12 09:00:00",
      source: "ai",
      now: NOW,
    });
    await addFuel(exec, {
      uid: uid(),
      contactId: c,
      kind: "gift",
      text: "newer",
      createdAt: "2026-08-14 09:00:00",
      source: "user",
      now: NOW,
    });
    await addFuel(exec, {
      uid: uid(),
      contactId: c,
      kind: "off_limits",
      text: "private",
      createdAt: "2026-08-15 09:00:00",
      source: "user",
      now: NOW,
    });

    const rows = await listFuelForEditor(exec, c);

    // off_limits is surfaced here (the ONLY read that includes it).
    expect(rows.map((r) => r.kind)).toContain("off_limits");
    expect(rows.length).toBe(5);
    // Newest-first by created_at, then id DESC for the same-day tie
    // (fact was inserted after topic → higher id → comes first).
    expect(rows.map((r) => r.text)).toEqual([
      "private",
      "newer",
      "same-day B",
      "same-day A",
      "oldest",
    ]);
    // 'ai'-sourced rows are included in the editor read.
    expect(rows.some((r) => r.source === "ai")).toBe(true);
  });

  it("excludes another contact's rows (contact_id bound)", async () => {
    const c1 = await seedContact("Alex");
    const c2 = await seedContact("Blair");
    await addFuel(exec, {
      uid: uid(),
      contactId: c1,
      kind: "topic",
      text: "mine",
      createdAt: NOW,
      source: "user",
      now: NOW,
    });
    await addFuel(exec, {
      uid: uid(),
      contactId: c2,
      kind: "topic",
      text: "theirs",
      createdAt: NOW,
      source: "user",
      now: NOW,
    });

    const rows = await listFuelForEditor(exec, c1);
    expect(rows.length).toBe(1);
    expect(rows[0]?.text).toBe("mine");
  });

  it("returns [] for a contact with no fuel (never throws)", async () => {
    const c = await seedContact();
    const rows = await listFuelForEditor(exec, c);
    expect(rows).toEqual([]);
  });
});
