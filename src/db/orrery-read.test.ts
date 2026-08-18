/**
 * Orrery orbiting-contact scan — behavioural proof (ORR-01).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL orrery-read module. Status/progress derive from
 * `date('now','localtime')` (the real clock), so contacts are seeded with
 * last_contact dates relative to today via `localDateOffset` — buckets stay
 * deterministic regardless of run date.
 *
 * Locks:
 *   - never-contacted + archived exclusion, the full field set;
 *   - dense `COALESCE(ring_seq, 1e9), created_at, id` ordering (row index = rank,
 *     NOT the stored ring_seq value);
 *   - the `excludeContactId` sun-occupant omission;
 *   - status-parity with status.ts (the composed SQL embeds the imported
 *     STATUS_SQL / PROGRESS_SQL fragments — status can never drift);
 *   - L11 snooze divergence: a snoozed-but-contacted contact IS present (the
 *     orrery deliberately diverges from dashboard BASE_WHERE).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  listOrbitingContacts,
  ORBITING_SELECT,
  type OrbitingContact,
} from "@/db/orrery-read";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import { PROGRESS_SQL, STATUS_SQL } from "@/db/status";
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
  photo?: string | null;
  ringSeq?: number | null;
  snoozeUntil?: string | null;
  rarelyResponds?: number;
  archivedAt?: string | null;
  createdAt?: string;
}

async function seedContact(o: SeedOpts = {}): Promise<number> {
  const created = o.createdAt ?? NOW;
  const result = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, last_contact, photo, ring_seq, snooze_until,
        rarely_responds, archived_at, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      o.name ?? "Alex",
      o.intervalDays ?? 30,
      o.lastContact ?? null,
      o.photo ?? null,
      o.ringSeq ?? null,
      o.snoozeUntil ?? null,
      o.rarelyResponds ?? 0,
      o.archivedAt ?? null,
      created,
      created,
    ],
  );
  return result.lastInsertRowId;
}

const ids = (rows: { id: number }[]) => rows.map((r) => r.id);

// interval_days = 30: stable < 24d, wobble [24,30), decay [30,90), rogue >= 90d.
const STABLE = () => localDateOffset(-2);
const WOBBLE = () => localDateOffset(-26);
const ROGUE = () => localDateOffset(-200);

describe("listOrbitingContacts — population + exclusions", () => {
  it("excludes never-contacted and archived; keeps live contacted contacts", async () => {
    const live = await seedContact({ name: "Live", lastContact: STABLE() });
    await seedContact({ name: "Never", lastContact: null });
    await seedContact({
      name: "Archie",
      lastContact: STABLE(),
      archivedAt: NOW,
    });
    const rows = await listOrbitingContacts(exec);
    expect(ids(rows)).toEqual([live]);
  });

  it("L11: a snoozed-but-contacted contact IS present (divergence from dashboard BASE_WHERE)", async () => {
    const live = await seedContact({ name: "Live", lastContact: STABLE() });
    const snoozed = await seedContact({
      name: "Snoozed",
      lastContact: STABLE(),
      snoozeUntil: localDateOffset(5), // future snooze
    });
    const rows = await listOrbitingContacts(exec);
    // Both present — the orrery shows the whole live-contacted sky.
    expect(ids(rows).sort((a, b) => a - b)).toEqual(
      [live, snoozed].sort((a, b) => a - b),
    );
  });

  it("excludeContactId omits the sun occupant; null/undefined excludes nobody", async () => {
    const a = await seedContact({ name: "A", lastContact: STABLE() });
    const b = await seedContact({ name: "B", lastContact: STABLE() });
    const all = await listOrbitingContacts(exec);
    expect(ids(all).sort((x, y) => x - y)).toEqual([a, b].sort((x, y) => x - y));

    const excluded = await listOrbitingContacts(exec, { excludeContactId: a });
    expect(ids(excluded)).toEqual([b]);

    const nullExcluded = await listOrbitingContacts(exec, {
      excludeContactId: null,
    });
    expect(ids(nullExcluded).sort((x, y) => x - y)).toEqual(
      [a, b].sort((x, y) => x - y),
    );
  });
});

describe("listOrbitingContacts — dense ordering (row index = rank)", () => {
  it("orders by COALESCE(ring_seq, 1e9), created_at, id — set ring_seq before NULL", async () => {
    // seq1 has ring_seq 5, seq0 has ring_seq 0, nullA/nullB have NULL ring_seq.
    const nullA = await seedContact({
      name: "NullA",
      lastContact: STABLE(),
      ringSeq: null,
      createdAt: "2026-01-01 09:00:00",
    });
    const nullB = await seedContact({
      name: "NullB",
      lastContact: STABLE(),
      ringSeq: null,
      createdAt: "2026-02-01 09:00:00",
    });
    const seq5 = await seedContact({
      name: "Seq5",
      lastContact: STABLE(),
      ringSeq: 5,
    });
    const seq0 = await seedContact({
      name: "Seq0",
      lastContact: STABLE(),
      ringSeq: 0,
    });
    const rows = await listOrbitingContacts(exec);
    // seq0 (0) < seq5 (5) < NULLs (1e9), NULLs break by created_at then id.
    expect(ids(rows)).toEqual([seq0, seq5, nullA, nullB]);
  });

  it("ties on a NULL ring_seq break by created_at then id", async () => {
    const same = "2026-03-01 09:00:00";
    const first = await seedContact({
      name: "First",
      lastContact: STABLE(),
      createdAt: same,
    });
    const second = await seedContact({
      name: "Second",
      lastContact: STABLE(),
      createdAt: same,
    });
    const rows = await listOrbitingContacts(exec);
    expect(ids(rows)).toEqual([first, second]); // equal created_at → id ASC
  });
});

describe("listOrbitingContacts — field set + status parity", () => {
  it("carries id/name/photo/ring_seq/status/progress/rarely_responds", async () => {
    const c = await seedContact({
      name: "Full",
      lastContact: WOBBLE(),
      photo: "abc.jpg",
      ringSeq: 3,
      rarelyResponds: 1,
    });
    const rows = await listOrbitingContacts(exec);
    const row = rows.find((r) => r.id === c) as OrbitingContact;
    expect(row.name).toBe("Full");
    expect(row.photo).toBe("abc.jpg");
    expect(row.ring_seq).toBe(3);
    expect(row.status).toBe("wobble");
    expect(typeof row.progress).toBe("number");
    expect(row.rarely_responds).toBe(1);
  });

  it("photo is the raw relative path or null (never resolved here)", async () => {
    const c = await seedContact({ lastContact: STABLE(), photo: null });
    const rows = await listOrbitingContacts(exec);
    expect(rows.find((r) => r.id === c)?.photo).toBeNull();
  });

  it("status matches STATUS_SQL across buckets — a rogue reads 'rogue'", async () => {
    const rogue = await seedContact({ name: "Rogue", lastContact: ROGUE() });
    const rows = await listOrbitingContacts(exec);
    expect(rows.find((r) => r.id === rogue)?.status).toBe("rogue");
  });

  it("PARITY: the composed SELECT embeds the imported STATUS_SQL/PROGRESS_SQL", () => {
    // status can never drift from status.ts — the fragments are imported, not
    // re-typed (mirrors dashboard-read's fuel-parity guard).
    expect(ORBITING_SELECT).toContain(STATUS_SQL);
    expect(ORBITING_SELECT).toContain(PROGRESS_SQL);
  });
});
