/**
 * Notification read layer — behavioural proof (NOTIF-03/04).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL notification-read module (mirrors dashboard-read.test.ts). Because
 * decay eligibility derives from `date('now','localtime')` (the real clock) via
 * status.ts's PROGRESS_SQL, contacts are seeded with last_contact/snooze dates
 * computed RELATIVE to today via `localDateOffset`, so progress buckets are
 * deterministic regardless of run date. SQL-parity: the fixture's expected
 * buckets match status.ts thresholds (only the rogue upper cutoff, ROGUE_K = 3,
 * gates the decay read).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import {
  type BirthdayNotificationCandidate,
  type DecayEligibleCandidate,
  listBirthdayNotificationCandidates,
  listDecayEligibleCandidates,
} from "@/db/notification-read";
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

/** A local `YYYY-MM-DD` string offset `days` from today (matches localtime). */
function localDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface SeedOpts {
  name?: string;
  intervalDays?: number;
  lastContact?: string | null;
  snoozeUntil?: string | null;
  birthday?: string | null;
  rarelyResponds?: number;
  remindersOff?: number;
  archivedAt?: string | null;
}

/**
 * Seed one contact. Unlike the dashboard-read fixture this INCLUDES
 * `reminders_off` so the muted-exclusion case can be exercised directly.
 */
async function seedContact(o: SeedOpts = {}): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, last_contact, snooze_until, birthday,
        rarely_responds, reminders_off, archived_at, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      o.name ?? "Alex",
      o.intervalDays ?? 30,
      o.lastContact ?? null,
      o.snoozeUntil ?? null,
      o.birthday ?? null,
      o.rarelyResponds ?? 0,
      o.remindersOff ?? 0,
      o.archivedAt ?? null,
      NOW,
      NOW,
    ],
  );
  return result.lastInsertRowId;
}

const ids = (rows: { id: number }[]) => rows.map((r) => r.id);

// interval_days = 30 throughout, so (status.ts buckets, only ROGUE_K gates here):
// stable < 24d elapsed (< 0.8), wobble [24,30), overdue/decay [30,90),
// rogue >= 90d (progress >= 3 = ROGUE_K).
const STABLE = () => localDateOffset(-2); // ~0.07
const WOBBLE = () => localDateOffset(-26); // ~0.87
const OVERDUE = () => localDateOffset(-45); // ~1.5
const ROGUE = () => localDateOffset(-200); // ~6.7

describe("listDecayEligibleCandidates — H5 eligibility (stable/wobble/overdue all schedulable)", () => {
  it("returns a STABLE contact (not yet due) with last_contact + interval_days + snooze_until", async () => {
    const stable = await seedContact({
      name: "Stable",
      lastContact: STABLE(),
      intervalDays: 30,
    });
    const rows = await listDecayEligibleCandidates(exec);
    expect(ids(rows)).toEqual([stable]);
    const row = rows[0] as DecayEligibleCandidate;
    expect(row.last_contact).toBe(STABLE());
    expect(row.interval_days).toBe(30);
    expect(row.snooze_until).toBeNull();
  });

  it("returns a wobble AND an overdue-but-not-rogue contact", async () => {
    const wobble = await seedContact({ name: "Wobble", lastContact: WOBBLE() });
    const overdue = await seedContact({
      name: "Overdue",
      lastContact: OVERDUE(),
    });
    const rows = await listDecayEligibleCandidates(exec);
    expect(ids(rows)).toEqual([wobble, overdue]);
  });
});

describe("listDecayEligibleCandidates — snooze is a base, never an exclusion", () => {
  it("returns a FUTURE-snoozed contact WITH its future snooze_until", async () => {
    const future = localDateOffset(7);
    const snoozed = await seedContact({
      name: "Snoozed",
      lastContact: STABLE(),
      snoozeUntil: future,
    });
    const rows = await listDecayEligibleCandidates(exec);
    expect(ids(rows)).toEqual([snoozed]);
    expect((rows[0] as DecayEligibleCandidate).snooze_until).toBe(future);
  });

  it("returns a past-snoozed contact with that past value too", async () => {
    const past = localDateOffset(-3);
    const c = await seedContact({
      name: "PastSnooze",
      lastContact: STABLE(),
      snoozeUntil: past,
    });
    const rows = await listDecayEligibleCandidates(exec);
    expect(ids(rows)).toEqual([c]);
    expect((rows[0] as DecayEligibleCandidate).snooze_until).toBe(past);
  });
});

