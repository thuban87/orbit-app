/**
 * Sun-picker candidate list — behavioural proof (ORR-06).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL sun-picker-read module. Locks:
 *   - archived contacts excluded (an archived favourite is absent);
 *   - favourites (favourite_rank IS NOT NULL) come first by rank, then everyone
 *     else by name COLLATE NOCASE;
 *   - never-contacted contacts ARE included (anyone can be the sun);
 *   - only real contacts — no synthetic "Me" row.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import { listSunCandidates, type SunCandidate } from "@/db/sun-picker-read";
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

interface SeedOpts {
  name?: string;
  lastContact?: string | null;
  photo?: string | null;
  favouriteRank?: number | null;
  archivedAt?: string | null;
}

async function seedContact(o: SeedOpts = {}): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, last_contact, photo, favourite_rank,
        archived_at, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      o.name ?? "Alex",
      30,
      o.lastContact ?? null,
      o.photo ?? null,
      o.favouriteRank ?? null,
      o.archivedAt ?? null,
      NOW,
      NOW,
    ],
  );
  return result.lastInsertRowId;
}

const ids = (rows: { id: number }[]) => rows.map((r) => r.id);

describe("listSunCandidates", () => {
  it("excludes archived contacts (even an archived favourite)", async () => {
    const live = await seedContact({ name: "Live", lastContact: NOW });
    await seedContact({
      name: "ArchivedFav",
      favouriteRank: 0,
      archivedAt: NOW,
    });
    const rows = await listSunCandidates(exec);
    expect(ids(rows)).toEqual([live]);
  });

  it("orders favourites first by rank, then everyone else by name (NOCASE)", async () => {
    const favB = await seedContact({ name: "FavB", favouriteRank: 1 });
    const favA = await seedContact({ name: "FavA", favouriteRank: 0 });
    const zoe = await seedContact({ name: "zoe", lastContact: NOW });
    const amy = await seedContact({ name: "Amy", lastContact: NOW });
    const rows = await listSunCandidates(exec);
    // favourites by rank (favA rank0, favB rank1), then non-favourites by name.
    expect(ids(rows)).toEqual([favA, favB, amy, zoe]);
  });

  it("includes never-contacted contacts (anyone can be the sun)", async () => {
    const never = await seedContact({ name: "Never", lastContact: null });
    const rows = await listSunCandidates(exec);
    expect(ids(rows)).toContain(never);
  });

  it("carries id, name, photo for each row", async () => {
    const c = await seedContact({
      name: "Pic",
      lastContact: NOW,
      photo: "p.jpg",
    });
    const rows = await listSunCandidates(exec);
    const row = rows.find((r) => r.id === c) as SunCandidate;
    expect(row.name).toBe("Pic");
    expect(row.photo).toBe("p.jpg");
  });

  it("returns only real contacts — no synthetic 'Me' row", async () => {
    await seedContact({ name: "Only", lastContact: NOW });
    const rows = await listSunCandidates(exec);
    expect(rows.length).toBe(1);
    expect(rows.every((r) => typeof r.id === "number")).toBe(true);
  });
});
