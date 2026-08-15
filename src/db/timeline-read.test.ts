/**
 * Interleaved timeline read — behavioural proof (LOG-02, read half).
 *
 * Drives a fresh in-memory `node:sqlite` DB through the REAL migration-1 fixture
 * and the REAL read, asserting:
 *   - touchpoints + events interleave newest-first by occurred_at;
 *   - a real 'archive' event lands at the correct position among touchpoints;
 *   - an equal-occurred_at + equal-id cross-table pair (reachable because
 *     interactions.id and events.id are independent sequences) orders
 *     deterministically by kind_order into TWO rows with distinct ${kind}-${id}
 *     identity;
 *   - kind tagging is correct, other contacts are excluded, empty → [].
 */
import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { runMigrations } from "@/db/migrations/runner";
import { listTimeline, type TimelineItem } from "@/db/timeline-read";
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

async function seedContact(name = "Alex"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

/** Insert a touchpoint at a specific occurred_at; returns its rowid. */
async function seedInteraction(
  contactId: number,
  occurredAt: string,
  extra: Partial<{
    channel: string;
    direction: string | null;
    connected: number;
    quality: string | null;
    note: string | null;
  }> = {},
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO interactions
       (uid, contact_id, occurred_at, recorded_at, channel, direction,
        connected, quality, note, source, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      contactId,
      occurredAt,
      NOW,
      extra.channel ?? "unspecified",
      extra.direction ?? null,
      extra.connected ?? 1,
      extra.quality ?? null,
      extra.note ?? null,
      "manual",
      NOW,
    ],
  );
  return result.lastInsertRowId;
}

/** Insert an event at a specific occurred_at; returns its rowid. */
async function seedEvent(
  contactId: number,
  type: string,
  occurredAt: string,
  detail: string | null = null,
): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO events (uid, contact_id, type, occurred_at, detail, recorded_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uid(), contactId, type, occurredAt, detail, NOW, NOW],
  );
  return result.lastInsertRowId;
}

const identity = (i: TimelineItem) => `${i.kind}-${i.id}`;

describe("listTimeline — interleaved newest-first read", () => {
  it("interleaves touchpoints and a real event, ordered by occurred_at DESC", async () => {
    const c = await seedContact();
    await seedInteraction(c, "2026-08-10 09:00:00");
    await seedEvent(c, "archive", "2026-08-12 09:00:00");
    await seedInteraction(c, "2026-08-14 09:00:00");

    const rows = await listTimeline(exec, c);

    expect(rows.map((r) => r.occurred_at)).toEqual([
      "2026-08-14 09:00:00",
      "2026-08-12 09:00:00",
      "2026-08-10 09:00:00",
    ]);
    // The event lands read-only between the two touchpoints.
    expect(rows.map((r) => r.kind)).toEqual([
      "touchpoint",
      "event",
      "touchpoint",
    ]);
    const evt = rows[1];
    expect(evt.kind).toBe("event");
    if (evt.kind === "event") {
      expect(evt.type).toBe("archive");
    }
  });

  it("breaks a same-day touchpoint tie by id DESC (later-recorded first)", async () => {
    const c = await seedContact();
    const first = await seedInteraction(c, "2026-08-10 09:00:00");
    const second = await seedInteraction(c, "2026-08-10 09:00:00");

    const rows = await listTimeline(exec, c);

    // Both same occurred_at → higher id first.
    expect(rows.map((r) => r.id)).toEqual([second, first]);
  });

  it("orders an equal-occurred_at + equal-id cross-table pair deterministically by kind_order, distinct identity", async () => {
    const c = await seedContact();
    // Force a full collision: a touchpoint and an event that share BOTH
    // occurred_at AND the numeric id (independent PK sequences make id=1 for the
    // first row of each table).
    const tId = await seedInteraction(c, "2026-08-13 09:00:00");
    const eId = await seedEvent(c, "restore", "2026-08-13 09:00:00");
    expect(tId).toBe(eId); // same numeric id, different tables

    const rows = await listTimeline(exec, c);

    // Two distinct rows despite the numeric-id collision.
    expect(rows.length).toBe(2);
    // kind_order DESC → touchpoint (1) before event (0) on the full tie.
    expect(rows.map((r) => r.kind)).toEqual(["touchpoint", "event"]);
    // Distinct ${kind}-${id} identity — no duplicate keys/testIDs.
    const ids = rows.map(identity);
    expect(ids).toEqual([`touchpoint-${tId}`, `event-${eId}`]);
    expect(new Set(ids).size).toBe(2);
  });

  it("carries touchpoint metadata and event fields through", async () => {
    const c = await seedContact();
    await seedInteraction(c, "2026-08-10 09:00:00", {
      channel: "call",
      direction: "outbound",
      connected: 0,
      quality: "good",
      note: "caught up",
    });
    await seedEvent(c, "archive", "2026-08-11 09:00:00", "left the room");

    const rows = await listTimeline(exec, c);
    const evt = rows[0];
    const tp = rows[1];
    expect(evt.kind).toBe("event");
    if (evt.kind === "event") {
      expect(evt).toMatchObject({ type: "archive", detail: "left the room" });
    }
    expect(tp.kind).toBe("touchpoint");
    if (tp.kind === "touchpoint") {
      expect(tp).toMatchObject({
        channel: "call",
        direction: "outbound",
        connected: 0,
        quality: "good",
        note: "caught up",
      });
    }
  });

  it("excludes other contacts' rows", async () => {
    const a = await seedContact("A");
    const b = await seedContact("B");
    await seedInteraction(a, "2026-08-10 09:00:00");
    await seedEvent(a, "archive", "2026-08-11 09:00:00");
    await seedInteraction(b, "2026-08-12 09:00:00");

    const rows = await listTimeline(exec, a);
    expect(rows.length).toBe(2);
    // None of A's rows carry B's later timestamp.
    expect(rows.every((r) => r.occurred_at <= "2026-08-11 09:00:00")).toBe(
      true,
    );
  });

  it("returns [] for a contact with no timeline rows", async () => {
    const c = await seedContact();
    expect(await listTimeline(exec, c)).toEqual([]);
  });
});