describe("listDecayEligibleCandidates — NOTIF-03 exclusions (each asserted absent)", () => {
  it("excludes never-contacted, rarely_responds, muted, archived, and rogue; keeps the eligible one", async () => {
    const eligible = await seedContact({
      name: "Eligible",
      lastContact: OVERDUE(),
    });
    await seedContact({ name: "Never", lastContact: null }); // never-contacted
    await seedContact({
      name: "Rarely",
      lastContact: OVERDUE(),
      rarelyResponds: 1,
    });
    await seedContact({
      name: "Muted",
      lastContact: OVERDUE(),
      remindersOff: 1,
    });
    await seedContact({
      name: "Archived",
      lastContact: OVERDUE(),
      archivedAt: NOW,
    });
    await seedContact({ name: "Rogue", lastContact: ROGUE() }); // progress >= ROGUE_K

    const rows = await listDecayEligibleCandidates(exec);
    expect(ids(rows)).toEqual([eligible]);
  });

  it("a contact exactly AT the rogue cutoff (progress >= ROGUE_K) is excluded", async () => {
    // 90 days / 30-day interval = 3.0 == ROGUE_K → rogue → suppressed.
    await seedContact({
      name: "AtCutoff",
      lastContact: localDateOffset(-90),
      intervalDays: 30,
    });
    const rows = await listDecayEligibleCandidates(exec);
    expect(rows).toEqual([]);
  });
});

describe("listDecayEligibleCandidates — deterministic order (item C)", () => {
  it("returns rows in ascending id order regardless of insertion bucket", async () => {
    // Insert out of "status" order so an implicit progress/rowid order can't
    // masquerade as an id order.
    const a = await seedContact({ name: "A", lastContact: ROGUE() }); // excluded
    const b = await seedContact({ name: "B", lastContact: OVERDUE() });
    const c = await seedContact({ name: "C", lastContact: STABLE() });
    const d = await seedContact({ name: "D", lastContact: WOBBLE() });
    expect(a).toBeGreaterThan(0);
    const rows = await listDecayEligibleCandidates(exec);
    const returned = ids(rows);
    expect(returned).toEqual([b, c, d]);
    // Assert SORTED, not merely the right set.
    expect(returned).toEqual([...returned].sort((x, y) => x - y));
  });
});

describe("listBirthdayNotificationCandidates — NOTIF-04 (all non-archived birthdays, no decay suppressor)", () => {
  it("returns day-of, next-week, and decay-suppressed birthdays; excludes null-birthday and archived", async () => {
    const dayOf = await seedContact({
      name: "DayOf",
      birthday: localDateOffset(0),
    });
    const nextWeek = await seedContact({
      name: "NextWeek",
      birthday: localDateOffset(7),
    });
    // Muted + snoozed + rogue day-of contact — STILL a birthday candidate.
    const suppressed = await seedContact({
      name: "MutedRogue",
      birthday: localDateOffset(0),
      lastContact: ROGUE(),
      remindersOff: 1,
      snoozeUntil: localDateOffset(30),
      rarelyResponds: 1,
    });
    await seedContact({ name: "NoBday", birthday: null }); // excluded
    await seedContact({
      name: "ArchivedBday",
      birthday: localDateOffset(0),
      archivedAt: NOW,
    }); // excluded

    const rows = await listBirthdayNotificationCandidates(exec);
    expect(ids(rows)).toEqual([dayOf, nextWeek, suppressed]);
  });

  it("returns every birthday row shape (id, name, birthday) in ascending id order", async () => {
    const first = await seedContact({ name: "First", birthday: "1990-03-14" });
    const second = await seedContact({ name: "Second", birthday: "01-05" });
    const rows: BirthdayNotificationCandidate[] =
      await listBirthdayNotificationCandidates(exec);
    expect(ids(rows)).toEqual([first, second]);
    expect(rows[0]?.birthday).toBe("1990-03-14");
    expect(rows[1]?.birthday).toBe("01-05");
  });
});
