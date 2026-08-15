/**
 * getContactStatus — single-contact query-time status + reason (LOG-05).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture,
 * seeds contacts with known `last_contact` / `interval_days` / `rarely_responds`,
 * and asserts the by-id read returns a query-time status (INCLUDING rogue) plus a
 * matching reason — and, critically, that a never-contacted (last_contact NULL)
 * row is guarded to a null status/reason/progress rather than mislabelled 'stable'
 * (the STATUS_SCAN NULL pre-filter is absent on a single by-id seek, so the guard
 * lives in getContactStatus itself).
 */
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { getContactStatus } from "@/db/contact-status-read";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import { ROGUE_K } from "@/db/status";
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

describe("getContactStatus", () => {
  it("returns { status:'rogue', reason:'overdue' } for a rogue-by-time contact", async () => {
    // 35 / 10 = 3.5 (>= ROGUE_K = 3)
    const id = await seedContact({
      name: "Overdue",
      intervalDays: 10,
      lastContact: daysAgo(35),
    });
    const res = await getContactStatus(exec, id);
    expect(res).not.toBeNull();
    expect(res?.status).toBe("rogue");
    expect(res?.reason).toBe("overdue");
    expect(res?.progress).toBeGreaterThanOrEqual(ROGUE_K);
  });

  it("returns { status:'rogue', reason:'unresponsive' } for a rarely_responds contact past WOBBLE_MAX", async () => {
    // 12 / 10 = 1.2 — decay for a normal contact, rogue for a rarely_responds one.
    const id = await seedContact({
      name: "Unresponsive",
      intervalDays: 10,
      lastContact: daysAgo(12),
      rarelyResponds: true,
    });
    const res = await getContactStatus(exec, id);
    expect(res?.status).toBe("rogue");
    expect(res?.reason).toBe("unresponsive");
  });

  it("returns a null reason for a decay contact (status matches STATUS_SQL)", async () => {
    // 20 / 10 = 2.0 → decay, no reason.
    const id = await seedContact({
      name: "Decay",
      intervalDays: 10,
      lastContact: daysAgo(20),
    });
    const res = await getContactStatus(exec, id);
    expect(res?.status).toBe("decay");
    expect(res?.reason).toBeNull();
  });

  it("returns a null reason for a wobble contact", async () => {
    // 9 / 10 = 0.9 → wobble.
    const id = await seedContact({
      name: "Wobble",
      intervalDays: 10,
      lastContact: daysAgo(9),
    });
    const res = await getContactStatus(exec, id);
    expect(res?.status).toBe("wobble");
    expect(res?.reason).toBeNull();
  });

  it("returns a null reason for a stable contact", async () => {
    // 5 / 10 = 0.5 → stable.
    const id = await seedContact({
      name: "Stable",
      intervalDays: 10,
      lastContact: daysAgo(5),
    });
    const res = await getContactStatus(exec, id);
    expect(res?.status).toBe("stable");
    expect(res?.reason).toBeNull();
  });

  it("guards never-contacted (last_contact NULL): status/reason/progress all null (never mislabelled 'stable')", async () => {
    const id = await seedContact({
      name: "NeverContacted",
      intervalDays: 10,
      lastContact: null,
    });
    const res = await getContactStatus(exec, id);
    expect(res).not.toBeNull();
    expect(res?.status).toBeNull();
    expect(res?.reason).toBeNull();
    expect(res?.progress).toBeNull();
    expect(res?.last_contact).toBeNull();
  });

  it("returns null for a missing contact id", async () => {
    const res = await getContactStatus(exec, 999_999);
    expect(res).toBeNull();
  });

  it("surfaces rarely_responds and last_contact on the row", async () => {
    const lc = daysAgo(5);
    const id = await seedContact({
      name: "WithFlags",
      intervalDays: 10,
      lastContact: lc,
      rarelyResponds: true,
    });
    const res = await getContactStatus(exec, id);
    expect(res?.rarely_responds).toBe(1);
    expect(res?.last_contact).toBe(lc);
  });
});
