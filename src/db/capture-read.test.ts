/**
 * Capture picker read — behavioural proof (CAP-01).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL `listCapturePickContacts` read, asserting the picker ordering
 * contract (mirrors fuel-dao.test.ts / dashboard-read idioms):
 *   - favourites (favourite_rank NOT NULL) sort before recently-captured non-favs;
 *   - among non-favourites, capture-MRU DESC (more-recent fuel.created_at first),
 *     never-captured last;
 *   - a never-contacted contact (last_contact NULL) is INCLUDED;
 *   - an archived contact (archived_at NOT NULL) is EXCLUDED;
 *   - ties inside a band break by name COLLATE NOCASE ASC;
 *   - each row carries id, name, photo, modified_at, favourite_rank, last_captured.
 * The MRU is derived from the EXISTING fuel.created_at column — no new migration,
 * column, or index.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { listCapturePickContacts } from "@/db/capture-read";
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

/** Insert a contact with optional favourite_rank / archived_at / photo. */
async function seedContact(opts: {
  name: string;
  favouriteRank?: number | null;
  archivedAt?: string | null;
  photo?: string | null;
  lastContact?: string | null;
}): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, favourite_rank, archived_at, photo,
        last_contact, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      opts.name,
      30,
      opts.favouriteRank ?? null,
      opts.archivedAt ?? null,
      opts.photo ?? null,
      opts.lastContact ?? null,
      NOW,
      NOW,
    ],
  );
  return result.lastInsertRowId;
}

/** Insert one fuel row so the contact registers as captured-to at `createdAt`. */
async function seedFuel(contactId: number, createdAt: string): Promise<void> {
  await exec.runAsync(
    `INSERT INTO fuel
       (uid, contact_id, kind, created_at, source, modified_at)
     VALUES (?, ?, 'topic', ?, 'share', ?)`,
    [uid(), contactId, createdAt, createdAt],
  );
}

describe("listCapturePickContacts — favourites → capture-MRU → rest", () => {
  it("orders favourites (by rank) before every non-favourite", async () => {
    const fav2 = await seedContact({ name: "Fav Two", favouriteRank: 2 });
    const fav1 = await seedContact({ name: "Fav One", favouriteRank: 1 });
    const recent = await seedContact({ name: "Recent Capture" });
    await seedFuel(recent, "2026-08-14 10:00:00");

    const rows = await listCapturePickContacts(exec);
    expect(rows.map((r) => r.id)).toEqual([fav1, fav2, recent]);
  });

  it("orders non-favourites by capture-MRU DESC, never-captured last (name tiebreak)", async () => {
    const older = await seedContact({ name: "Older" });
    await seedFuel(older, "2026-08-10 09:00:00");
    const newer = await seedContact({ name: "Newer" });
    await seedFuel(newer, "2026-08-14 18:00:00");
    // Two never-captured contacts to prove the name COLLATE NOCASE tiebreak.
    const beta = await seedContact({ name: "beta" });
    const alpha = await seedContact({ name: "Alpha" });

    const rows = await listCapturePickContacts(exec);
    expect(rows.map((r) => r.id)).toEqual([newer, older, alpha, beta]);
  });

  it("INCLUDES a never-contacted contact (last_contact NULL)", async () => {
    const never = await seedContact({ name: "Never", lastContact: null });

    const rows = await listCapturePickContacts(exec);
    expect(rows.map((r) => r.id)).toContain(never);
  });

  it("EXCLUDES an archived contact", async () => {
    const live = await seedContact({ name: "Live" });
    const archived = await seedContact({
      name: "Archived",
      archivedAt: "2026-08-01 00:00:00",
    });

    const rows = await listCapturePickContacts(exec);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain(live);
    expect(ids).not.toContain(archived);
  });

  it("carries id, name, photo, modified_at, favourite_rank, last_captured on each row", async () => {
    const c = await seedContact({
      name: "Full Row",
      favouriteRank: 1,
      photo: "photo.jpg",
    });
    await seedFuel(c, "2026-08-12 08:00:00");

    const rows = await listCapturePickContacts(exec);
    expect(rows[0]).toMatchObject({
      id: c,
      name: "Full Row",
      photo: "photo.jpg",
      modified_at: NOW,
      favourite_rank: 1,
      last_captured: "2026-08-12 08:00:00",
    });
  });

  it("reports last_captured NULL for a never-captured contact", async () => {
    await seedContact({ name: "Uncaptured" });

    const rows = await listCapturePickContacts(exec);
    expect(rows[0]?.last_captured).toBeNull();
  });
});
