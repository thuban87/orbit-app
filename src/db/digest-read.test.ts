/**
 * Digest read chokepoint — behavioural proof (DGST-02 / DGST-03).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * (which creates `contacts` + `interactions` — the only tables these reads
 * touch; migrations 002-004 add app_settings columns the digest reads never
 * read) and the REAL digest-read module. The windows derive from
 * `date('now','localtime')` (the real clock), so interactions are seeded with
 * occurred_at dates computed RELATIVE to today, making the trailing windows
 * deterministic regardless of run date.
 *
 * The Digest's Overlooked section is no longer read here (38.13 D-61): it is
 * derived from the Up Next candidates, tested in up-next-read.test.ts.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { countNeverContacted } from "@/db/dashboard-read";
import {
  type GentleLine,
  type RetrospectiveRow,
  readGentleLine,
  readRetrospective,
} from "@/db/digest-read";
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
import { migration025 } from "@/db/migrations/025-interaction-history-schema";
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

/** A local `YYYY-MM-DD` string offset `days` from today (matches localtime). */
function localDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** A local `YYYY-MM-DD HH:MM:SS` string offset `days` from today. */
function localDateTimeOffset(days: number, time: string): string {
  return `${localDateOffset(days)} ${time}`;
}

interface ContactOpts {
  name?: string;
  intervalDays?: number;
  lastContact?: string | null;
  photo?: string | null;
  rarelyResponds?: number;
  remindersOff?: number;
  archivedAt?: string | null;
  trackingEnabled?: number;
  snoozeUntil?: string | null;
}

async function seedContact(o: ContactOpts = {}): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, last_contact, photo, rarely_responds,
        reminders_off, tracking_enabled, archived_at, snooze_until, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      o.name ?? "Alex",
      o.intervalDays ?? 30,
      o.lastContact === undefined ? localDateOffset(-5) : o.lastContact,
      o.photo ?? null,
      o.rarelyResponds ?? 0,
      o.remindersOff ?? 0,
      o.trackingEnabled ?? 1,
      o.archivedAt ?? null,
      o.snoozeUntil ?? null,
      NOW,
      NOW,
    ],
  );
  return result.lastInsertRowId;
}

interface InteractionOpts {
  occurredAt: string;
  quality?: string | null;
  connected?: number;
  direction?: string | null;
}

