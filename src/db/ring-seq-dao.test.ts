/**
 * Ring-seq write layer — behavioural proof (ORR-06).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL ring-seq-dao (+ orrery-read for the M3 re-read). rewriteRingSeq is
 * a near-verbatim clone of rewriteFavouriteRanks; this suite mirrors the
 * favourites guard-test shape AND adds the sun-occupant seam:
 *   - happy self-sun path writes ring_seq 0..n-1, bumps modified_at, leaves
 *     last_contact untouched;
 *   - Guard 1 (unique) / Guard 2 (count-match) / Guard 3 (scoped stale-id) each
 *     throw + roll the WHOLE batch back;
 *   - empty list is an accepted no-op;
 *   - contact-sun: excludeContactId set → reorder the remaining N−1 succeeds
 *     (dense ring_seq 0..N−2); passing the full-N list with excludeContactId set
 *     still FAILS Guard 2; the self-sun (null) path reorders the full set;
 *   - M3 regression: contact-sun → reorder N−1 → self-sun → listOrbitingContacts
 *     returns the intended dense/deterministic id order (a stale stored ring_seq
 *     on the formerly-hidden sun is harmless — rank is the read-time row index).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import { listOrbitingContacts } from "@/db/orrery-read";
import { rewriteRingSeq } from "@/db/ring-seq-dao";
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

interface SeedOpts {
  name?: string;
  lastContact?: string | null;
  ringSeq?: number | null;
  archivedAt?: string | null;
  createdAt?: string;
}

async function seedContact(o: SeedOpts = {}): Promise<number> {
  const created = o.createdAt ?? NOW;
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, last_contact, ring_seq, archived_at,
        created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      o.name ?? "Alex",
      30,
      o.lastContact ?? null,
      o.ringSeq ?? null,
      o.archivedAt ?? null,
      created,
      created,
    ],
  );
  return result.lastInsertRowId;
}

async function readRow(id: number): Promise<{
  ring_seq: number | null;
  last_contact: string | null;
  modified_at: string;
}> {
  const row = await exec.getFirstAsync<{
    ring_seq: number | null;
    last_contact: string | null;
    modified_at: string;
  }>(
    "SELECT ring_seq, last_contact, modified_at FROM contacts WHERE id = ?",
    [id],
  );
  if (!row) throw new Error(`no contact id=${id}`);
  return row;
}

/** Three live contacted contacts created a..c in id/created order. */
async function seedThreeLive(): Promise<[number, number, number]> {
  const a = await seedContact({
    name: "A",
    lastContact: NOW,
    createdAt: "2026-01-01 09:00:00",
  });
  const b = await seedContact({
    name: "B",
    lastContact: NOW,
    createdAt: "2026-02-01 09:00:00",
  });
  const c = await seedContact({
    name: "C",
    lastContact: NOW,
    createdAt: "2026-03-01 09:00:00",
  });
  return [a, b, c];
}

describe("rewriteRingSeq — self-sun happy path (excludeContactId null)", () => {
  it("writes ring_seq 0..n-1 in order; a re-read reflects the new order", async () => {
    const [a, b, c] = await seedThreeLive();
    await rewriteRingSeq(exec, [c, a, b], LATER, null);
    expect((await readRow(c)).ring_seq).toBe(0);
    expect((await readRow(a)).ring_seq).toBe(1);
    expect((await readRow(b)).ring_seq).toBe(2);

    const rows = await listOrbitingContacts(exec);
    expect(rows.map((r) => r.id)).toEqual([c, a, b]);
  });

  it("bumps modified_at on each row and NEVER touches last_contact", async () => {
    const [a, b, c] = await seedThreeLive();
    await rewriteRingSeq(exec, [c, b, a], LATER, null);
    for (const id of [a, b, c]) {
      const row = await readRow(id);
      expect(row.modified_at).toBe(LATER);
      expect(row.last_contact).toBe(NOW);
    }
  });
});

