/**
 * Read queries — behavioural proof (DATA-05 / DATA-07 targets).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and asserts, end to end:
 *   - STATUS_SCAN excludes never-contacted (last_contact IS NULL) AND archived
 *     (archived_at IS NOT NULL) rows and orders by progress DESC (most overdue first);
 *   - NEWEST_PER_CONTACT returns exactly one row per contact, newest by
 *     occurred_at with the id DESC tiebreak on a same-day pair;
 *   - NEWEST_FOR_CONTACT returns the single newest interaction for one bound
 *     contact_id (the `?`-bound value);
 *   - statusOrder ranks rogue < decay < wobble < stable < snoozed.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import {
  NEWEST_FOR_CONTACT,
  NEWEST_PER_CONTACT,
  STATUS_SCAN,
  statusOrder,
} from "@/db/queries";
import type { SqlExecutor } from "@/db/types";
import { formatLocalDate } from "@/utils/dates";

const NOW = "2026-08-14 12:00:00";

let uidCounter = 0;
const uid = () => `uid-${++uidCounter}`;

let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  const db = openTestDb();
  exec = nodeSqliteExecutor(db);
  await runMigrations(exec, [migration001], 1, { now: NOW, newUid: uid });
});

/** Local wall-clock datetime `n` days before today. */
function daysAgo(n: number, time = "12:00:00"): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${formatLocalDate(d)} ${time}`;
}

async function seedContact(opts: {
  name: string;
  intervalDays: number;
  lastContact: string | null;
  archivedAt?: string | null;
}): Promise<number> {
  const res = await exec.runAsync(
    `INSERT INTO contacts
       (uid, name, interval_days, last_contact, archived_at, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      opts.name,
      opts.intervalDays,
      opts.lastContact,
      opts.archivedAt ?? null,
      NOW,
      NOW,
    ],
  );
  return res.lastInsertRowId;
}

