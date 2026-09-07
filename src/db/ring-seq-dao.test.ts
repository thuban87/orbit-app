/**
 * Ring-seq write layer — behavioural proof (ORR-06).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL ring-seq-dao (+ orrery-read for the M3 re-read). rewriteRingSeq is
 * a near-verbatim clone of the retired favourites rank-rewrite writer; this suite mirrors the
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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openSqliteLocalDayFixture } from "@/db/__testkit__/sqlite-local-day";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { withMutex } from "@/db/mutex";
import { readOrrerySystemSnapshot } from "@/db/orrery-system-read";
import { commitRingReorder, type RingReorderRequest } from "@/db/ring-seq-dao";
import { parseSystemRef } from "@/logic/orrery-system-logic";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration003 } from "@/db/migrations/003-orrery-settings";
import { migration004 } from "@/db/migrations/004-ai-settings";
import { migration005 } from "@/db/migrations/005-digest-settings";
import { migration006 } from "@/db/migrations/006-normalize-custom-field-values";
import { migration007 } from "@/db/migrations/007-tombstones";
import { migration009 } from "@/db/migrations/009-contact-method-normalization";
import { migration010 } from "@/db/migrations/010-contact-method-label";
import { migration011 } from "@/db/migrations/011-contact-lifecycle-schema";
import { runMigrations } from "@/db/migrations/runner";
import { listOrbitingContacts } from "@/db/orrery-read";
import { rewriteRingSeq } from "@/db/ring-seq-dao";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-08-15 12:00:00";
const LATER = "2026-08-16 09:30:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;
let exec: SqlExecutor;
let baseDb: ReturnType<typeof openTestDb>;
afterEach(() => baseDb.close());

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  baseDb = db;
  exec = nodeSqliteExecutor(db);
  await runMigrations(
    exec,
    [
      migration001,
      migration002,
      migration003,
      migration004,
      migration005,
      migration006,
      migration007,
      migration009,
      migration010,
      migration011,
    ],
    11,
    { now: NOW, newUid: uid, defaultPhoneRegion: "US" },
  );
});

describe("locked filtered reorder", () => {
  let fixture: ReturnType<typeof openSqliteLocalDayFixture>;
  let sql: SqlExecutor;
  beforeEach(async () => {
    fixture = openSqliteLocalDayFixture("2026-09-07");
    sql = fixture.exec;
    await runMigrations(sql, MIGRATIONS, TARGET_VERSION, {
      now: NOW,
      newUid: uid,
      defaultPhoneRegion: "US",
    });
    for (let id = 1; id <= 5; id++)
      await sql.runAsync(
        `INSERT INTO contacts(id,uid,name,interval_days,last_contact,favourite_rank,ring_seq,created_at,modified_at)
        VALUES (?,?,?,10,'2026-08-01',?,?,?,?)`,
        [
          id,
          `person-${id}`,
          `Person ${id}`,
          id === 2 || id === 4 ? id : null,
          id - 1,
          NOW,
          NOW,
        ],
      );
  });
  afterEach(() => fixture.close());
  async function request(
    token = "builtin:favorites",
  ): Promise<RingReorderRequest> {
    const snapshot = await readOrrerySystemSnapshot(
      sql,
      parseSystemRef(token)!,
    );
    return {
      system: snapshot.system,
      expectedFullOrderedIds: snapshot.completeContactedOrder,
      expectedSavedSunContactId: snapshot.savedSunContactId,
      expectedEligibleVisibleIds: snapshot.eligibleContactedVisibleIds,
      expectedContactIdentities: snapshot.contactIdentities,
      reorderedVisibleIds: [...snapshot.eligibleContactedVisibleIds].reverse(),
    };
  }
  async function stored() {
    return {
      rows: await sql.getAllAsync("SELECT * FROM contacts ORDER BY id"),
      settings: await sql.getAllAsync("SELECT * FROM app_settings"),
    };
  }
  it("rolls back cancellation while queued or during scoped writes", async () => {
    const req = await request();
    const before = await stored();
    await expect(
      commitRingReorder(sql, req, LATER, () => false),
    ).rejects.toThrow(/Cancelled/);
    let live = true;
    const interrupted: SqlExecutor = {
      ...sql,
      runAsync: async (query, params) => {
        const result = await sql.runAsync(query, params);
        if (query.includes("SET ring_seq")) live = false;
        return result;
      },
    };
    await expect(
      commitRingReorder(interrupted, req, LATER, () => live),
    ).rejects.toThrow(/Cancelled/);
    expect(await stored()).toEqual(before);
  });
  it("preserves hidden slots and bumps revision once, while unchanged release writes nothing", async () => {
    const before = await stored();
    const req = await request();
    await commitRingReorder(
      sql,
      { ...req, reorderedVisibleIds: req.expectedEligibleVisibleIds },
      LATER,
    );
    expect(await stored()).toEqual(before);
    await commitRingReorder(sql, req, LATER);
    expect((await listOrbitingContacts(sql)).map((row) => row.id)).toEqual([
      1, 4, 3, 2, 5,
    ]);
    expect(
      await sql.getFirstAsync("SELECT data_revision FROM app_settings"),
    ).toEqual({ data_revision: 1 });
    expect(
      (
        await sql.getAllAsync<{ last_contact: string }>(
          "SELECT last_contact FROM contacts",
        )
      ).every((row) => row.last_contact === "2026-08-01"),
    ).toBe(true);
  });
  it.each([
    "UPDATE contacts SET favourite_rank=NULL WHERE id=2",
    "UPDATE contacts SET favourite_rank=1 WHERE id=3",
    "UPDATE contacts SET favourite_rank=CASE WHEN id=2 THEN NULL WHEN id=3 THEN 3 ELSE favourite_rank END",
    "UPDATE contacts SET ring_seq=-1 WHERE id=3",
    "UPDATE contacts SET archived_at='x' WHERE id=2",
    "UPDATE contacts SET tracking_enabled=0 WHERE id=2",
    "DELETE FROM contacts WHERE id=2",
    "UPDATE app_settings SET sun_contact_id=1",
  ])("rejects stale order/sun/population atomically: %s", async (mutation) => {
    const req = await request();
    await sql.runAsync(mutation);
    const before = await stored();
    await expect(commitRingReorder(sql, req, LATER)).rejects.toThrow();
    expect(await stored()).toEqual(before);
  });
  it.each([[2, 2], [2], [2, 3]])(
    "rejects duplicate/omitted/nonmember visible IDs %j",
    async (...ids) => {
      const req = await request();
      const before = await stored();
      await expect(
        commitRingReorder(sql, { ...req, reorderedVisibleIds: ids }, LATER),
      ).rejects.toThrow();
      expect(await stored()).toEqual(before);
    },
  );
  it("rejects numeric ID reuse with otherwise identical order/sun/membership", async () => {
    const req = await request();
    await sql.runAsync("DELETE FROM contacts WHERE id=5");
    await sql.runAsync(
      "INSERT INTO contacts(uid,name,interval_days,last_contact,ring_seq,created_at,modified_at) VALUES ('replacement','Replacement',10,'2026-08-01',4,?,?)",
      [NOW, NOW],
    );
    expect((await request()).expectedFullOrderedIds).toEqual(
      req.expectedFullOrderedIds,
    );
    const before = await stored();
    await expect(commitRingReorder(sql, req, LATER)).rejects.toThrow(
      /identities/,
    );
    expect(await stored()).toEqual(before);
  });
  it("fingerprints a neutral saved sun outside the complete contacted order", async () => {
    await sql.runAsync("UPDATE contacts SET last_contact=NULL WHERE id=5");
    await sql.runAsync("UPDATE app_settings SET sun_contact_id=5");
    const req = await request();
    await sql.runAsync("UPDATE contacts SET uid='other-sun' WHERE id=5");
    await expect(commitRingReorder(sql, req, LATER)).rejects.toThrow(
      /identities/,
    );
  });
  it("accepts category rename but rejects changed category membership", async () => {
    const category = await sql.getFirstAsync<{ id: number; uid: string }>(
      "SELECT id,uid FROM categories LIMIT 1",
    );
    await sql.runAsync("UPDATE contacts SET category_id=? WHERE id IN (2,4)", [
      category!.id,
    ]);
    const req = await request(`category:${category!.uid}`);
    await sql.runAsync("UPDATE categories SET name='Renamed' WHERE id=?", [
      category!.id,
    ]);
    await commitRingReorder(sql, req, LATER);
    const stale = await request(`category:${category!.uid}`);
    await sql.runAsync("UPDATE contacts SET category_id=NULL WHERE id=2");
    const before = await stored();
    await expect(commitRingReorder(sql, stale, LATER)).rejects.toThrow(
      /membership/,
    );
    expect(await stored()).toEqual(before);
  });
  it.each([
    [
      "chargers",
      "UPDATE contacts SET social_battery='Charger' WHERE id IN (2,4)",
      "UPDATE contacts SET social_battery='Drain' WHERE id=2",
    ],
    [
      "snoozed",
      "UPDATE contacts SET snooze_until='2026-09-09' WHERE id IN (2,4)",
      "UPDATE contacts SET snooze_until=NULL WHERE id=2",
    ],
    [
      "needs-attention",
      "UPDATE contacts SET last_contact='2026-09-01' WHERE id=3",
      "UPDATE contacts SET interval_days=1 WHERE id=3",
    ],
    [
      "needs-attention",
      "UPDATE contacts SET last_contact='2026-09-01' WHERE id=3",
      "UPDATE contacts SET last_contact='2026-08-01' WHERE id=3",
    ],
  ])("rechecks %s while queued", async (name, setup, mutation) => {
    await sql.runAsync(setup);
    const req = await request(`builtin:${name}`);
    let release!: () => void;
    const held = withMutex(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    await Promise.resolve();
    const pending = commitRingReorder(sql, req, LATER);
    await sql.runAsync(mutation);
    const before = await stored();
    release();
    await held;
    await expect(pending).rejects.toThrow(/membership/);
    expect(await stored()).toEqual(before);
  });
  it.each(["snoozed", "needs-attention"])(
    "rechecks %s at midnight without a write or revised request",
    async (name) => {
      await sql.runAsync(
        "UPDATE contacts SET snooze_until='2026-09-08' WHERE id=2",
      );
      if (name === "needs-attention")
        await sql.runAsync(
          "UPDATE contacts SET last_contact='2026-08-31' WHERE id=3",
        );
      const req = await request(`builtin:${name}`);
      const before = await stored();
      let release!: () => void;
      const held = withMutex(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      );
      await Promise.resolve();
      const queried: string[] = [];
      const observed: SqlExecutor = {
        ...sql,
        getAllAsync: async (query, params) => {
          if (query.includes("FROM contacts c WHERE"))
            queried.push(
              (await sql.getFirstAsync<{ day: string }>(
                "SELECT date('now','localtime') AS day",
              ))!.day,
            );
          return sql.getAllAsync(query, params);
        },
      };
      const pending = commitRingReorder(observed, req, LATER);
      expect(queried).toEqual([]);
      fixture.setLocalDay("2026-09-08");
      release();
      await held;
      await expect(pending).rejects.toThrow(/membership/);
      expect(queried).toEqual(["2026-09-08"]);
      expect(await stored()).toEqual(before);
    },
  );
  it("delegates stored dates/modifiers/NULL natively and changes only exact current local day", async () => {
    const native = openTestDb();
    try {
      for (const args of [
        ["2026-08-31"],
        ["2026-08-31", "+1 day"],
        [null],
        ["now"],
        ["now", "localtime", "+1 day"],
      ]) {
        const query = `SELECT date(${args.map(() => "?").join(",")}) AS day`;
        expect(await sql.getFirstAsync(query, args)).toEqual(
          native.prepare(query).get(...args),
        );
      }
      expect(
        await sql.getFirstAsync("SELECT date('now','localtime') AS day"),
      ).toEqual({ day: "2026-09-07" });
      expect(() => fixture.setLocalDay("2026-02-30")).toThrow();
      fixture.setLocalDay("2026-09-08");
      expect(
        await sql.getFirstAsync("SELECT date('now','localtime') AS day"),
      ).toEqual({ day: "2026-09-08" });
    } finally {
      native.close();
    }
  });
});

interface SeedOpts {
  name?: string;
  lastContact?: string | null;
  ringSeq?: number | null;
  archivedAt?: string | null;
  createdAt?: string;
  trackingEnabled?: number;
}

async function seedContact(o: SeedOpts = {}): Promise<number> {
  const created = o.createdAt ?? NOW;
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, last_contact, ring_seq, tracking_enabled,
        archived_at, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      o.name ?? "Alex",
      30,
      o.lastContact ?? null,
      o.ringSeq ?? null,
      o.trackingEnabled ?? 1,
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
  tracking_enabled: number;
}> {
  const row = await exec.getFirstAsync<{
    ring_seq: number | null;
    last_contact: string | null;
    modified_at: string;
    tracking_enabled: number;
  }>(
    "SELECT ring_seq, last_contact, modified_at, tracking_enabled FROM contacts WHERE id = ?",
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

  it("ignores a contacted Unbound contact in both guards and leaves its row untouched", async () => {
    const [a, b, c] = await seedThreeLive();
    const unbound = await seedContact({
      name: "Unbound",
      lastContact: NOW,
      ringSeq: 9,
      trackingEnabled: 0,
    });

    await rewriteRingSeq(exec, [c, a, b], LATER, null);

    expect((await readRow(c)).ring_seq).toBe(0);
    expect((await readRow(a)).ring_seq).toBe(1);
    expect((await readRow(b)).ring_seq).toBe(2);
    expect(await readRow(unbound)).toEqual({
      ring_seq: 9,
      last_contact: NOW,
      modified_at: NOW,
      tracking_enabled: 0,
    });
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
    await expect(
      rewriteRingSeq(exec, [], LATER, null),
    ).resolves.toBeUndefined();
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
