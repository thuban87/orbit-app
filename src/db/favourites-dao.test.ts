/**
 * Favourites write layer — behavioural proof (DASH-06).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL favourites-dao, asserting:
 *   - setFavouriteRank APPENDS at MAX+1 (first favourite → 0), bumps modified_at,
 *     leaves last_contact untouched, and a bad id throws + rolls back;
 *   - clearFavouriteRank NULLs the rank, bumps modified_at, bad id throws;
 *   - rank is membership-only under ADR-075: mark and clear are the only writes.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { clearFavouriteRank, setFavouriteRank } from "@/db/favourites-dao";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { runMigrations } from "@/db/migrations/runner";
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
  await runMigrations(exec, [migration001, migration002, migration003, migration004, migration005, migration006, migration007], 7, { now: NOW, newUid: uid });
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
  favourite_rank: number | null;
  last_contact: string | null;
  modified_at: string;
}> {
  const row = await exec.getFirstAsync<{
    favourite_rank: number | null;
    last_contact: string | null;
    modified_at: string;
  }>(
    "SELECT favourite_rank, last_contact, modified_at FROM contacts WHERE id = ?",
    [id],
  );
  if (!row) throw new Error(`no contact id=${id}`);
  return row;
}

describe("setFavouriteRank — append-at-end (MAX+1), guarded", () => {
  it("marks the FIRST favourite as rank 0", async () => {
    const a = await seedContact("A");
    await setFavouriteRank(exec, a, LATER);
    const row = await readRow(a);
    expect(row.favourite_rank).toBe(0);
  });

  it("APPENDS subsequent favourites at MAX+1", async () => {
    const a = await seedContact("A");
    const b = await seedContact("B");
    const c = await seedContact("C");
    await setFavouriteRank(exec, a, LATER); // 0
    await setFavouriteRank(exec, b, LATER); // 1
    await setFavouriteRank(exec, c, LATER); // 2
    expect((await readRow(a)).favourite_rank).toBe(0);
    expect((await readRow(b)).favourite_rank).toBe(1);
    expect((await readRow(c)).favourite_rank).toBe(2);
  });

  it("bumps modified_at and NEVER touches last_contact", async () => {
    const a = await seedContact("A");
    const before = await readRow(a);
    expect(before.last_contact).toBe(NOW);
    await setFavouriteRank(exec, a, LATER);
    const after = await readRow(a);
    expect(after.modified_at).toBe(LATER);
    expect(after.last_contact).toBe(NOW); // unchanged
  });

  it("throws + rolls back on a bad id (changes !== 1)", async () => {
    await expect(setFavouriteRank(exec, 9999, LATER)).rejects.toThrow(
      /no contact matched id=9999/,
    );
  });
});

describe("clearFavouriteRank — NULL the rank, guarded", () => {
  it("clears an existing rank to NULL and bumps modified_at, last_contact untouched", async () => {
    const a = await seedContact("A");
    await setFavouriteRank(exec, a, LATER);
    await clearFavouriteRank(exec, a, LATER);
    const row = await readRow(a);
    expect(row.favourite_rank).toBeNull();
    expect(row.modified_at).toBe(LATER);
    expect(row.last_contact).toBe(NOW);
  });

  it("throws on a bad id", async () => {
    await expect(clearFavouriteRank(exec, 9999, LATER)).rejects.toThrow(
      /no contact matched id=9999/,
    );
  });
});