async function seedInteraction(opts: {
  contactId: number;
  occurredAt: string;
  channel?: string;
}): Promise<number> {
  const res = await exec.runAsync(
    `INSERT INTO interactions
       (uid, contact_id, occurred_at, recorded_at, channel, source, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      opts.contactId,
      opts.occurredAt,
      NOW,
      opts.channel ?? "unspecified",
      "manual",
      NOW,
    ],
  );
  return res.lastInsertRowId;
}

interface ScanRow {
  id: number;
  name: string;
  progress: number;
  status: string;
}

describe("STATUS_SCAN", () => {
  it("excludes never-contacted and archived rows, keeping only live contacted ones", async () => {
    const live = await seedContact({
      name: "Live",
      intervalDays: 10,
      lastContact: daysAgo(5),
    });
    await seedContact({
      name: "NeverContacted",
      intervalDays: 10,
      lastContact: null,
    });
    await seedContact({
      name: "Archived",
      intervalDays: 10,
      lastContact: daysAgo(5),
      archivedAt: NOW,
    });

    const rows = await exec.getAllAsync<ScanRow>(STATUS_SCAN);
    expect(rows.map((r) => r.id)).toEqual([live]);
    expect(rows[0].name).toBe("Live");
  });

  it("orders by progress DESC (most overdue first)", async () => {
    const stable = await seedContact({
      name: "Stable",
      intervalDays: 30,
      lastContact: daysAgo(3),
    });
    const decay = await seedContact({
      name: "Decay",
      intervalDays: 10,
      lastContact: daysAgo(25),
    });
    const wobble = await seedContact({
      name: "Wobble",
      intervalDays: 10,
      lastContact: daysAgo(9),
    });

    const rows = await exec.getAllAsync<ScanRow>(STATUS_SCAN);
    expect(rows.map((r) => r.id)).toEqual([decay, wobble, stable]);
    // progress is monotonically non-increasing
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].progress).toBeGreaterThanOrEqual(rows[i].progress);
    }
    expect(rows.find((r) => r.id === decay)?.status).toBe("decay");
  });
});

interface NewestRow {
  contact_id: number;
  occurred_at: string;
  channel: string;
}

describe("NEWEST_PER_CONTACT", () => {
  it("returns exactly one row per contact — the newest by occurred_at", async () => {
    const a = await seedContact({
      name: "A",
      intervalDays: 10,
      lastContact: daysAgo(1),
    });
    const b = await seedContact({
      name: "B",
      intervalDays: 10,
      lastContact: daysAgo(1),
    });
    await seedInteraction({
      contactId: a,
      occurredAt: daysAgo(9),
      channel: "text",
    });
    await seedInteraction({
      contactId: a,
      occurredAt: daysAgo(1),
      channel: "call",
    });
    await seedInteraction({
      contactId: b,
      occurredAt: daysAgo(4),
      channel: "email",
    });

    const rows = await exec.getAllAsync<NewestRow>(NEWEST_PER_CONTACT);
    const byContact = new Map(rows.map((r) => [r.contact_id, r]));
    expect(rows).toHaveLength(2);
    expect(byContact.get(a)?.channel).toBe("call"); // newest for A
    expect(byContact.get(b)?.channel).toBe("email");
  });

  it("breaks a same-day tie by id DESC (the higher id wins)", async () => {
    const c = await seedContact({
      name: "C",
      intervalDays: 10,
      lastContact: daysAgo(1),
    });
    // Two rows for the SAME occurred_at — the later-inserted (higher id) is newest.
    await seedInteraction({
      contactId: c,
      occurredAt: daysAgo(2),
      channel: "first",
    });
    await seedInteraction({
      contactId: c,
      occurredAt: daysAgo(2),
      channel: "second",
    });

    const rows = await exec.getAllAsync<NewestRow>(NEWEST_PER_CONTACT);
    expect(rows).toHaveLength(1);
    expect(rows[0].channel).toBe("second");
  });
});

describe("NEWEST_FOR_CONTACT", () => {
  it("returns the single newest interaction for one bound contact_id", async () => {
    const a = await seedContact({
      name: "A",
      intervalDays: 10,
      lastContact: daysAgo(1),
    });
    const b = await seedContact({
      name: "B",
      intervalDays: 10,
      lastContact: daysAgo(1),
    });
    await seedInteraction({
      contactId: a,
      occurredAt: daysAgo(9),
      channel: "old",
    });
    await seedInteraction({
      contactId: a,
      occurredAt: daysAgo(2),
      channel: "newA",
    });
    await seedInteraction({
      contactId: b,
      occurredAt: daysAgo(1),
      channel: "newB",
    });

    const row = await exec.getFirstAsync<NewestRow>(NEWEST_FOR_CONTACT, [a]);
    expect(row?.channel).toBe("newA");
    expect(row?.contact_id).toBe(a);
  });

  it("breaks a same-day tie by id DESC for the bound contact", async () => {
    const c = await seedContact({
      name: "C",
      intervalDays: 10,
      lastContact: daysAgo(1),
    });
    await seedInteraction({
      contactId: c,
      occurredAt: daysAgo(3),
      channel: "lo",
    });
    await seedInteraction({
      contactId: c,
      occurredAt: daysAgo(3),
      channel: "hi",
    });

    const row = await exec.getFirstAsync<NewestRow>(NEWEST_FOR_CONTACT, [c]);
    expect(row?.channel).toBe("hi");
  });
});

describe("statusOrder", () => {
  it("ranks rogue < decay < wobble < stable < snoozed (most urgent first)", () => {
    expect(statusOrder.rogue).toBeLessThan(statusOrder.decay);
    expect(statusOrder.decay).toBeLessThan(statusOrder.wobble);
    expect(statusOrder.wobble).toBeLessThan(statusOrder.stable);
    expect(statusOrder.stable).toBeLessThan(statusOrder.snoozed);
  });

  it("sorts a mixed list most-urgent first", () => {
    const list = ["stable", "rogue", "snoozed", "wobble", "decay"] as const;
    const sorted = [...list].sort((a, b) => statusOrder[a] - statusOrder[b]);
    expect(sorted).toEqual(["rogue", "decay", "wobble", "stable", "snoozed"]);
  });
});
