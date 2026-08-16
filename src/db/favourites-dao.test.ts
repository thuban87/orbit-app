/**
 * Favourites write layer — behavioural proof (DASH-06).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL favourites-dao, asserting:
 *   - setFavouriteRank APPENDS at MAX+1 (first favourite → 0), bumps modified_at,
 *     leaves last_contact untouched, and a bad id throws + rolls back;
 *   - clearFavouriteRank NULLs the rank, bumps modified_at, bad id throws;
 *   - rewriteFavouriteRanks writes 0..n-1 in ONE transaction (favourite_rank ASC
 *     read-back proves the order) and enforces the MEDIUM-2 guards: a PARTIAL,
 *     DUPLICATE, or STALE list throws + rolls back with NO rank change persisted
 *     and NO non-favourite / archived row ranked;
 *   - an empty list is an accepted no-op.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  clearFavouriteRank,
  rewriteFavouriteRanks,
  setFavouriteRank,
} from "@/db/favourites-dao";
import { migration001 } from "@/db/migrations/001-initial";
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

async function seedArchivedFavourite(name = "Archie"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, favourite_rank, archived_at, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uid(), name, 30, 0, NOW, NOW, NOW],
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

describe("rewriteFavouriteRanks — transactional 0..n-1, MEDIUM-2 guards", () => {
  async function seedThreeFavourites(): Promise<[number, number, number]> {
    const a = await seedContact("A");
    const b = await seedContact("B");
    const c = await seedContact("C");
    await setFavouriteRank(exec, a, NOW); // 0
    await setFavouriteRank(exec, b, NOW); // 1
    await setFavouriteRank(exec, c, NOW); // 2
    return [a, b, c];
  }

  it("writes rank 0..n-1 in order; favourite_rank ASC read-back yields the new order", async () => {
    const [a, b, c] = await seedThreeFavourites();
    // Reorder to c, a, b.
    await rewriteFavouriteRanks(exec, [c, a, b], LATER);
    expect((await readRow(c)).favourite_rank).toBe(0);
    expect((await readRow(a)).favourite_rank).toBe(1);
    expect((await readRow(b)).favourite_rank).toBe(2);

    const ordered = await exec.getAllAsync<{ id: number }>(
      "SELECT id FROM contacts WHERE favourite_rank IS NOT NULL AND archived_at IS NULL ORDER BY favourite_rank ASC",
    );
    expect(ordered.map((r) => r.id)).toEqual([c, a, b]);
  });

  it("bumps modified_at on each reordered row and never touches last_contact", async () => {
    const [a, b, c] = await seedThreeFavourites();
    await rewriteFavouriteRanks(exec, [c, b, a], LATER);
    for (const id of [a, b, c]) {
      const row = await readRow(id);
      expect(row.modified_at).toBe(LATER);
      expect(row.last_contact).toBe(NOW);
    }
  });

  it("PARTIAL list (fewer ids than current favourites) throws + rolls back", async () => {
    const [a, b, c] = await seedThreeFavourites();
    await expect(rewriteFavouriteRanks(exec, [c, a], LATER)).rejects.toThrow(
      /length 2 != current live-favourite count 3/,
    );
    // No rank change persisted — original 0,1,2 intact.
    expect((await readRow(a)).favourite_rank).toBe(0);
    expect((await readRow(b)).favourite_rank).toBe(1);
    expect((await readRow(c)).favourite_rank).toBe(2);
  });

  it("OVER-LONG list throws + rolls back", async () => {
    const [a, b, c] = await seedThreeFavourites();
    const d = await seedContact("D"); // not a favourite
    await expect(
      rewriteFavouriteRanks(exec, [c, b, a, d], LATER),
    ).rejects.toThrow(/length 4 != current live-favourite count 3/);
    expect((await readRow(d)).favourite_rank).toBeNull();
  });

  it("DUPLICATE id throws + rolls back with no change", async () => {
    const [a, b, c] = await seedThreeFavourites();
    await expect(rewriteFavouriteRanks(exec, [a, a, b], LATER)).rejects.toThrow(
      /duplicate ids/,
    );
    // Note: [a,a,b] has length 3 == count 3, so the uniqueness guard (guard 1)
    // is what must catch it BEFORE the count check.
    expect((await readRow(a)).favourite_rank).toBe(0);
    expect((await readRow(b)).favourite_rank).toBe(1);
    expect((await readRow(c)).favourite_rank).toBe(2);
  });

  it("STALE id (an archived favourite) throws + rolls back, leaving no rank changed", async () => {
    const a = await seedContact("A");
    const b = await seedContact("B");
    await setFavouriteRank(exec, a, NOW); // 0
    await setFavouriteRank(exec, b, NOW); // 1
    const archived = await seedArchivedFavourite("Archie"); // favourite_rank 0 but archived
    // Live favourite count is 2 (archived excluded). Supply a length-2 list that
    // includes the archived id — count guard passes (2 === 2) but the scoped
    // UPDATE can't match the archived row → changes===0 → throw + rollback.
    await expect(
      rewriteFavouriteRanks(exec, [a, archived], LATER),
    ).rejects.toThrow(/is not a live favourite/);
    // Original live ranks intact; the archived row was never re-ranked.
    expect((await readRow(a)).favourite_rank).toBe(0);
    expect((await readRow(b)).favourite_rank).toBe(1);
    expect((await readRow(archived)).favourite_rank).toBe(0);
  });

  it("STALE id (a never-favourite live contact) throws + rolls back", async () => {
    const a = await seedContact("A");
    const b = await seedContact("B");
    await setFavouriteRank(exec, a, NOW); // 0
    await setFavouriteRank(exec, b, NOW); // 1
    const notFav = await seedContact("NotFav"); // favourite_rank NULL
    // Count is 2; supply [a, notFav] — length matches but notFav fails the scoped
    // UPDATE (favourite_rank IS NOT NULL) → changes===0 → throw.
    await expect(
      rewriteFavouriteRanks(exec, [a, notFav], LATER),
    ).rejects.toThrow(/is not a live favourite/);
    expect((await readRow(a)).favourite_rank).toBe(0);
    expect((await readRow(b)).favourite_rank).toBe(1);
    expect((await readRow(notFav)).favourite_rank).toBeNull();
  });

  it("an EMPTY list is an accepted no-op when there are no live favourites", async () => {
    await seedContact("A"); // not a favourite
    await expect(
      rewriteFavouriteRanks(exec, [], LATER),
    ).resolves.toBeUndefined();
  });

  it("an EMPTY list throws when live favourites still exist (count mismatch)", async () => {
    await seedThreeFavourites();
    await expect(rewriteFavouriteRanks(exec, [], LATER)).rejects.toThrow(
      /length 0 != current live-favourite count 3/,
    );
  });
});
