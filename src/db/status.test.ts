/**
 * Query-time status engine — behavioural proof (DATA-05).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture,
 * seeds contacts with known `last_contact` / `interval_days`, and evaluates the
 * PROGRESS_SQL / STATUS_SQL fragments in a SELECT to assert:
 *   - the four buckets at 0.8 (wobble) / 1.0 (decay) / ROGUE_K (rogue),
 *   - the rarely_responds → rogue non-time path at progress >= 1.0,
 *   - day-granular resolution at local midnight (time-of-day is irrelevant), and
 *   - the named near-midnight regression (a stored `... 00:30:00` does NOT
 *     day-shift because the stored, already-local column is never re-run through
 *     'localtime') — the fix for review HIGH "status SQL timezone double-conversion".
 * Also asserts the module is derived-never-stored: it issues no write statement.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import {
  PROGRESS_SQL,
  ROGUE_K,
  STABLE_MAX,
  STATUS_SQL,
  WOBBLE_MAX,
} from "@/db/status";
import type { SqlExecutor } from "@/db/types";
import { formatLocalDate } from "@/utils/dates";

const NOW = "2026-08-14 12:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let db: DatabaseSync;
let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
});

/** Local wall-clock datetime `n` days before today (never re-converted by the SQL). */
function daysAgo(n: number, time = "12:00:00"): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${formatLocalDate(d)} ${time}`;
}

/** Seed one contact; returns its id. `lastContact` may be null (never-contacted). */
async function seedContact(opts: {
  name: string;
  intervalDays: number;
  lastContact: string | null;
  rarelyResponds?: boolean;
}): Promise<number> {
  const res = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, last_contact, rarely_responds, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      opts.name,
      opts.intervalDays,
      opts.lastContact,
      opts.rarelyResponds ? 1 : 0,
      NOW,
      NOW,
    ],
  );
  return res.lastInsertRowId;
}

interface Row {
  id: number;
  progress: number;
  status: string;
}

/** Evaluate PROGRESS_SQL / STATUS_SQL for one contact via a SELECT. */
async function evaluate(id: number): Promise<Row> {
  const row = await exec.getFirstAsync<Row>(
    `SELECT id, (${PROGRESS_SQL}) AS progress, (${STATUS_SQL}) AS status
       FROM contacts WHERE id = ?`,
    [id],
  );
  if (!row) throw new Error(`contact ${id} not found`);
  return row;
}

describe("status thresholds", () => {
  it("keeps STABLE_MAX / WOBBLE_MAX aligned with the src/types.ts 0.8 / 1.0 buckets", () => {
    // calculateStatus() in src/types.ts hardcodes `threshold * 0.8` (stable ceiling)
    // and `< threshold` (wobble ceiling = 1.0). These constants are the shared source.
    expect(STABLE_MAX).toBe(0.8);
    expect(WOBBLE_MAX).toBe(1.0);
    expect(ROGUE_K).toBeGreaterThanOrEqual(2);
  });
});

describe("STATUS_SQL buckets (elapsed ÷ interval)", () => {
  it("buckets < 0.8 as stable", async () => {
    // 5 / 10 = 0.5
    const id = await seedContact({
      name: "Stable",
      intervalDays: 10,
      lastContact: daysAgo(5),
    });
    const row = await evaluate(id);
    expect(row.progress).toBeCloseTo(0.5, 5);
    expect(row.status).toBe("stable");
  });

  it("buckets [0.8, 1.0) as wobble", async () => {
    // 9 / 10 = 0.9
    const id = await seedContact({
      name: "Wobble",
      intervalDays: 10,
      lastContact: daysAgo(9),
    });
    const row = await evaluate(id);
    expect(row.progress).toBeCloseTo(0.9, 5);
    expect(row.status).toBe("wobble");
  });

  it("buckets exactly 0.8 as wobble (inclusive lower boundary)", async () => {
    // 8 / 10 = 0.8
    const id = await seedContact({
      name: "Boundary",
      intervalDays: 10,
      lastContact: daysAgo(8),
    });
    const row = await evaluate(id);
    expect(row.progress).toBeCloseTo(0.8, 5);
    expect(row.status).toBe("wobble");
  });

  it("buckets [1.0, ROGUE_K) as decay", async () => {
    // 20 / 10 = 2.0
    const id = await seedContact({
      name: "Decay",
      intervalDays: 10,
      lastContact: daysAgo(20),
    });
    const row = await evaluate(id);
    expect(row.progress).toBeCloseTo(2.0, 5);
    expect(row.status).toBe("decay");
  });

  it("buckets exactly 1.0 as decay (inclusive lower boundary)", async () => {
    // 10 / 10 = 1.0
    const id = await seedContact({
      name: "AtInterval",
      intervalDays: 10,
      lastContact: daysAgo(10),
    });
    const row = await evaluate(id);
    expect(row.progress).toBeCloseTo(1.0, 5);
    expect(row.status).toBe("decay");
  });

  it("buckets >= ROGUE_K as rogue", async () => {
    // 35 / 10 = 3.5 (>= ROGUE_K = 3)
    const id = await seedContact({
      name: "Rogue",
      intervalDays: 10,
      lastContact: daysAgo(35),
    });
    const row = await evaluate(id);
    expect(row.progress).toBeGreaterThanOrEqual(ROGUE_K);
    expect(row.status).toBe("rogue");
  });
});

describe("rarely_responds → rogue non-time path", () => {
  it("labels a rarely_responds contact at progress >= 1.0 as rogue even below ROGUE_K", async () => {
    // 12 / 10 = 1.2 — decay for a normal contact, rogue for a rarely_responds one.
    const id = await seedContact({
      name: "RarelyRogue",
      intervalDays: 10,
      lastContact: daysAgo(12),
      rarelyResponds: true,
    });
    const row = await evaluate(id);
    expect(row.progress).toBeCloseTo(1.2, 5);
    expect(row.status).toBe("rogue");
  });

  it("does NOT promote a rarely_responds contact below 1.0", async () => {
    // 9 / 10 = 0.9 — still wobble; the rogue promotion is gated on progress >= 1.0.
    const id = await seedContact({
      name: "RarelyWobble",
      intervalDays: 10,
      lastContact: daysAgo(9),
      rarelyResponds: true,
    });
    const row = await evaluate(id);
    expect(row.status).toBe("wobble");
  });
});

describe("day-granular resolution at local midnight", () => {
  it("yields equal progress for two contacts last-contacted the same calendar day, regardless of time-of-day", async () => {
    const morning = await seedContact({
      name: "Morning",
      intervalDays: 30,
      lastContact: daysAgo(5, "07:15:00"),
    });
    const evening = await seedContact({
      name: "Evening",
      intervalDays: 30,
      lastContact: daysAgo(5, "22:45:00"),
    });
    const a = await evaluate(morning);
    const b = await evaluate(evening);
    expect(a.progress).toBe(b.progress);
    expect(a.status).toBe(b.status);
  });

  it("near-midnight regression: a stored `00:30:00` truncates to its own date (NO day-shift) and buckets identically to a same-day `23:30:00`", async () => {
    // The fixed HIGH: the stored value is already LOCAL wall-clock, so date(last_contact)
    // must NOT re-apply 'localtime'. If it did, a stored `2026-08-14 00:30:00` would be
    // read as UTC and shifted a day early in behind-UTC zones — day-shifting the bucket.
    const justAfterMidnight = await seedContact({
      name: "JustAfterMidnight",
      intervalDays: 30,
      lastContact: daysAgo(5, "00:30:00"),
    });
    const lateSameDay = await seedContact({
      name: "LateSameDay",
      intervalDays: 30,
      lastContact: daysAgo(5, "23:30:00"),
    });
    const a = await evaluate(justAfterMidnight);
    const b = await evaluate(lateSameDay);
    // Both truncate to the SAME local date → identical progress, no off-by-one day.
    expect(a.progress).toBe(b.progress);
    expect(a.status).toBe(b.status);
    // And the progress is exactly 5/30 — proving neither row shifted to day 4 or 6.
    expect(a.progress).toBeCloseTo(5 / 30, 5);
  });
});

describe("derived-never-stored", () => {
  it("status.ts issues no write statement (no ALTER/UPDATE/INSERT of status/progress)", () => {
    const src = readFileSync(
      fileURLToPath(new URL("./status.ts", import.meta.url)),
      "utf8",
    );
    // Strip line + block comments so prose about 'never store status' doesn't false-positive.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\bUPDATE\b/i);
    expect(code).not.toMatch(/\bINSERT\b/i);
    expect(code).not.toMatch(/\bALTER\b/i);
    expect(code).not.toMatch(/ADD COLUMN/i);
  });

  it("does not re-convert the stored column: date(last_contact) carries no 'localtime' modifier", () => {
    // The stored side is already local; only `now` is converted.
    expect(PROGRESS_SQL).toMatch(/date\(last_contact\)/);
    expect(PROGRESS_SQL).not.toMatch(/date\(last_contact,\s*'localtime'\)/);
    expect(PROGRESS_SQL).toMatch(/date\('now',\s*'localtime'\)/);
    // Bare UTC now (no modifier) must be absent.
    expect(PROGRESS_SQL).not.toMatch(/date\('now'\)/);
  });
});