async function seedInteraction(
  contactId: number,
  o: InteractionOpts,
): Promise<void> {
  await exec.runAsync(
    `INSERT INTO interactions
       (uid, contact_id, occurred_at, recorded_at, channel, direction,
        connected, quality, source, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      contactId,
      o.occurredAt,
      o.occurredAt,
      "unspecified",
      o.direction ?? null,
      o.connected ?? 1,
      o.quality ?? null,
      "manual",
      NOW,
    ],
  );
}

describe("readRetrospective", () => {
  it("returns one row per contact with ANY interaction in the 7-day window, most-recent-first", async () => {
    const ann = await seedContact({ name: "Ann" });
    const bob = await seedContact({ name: "Bob" });
    // Ann: two touches; the LATER (offset -1) day must be the representative row.
    await seedInteraction(ann, {
      occurredAt: localDateTimeOffset(-4, "10:00:00"),
    });
    await seedInteraction(ann, {
      occurredAt: localDateTimeOffset(-1, "10:00:00"),
    });
    // Bob: one touch today.
    await seedInteraction(bob, {
      occurredAt: localDateTimeOffset(0, "09:00:00"),
    });

    const rows: RetrospectiveRow[] = await readRetrospective(exec);
    expect(rows).toHaveLength(2);
    // Most-recent-first: Bob (today) before Ann (yesterday); Ann collapsed to one row.
    expect(rows.map((r) => r.name)).toEqual(["Bob", "Ann"]);
    const annRow = rows.find((r) => r.name === "Ann");
    expect(annRow?.last_reached).toBe(localDateTimeOffset(-1, "10:00:00"));
  });

  it("counts ALL touchpoints — a connected=0 / direction=NULL interaction still appears", async () => {
    const cara = await seedContact({ name: "Cara" });
    await seedInteraction(cara, {
      occurredAt: localDateTimeOffset(-2, "18:00:00"),
      connected: 0,
      direction: null,
    });
    const rows = await readRetrospective(exec);
    expect(rows.map((r) => r.name)).toEqual(["Cara"]);
  });

  it("includes the boundary day and excludes beyond it (no UTC off-by-one at the edge)", async () => {
    const edge = await seedContact({ name: "Edge" });
    const past = await seedContact({ name: "Past" });
    // A 23:59 local time on the -6 boundary day is IN the inclusive window...
    await seedInteraction(edge, {
      occurredAt: localDateTimeOffset(-6, "23:59:00"),
    });
    // ...and a -7 day touch is OUT.
    await seedInteraction(past, {
      occurredAt: localDateTimeOffset(-7, "23:59:00"),
    });
    const rows = await readRetrospective(exec);
    expect(rows.map((r) => r.name)).toEqual(["Edge"]);
  });

  it("excludes archived contacts", async () => {
    const gone = await seedContact({ name: "Gone", archivedAt: NOW });
    await seedInteraction(gone, {
      occurredAt: localDateTimeOffset(0, "09:00:00"),
    });
    const rows = await readRetrospective(exec);
    expect(rows).toHaveLength(0);
  });

  it("keeps Unbound relationship history in the retrospective", async () => {
    const unbound = await seedContact({
      name: "Dormant history",
      trackingEnabled: 0,
    });
    await seedInteraction(unbound, {
      occurredAt: localDateTimeOffset(-1, "10:00:00"),
    });
    expect((await readRetrospective(exec)).map((row) => row.id)).toEqual([
      unbound,
    ]);
  });
});

describe("readGentleLine", () => {
  it("tallies hard vs total quality marks over the window and names the hard people", async () => {
    const ann = await seedContact({ name: "Ann" });
    const bob = await seedContact({ name: "Bob" });
    const cara = await seedContact({ name: "Cara", archivedAt: NOW });
    const dan = await seedContact({ name: "Dan" });

    // Ann: 2 Negative + 1 Positive in window → 2 hard, 3 total, in people.
    await seedInteraction(ann, {
      occurredAt: localDateTimeOffset(-1, "10:00:00"),
      quality: "Negative",
    });
    await seedInteraction(ann, {
      occurredAt: localDateTimeOffset(-3, "10:00:00"),
      quality: "Negative",
    });
    await seedInteraction(ann, {
      occurredAt: localDateTimeOffset(-5, "10:00:00"),
      quality: "Positive",
    });
    // Bob: 1 Neutral in window → 0 hard, 1 total, NOT in people.
    await seedInteraction(bob, {
      occurredAt: localDateTimeOffset(-2, "10:00:00"),
      quality: "Neutral",
    });
    // Bob: a quality=NULL mark in window → excluded from the tally entirely.
    await seedInteraction(bob, {
      occurredAt: localDateTimeOffset(-2, "11:00:00"),
      quality: null,
    });
    // Cara (archived): a Negative mark → excluded entirely.
    await seedInteraction(cara, {
      occurredAt: localDateTimeOffset(-1, "10:00:00"),
      quality: "Negative",
    });
    // Dan: a Negative mark OUTSIDE the window → excluded.
    await seedInteraction(dan, {
      occurredAt: localDateTimeOffset(-20, "10:00:00"),
      quality: "Negative",
    });

    const line: GentleLine = await readGentleLine(exec);
    expect(line.hard).toBe(2);
    expect(line.total).toBe(4); // Ann 3 + Bob 1 (NULL excluded)
    expect(line.people).toEqual([{ id: ann, name: "Ann" }]);
  });

  it("returns hard=1 for a single Negative mark (the screen gate decides show)", async () => {
    const solo = await seedContact({ name: "Solo" });
    await seedInteraction(solo, {
      occurredAt: localDateTimeOffset(-1, "10:00:00"),
      quality: "Negative",
    });
    const line = await readGentleLine(exec);
    expect(line.hard).toBe(1);
    expect(line.total).toBe(1);
    expect(line.people).toEqual([{ id: solo, name: "Solo" }]);
  });

  it("keeps Unbound relationship history in the all-relationship gentle line", async () => {
    const unbound = await seedContact({
      name: "Dormant effort",
      trackingEnabled: 0,
    });
    await seedInteraction(unbound, {
      occurredAt: localDateTimeOffset(-1, "10:00:00"),
      quality: "Negative",
    });
    expect(await readGentleLine(exec)).toEqual({
      hard: 1,
      total: 1,
      people: [{ id: unbound, name: "Dormant effort" }],
    });
  });

  it("is empty when there are no recent quality marks", async () => {
    await seedContact({ name: "Nobody" });
    const line = await readGentleLine(exec);
    expect(line).toEqual({ hard: 0, total: 0, people: [] });
  });
});

describe("readGentleLine — migrated-vocabulary regression (D-06 trip-wire)", () => {
  it("tallies the effortful line over a legacy-then-migrated fixture (no silent zero)", async () => {
    // Seed legacy quality values on the pre-025 schema, then apply migration 025.
    // A stale 'good'/'fine'/'hard' comparison in readGentleLine would silently
    // zero the tally the instant the vocabulary migrates on a real device.
    let n = 0;
    const seedUid = () => `dg-mig-${++n}`;
    const legacyExec = nodeSqliteExecutor(openTestDb());
    await runMigrations(legacyExec, [migration001, migration002], 2, {
      now: NOW,
      newUid: seedUid,
    });

    const contactResult = await legacyExec.runAsync(
      `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
       VALUES (?, 'Legacy Person', 30, ?, ?)`,
      [seedUid(), NOW, NOW],
    );
    const contactId = contactResult.lastInsertRowId;
    // Two legacy 'hard' + one 'good' in the recent window.
    for (const [quality, day] of [
      ["hard", -1],
      ["hard", -3],
      ["good", -5],
    ] as const) {
      await legacyExec.runAsync(
        `INSERT INTO interactions
           (uid, contact_id, occurred_at, recorded_at, channel, connected, quality, source, modified_at)
         VALUES (?, ?, ?, ?, 'text', 1, ?, 'manual', ?)`,
        [
          seedUid(),
          contactId,
          localDateTimeOffset(day, "10:00:00"),
          NOW,
          quality,
          NOW,
        ],
      );
    }

    await runMigrations(
      legacyExec,
      [migration001, migration002, migration025],
      25,
      { now: NOW, newUid: seedUid },
    );

    // After remap: two Negative + one Positive → hard=2, total=3.
    expect(await readGentleLine(legacyExec)).toEqual({
      hard: 2,
      total: 3,
      people: [{ id: contactId, name: "Legacy Person" }],
    });
  });
});

describe("backlog parity", () => {
  it("countNeverContacted matches the seeded non-archived never-contacted population", async () => {
    await seedContact({ name: "NC1", lastContact: null });
    await seedContact({ name: "NC2", lastContact: null });
    await seedContact({
      name: "ArchivedNC",
      lastContact: null,
      archivedAt: NOW,
    });
    await seedContact({ name: "Contacted", lastContact: localDateOffset(-3) });
    expect(await countNeverContacted(exec)).toBe(2);
  });
});