describe("rewriteRingSeq — three guards (self-sun)", () => {
  it("Guard 1: a DUPLICATE id throws + rolls back with no change", async () => {
    const [a, b, c] = await seedThreeLive();
    await rewriteRingSeq(exec, [a, b, c], NOW, null); // seed ring_seq 0,1,2
    await expect(rewriteRingSeq(exec, [a, a, b], LATER, null)).rejects.toThrow(
      /duplicate ids/,
    );
    expect((await readRow(a)).ring_seq).toBe(0);
    expect((await readRow(b)).ring_seq).toBe(1);
    expect((await readRow(c)).ring_seq).toBe(2);
  });

  it("Guard 2: a PARTIAL list throws + rolls back", async () => {
    const [a, b, c] = await seedThreeLive();
    await rewriteRingSeq(exec, [a, b, c], NOW, null);
    await expect(rewriteRingSeq(exec, [c, a], LATER, null)).rejects.toThrow(
      /!= effective orbiting count 3/,
    );
    expect((await readRow(a)).ring_seq).toBe(0);
    expect((await readRow(b)).ring_seq).toBe(1);
    expect((await readRow(c)).ring_seq).toBe(2);
  });

  it("Guard 2: an OVER-LONG list throws + rolls back", async () => {
    const [a, b, c] = await seedThreeLive();
    const d = await seedContact({ name: "D", lastContact: NOW }); // also orbiting
    // effective count is now 4; a length-5 list over-runs it.
    await expect(
      rewriteRingSeq(exec, [a, b, c, d, a], LATER, null),
    ).rejects.toThrow(/duplicate ids/); // caught by guard 1 first
    // A clean over-long (unique) list:
    const e = await seedContact({ name: "E", lastContact: NOW }); // count now 5
    await expect(
      rewriteRingSeq(exec, [a, b, c, d, e, a], LATER, null),
    ).rejects.toThrow(/duplicate ids/);
  });

  it("Guard 3: a STALE id (archived) throws + rolls back, leaving no ring_seq changed", async () => {
    const a = await seedContact({ name: "A", lastContact: NOW, ringSeq: 0 });
    const b = await seedContact({ name: "B", lastContact: NOW, ringSeq: 1 });
    const archived = await seedContact({
      name: "Archie",
      lastContact: NOW,
      ringSeq: 9,
      archivedAt: NOW,
    });
    // effective orbiting count is 2 (archived excluded). A length-2 list that
    // includes the archived id passes Guard 2 but fails the scoped UPDATE.
    await expect(
      rewriteRingSeq(exec, [a, archived], LATER, null),
    ).rejects.toThrow(/is not a live orbiting contact/);
    expect((await readRow(a)).ring_seq).toBe(0);
    expect((await readRow(b)).ring_seq).toBe(1);
    expect((await readRow(archived)).ring_seq).toBe(9);
  });

  it("Guard 3: a STALE id (never-contacted) throws + rolls back", async () => {
    const a = await seedContact({ name: "A", lastContact: NOW, ringSeq: 0 });
    const b = await seedContact({ name: "B", lastContact: NOW, ringSeq: 1 });
    const never = await seedContact({ name: "Never", lastContact: null });
    await expect(rewriteRingSeq(exec, [a, never], LATER, null)).rejects.toThrow(
      /is not a live orbiting contact/,
    );
    expect((await readRow(a)).ring_seq).toBe(0);
    expect((await readRow(b)).ring_seq).toBe(1);
    expect((await readRow(never)).ring_seq).toBeNull();
  });

  it("an EMPTY list is an accepted no-op when there are no orbiting contacts", async () => {
    await seedContact({ name: "Never", lastContact: null }); // not orbiting
    await expect(rewriteRingSeq(exec, [], LATER, null)).resolves.toBeUndefined();
  });

  it("an EMPTY list throws when orbiting contacts still exist (count mismatch)", async () => {
    await seedThreeLive();
    await expect(rewriteRingSeq(exec, [], LATER, null)).rejects.toThrow(
      /!= effective orbiting count 3/,
    );
  });
});

describe("rewriteRingSeq — contact-sun seam (excludeContactId set)", () => {
  it("reorders the remaining N−1 when one contact is the sun (dense 0..N−2)", async () => {
    const [a, b, c] = await seedThreeLive();
    // a is the sun. Visible orbiting set is {b, c}; reorder to [c, b].
    await rewriteRingSeq(exec, [c, b], LATER, a);
    expect((await readRow(c)).ring_seq).toBe(0);
    expect((await readRow(b)).ring_seq).toBe(1);
    // The sun keeps its OLD ring_seq (untouched by this write).
    expect((await readRow(a)).ring_seq).toBeNull();

    const rows = await listOrbitingContacts(exec, { excludeContactId: a });
    expect(rows.map((r) => r.id)).toEqual([c, b]);
  });

  it("passing the FULL N-length list with excludeContactId set still FAILS Guard 2", async () => {
    const [a, b, c] = await seedThreeLive();
    // effective count with a excluded is 2, but the caller wrongly passes N=3.
    await expect(rewriteRingSeq(exec, [a, b, c], LATER, a)).rejects.toThrow(
      /!= effective orbiting count 2/,
    );
    // Nothing written.
    expect((await readRow(a)).ring_seq).toBeNull();
    expect((await readRow(b)).ring_seq).toBeNull();
    expect((await readRow(c)).ring_seq).toBeNull();
  });

  it("Guard 3 with excludeContactId set: passing the SUN id in the list fails the scoped UPDATE", async () => {
    const [a, b, c] = await seedThreeLive();
    // a is the sun; a length-2 list [a, b] matches the effective count (2) but a
    // is excluded by the scoped `id <> ?` term → changes===0 → throw + rollback.
    await expect(rewriteRingSeq(exec, [a, b], LATER, a)).rejects.toThrow(
      /is not a live orbiting contact/,
    );
    expect((await readRow(b)).ring_seq).toBeNull();
    expect((await readRow(c)).ring_seq).toBeNull();
  });

  it("M3 regression: contact-sun → reorder N−1 → self-sun re-read is dense/deterministic", async () => {
    const [a, b, c] = await seedThreeLive();
    // 1. Self-sun baseline order [a, b, c] → ring_seq 0,1,2.
    await rewriteRingSeq(exec, [a, b, c], NOW, null);
    // 2. a becomes the sun; reorder the visible {b, c} to [c, b] → c=0, b=1.
    //    a keeps its stale ring_seq 0 (now duplicating c's 0).
    await rewriteRingSeq(exec, [c, b], LATER, a);
    expect((await readRow(a)).ring_seq).toBe(0); // stale, unchanged
    expect((await readRow(c)).ring_seq).toBe(0);
    expect((await readRow(b)).ring_seq).toBe(1);
    // 3. Return to self-sun and re-read the FULL sky (no exclusion).
    const rows = await listOrbitingContacts(exec);
    // Dense read-time rank: ring_seq 0 → {a, c} broken by created_at (a earlier),
    // then ring_seq 1 → b. Deterministic order [a, c, b]; the N−1 keep their
    // reordered relative order (c before b) and the formerly-hidden sun slots in
    // by its stored ring_seq then created_at. The stale duplicate is harmless.
    expect(rows.map((r) => r.id)).toEqual([a, c, b]);
  });
});
