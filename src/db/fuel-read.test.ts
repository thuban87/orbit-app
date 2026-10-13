/**
 * Legacy editor read, now the Off Limits shim (Phase 38.10 plan 02):
 *   - listFuelForEditor reads `off_limits` in the old row shape (kind
 *     `off_limits`, source `user`), newest-first (created_at DESC, id DESC);
 *   - a second contact's rows are excluded (contact_id bound);
 *   - a contact with none returns [] (never throws).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { addFuel } from "@/db/fuel-dao";
import { listFuelForEditor } from "@/db/fuel-read";
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
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

async function seedContact(name = "Alex"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function addOffLimitsRow(
  contactId: number,
  text: string,
  createdAt: string,
  source = "user",
): Promise<number> {
  return addFuel(exec, {
    uid: uid(),
    contactId,
    kind: "off_limits",
    text,
    createdAt,
    source,
    now: NOW,
  });
}

describe("listFuelForEditor — Off Limits in the legacy row shape, newest-first, isolated", () => {
  it("returns this contact's Off Limits newest-first by created_at then id", async () => {
    const c = await seedContact();
    // Two rows share a created_at → the id DESC tiebreak decides their order.
    await addOffLimitsRow(c, "oldest", "2026-08-10 09:00:00");
    await addOffLimitsRow(c, "same-day A", "2026-08-12 09:00:00");
    const sameDayB = await addOffLimitsRow(
      c,
      "same-day B",
      "2026-08-12 09:00:00",
      "share",
    );
    await addOffLimitsRow(c, "newest", "2026-08-15 09:00:00");

    const rows = await listFuelForEditor(exec, c);
    expect(rows.map((r) => r.text)).toEqual([
      "newest",
      "same-day B",
      "same-day A",
      "oldest",
    ]);
    // Legacy shape: every row reads as kind off_limits, source user.
    expect(rows.every((r) => r.kind === "off_limits")).toBe(true);
    expect(rows.every((r) => r.source === "user")).toBe(true);
    expect(rows[1]).toEqual({
      id: sameDayB,
      contact_id: c,
      kind: "off_limits",
      label: null,
      text: "same-day B",
      url: null,
      created_at: "2026-08-12 09:00:00",
      source: "user",
    });
  });

  it("does not list memories the shim routed elsewhere", async () => {
    const c = await seedContact();
    await addFuel(exec, {
      uid: uid(),
      contactId: c,
      kind: "topic",
      text: "a thought",
      createdAt: NOW,
      source: "user",
      now: NOW,
    });
    expect(await listFuelForEditor(exec, c)).toEqual([]);
  });

  it("excludes another contact's rows (contact_id bound)", async () => {
    const c1 = await seedContact("Alex");
    const c2 = await seedContact("Blair");
    await addOffLimitsRow(c1, "mine", NOW);
    await addOffLimitsRow(c2, "theirs", NOW);

    const rows = await listFuelForEditor(exec, c1);
    expect(rows.length).toBe(1);
    expect(rows[0]?.text).toBe("mine");
  });

  it("returns [] for a contact with none (never throws)", async () => {
    const c = await seedContact();
    const rows = await listFuelForEditor(exec, c);
    expect(rows).toEqual([]);
  });
});
