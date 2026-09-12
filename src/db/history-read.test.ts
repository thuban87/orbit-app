/**
 * Canonical history-read DAO — behavioural proof (HIST-02/10/16, D-10/D-12).
 *
 * RED first. Drives a real in-memory node:sqlite DB through the real migration
 * chain, asserting: date-indexed interaction records (with duration/allow_ai) +
 * lifecycle events + per-date markers + a distinct hasLifecycleRecords signal;
 * counts resolve ONLY from `interactions` rows; the group-link discriminator is
 * an INERT seam (hard-false for every Phase-32 row, no group_event_id column);
 * and a knowledge-change family spanning EVERY registered current-state field.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { setCurrentStateValue } from "@/db/current-state-history-dao";
import { isGroupLinked, readContactHistory } from "@/db/history-read";
import { createGroupEvent } from "@/db/group-events-dao";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-05 12:00:00";
let uidCounter = 0;
const uid = () => `history-read-uid-${++uidCounter}`;

async function freshExec(): Promise<SqlExecutor> {
  uidCounter = 0;
  const exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid: uid });
  return exec;
}

async function makeContact(exec: SqlExecutor, name = "Alex"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid(), name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function insertInteraction(
  exec: SqlExecutor,
  contactId: number,
  occurredAt: string,
  extra: {
    channel?: string;
    direction?: string | null;
    connected?: number;
    quality?: string | null;
    note?: string | null;
    duration?: number | null;
    allowAi?: number;
  } = {},
): Promise<number> {
  const r = await exec.runAsync(
    `INSERT INTO interactions
       (uid, contact_id, occurred_at, recorded_at, channel, direction,
        connected, quality, note, duration, allow_ai, source, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      contactId,
      occurredAt,
      NOW,
      extra.channel ?? "Message",
      extra.direction ?? "outbound",
      extra.connected ?? 1,
      extra.quality ?? null,
      extra.note ?? null,
      extra.duration ?? null,
      extra.allowAi ?? 0,
      "manual",
      NOW,
    ],
  );
  return r.lastInsertRowId;
}

async function insertEvent(
  exec: SqlExecutor,
  contactId: number,
  type: string,
  occurredAt: string,
): Promise<number> {
  const r = await exec.runAsync(
    `INSERT INTO events (uid, contact_id, type, occurred_at, detail, recorded_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uid(), contactId, type, occurredAt, null, NOW, NOW],
  );
  return r.lastInsertRowId;
}

describe("readContactHistory — interaction records + markers", () => {
  it("returns date-indexed interaction records with duration/allow_ai and a false group flag", async () => {
    const exec = await freshExec();
    const contactId = await makeContact(exec);
    await insertInteraction(exec, contactId, "2026-08-01 09:00:00", {
      channel: "Call",
      direction: "outbound",
      connected: 1,
      quality: "Positive",
      note: "caught up",
      duration: 1500,
      allowAi: 1,
    });

    const history = await readContactHistory(exec, contactId);
    expect(history.interactions).toHaveLength(1);
    const record = history.interactions[0];
    expect(record).toEqual(
      expect.objectContaining({
        occurredAt: "2026-08-01 09:00:00",
        date: "2026-08-01",
        channel: "Call",
        direction: "outbound",
        connected: 1,
        quality: "Positive",
        note: "caught up",
        duration: 1500,
        allowAi: 1,
        groupLinked: false,
      }),
    );
  });

  it("marks a multi-interaction date and orders same-timestamp rows by id DESC", async () => {
    const exec = await freshExec();
    const contactId = await makeContact(exec);
    const first = await insertInteraction(exec, contactId, "2026-08-10 10:00:00");
    const second = await insertInteraction(exec, contactId, "2026-08-10 10:00:00");

    const history = await readContactHistory(exec, contactId);
    // Same occurred_at → newest (higher id) first, stable.
    expect(history.interactions.map((r) => r.id)).toEqual([second, first]);
    const marker = history.markers.get("2026-08-10");
    expect(marker).toEqual(
      expect.objectContaining({ interactionCount: 2, lifecycleCount: 0, kind: "multiple" }),
    );
  });

  it("distinguishes a lifecycle-only date from an interaction-bearing one (D-10 count-only)", async () => {
    const exec = await freshExec();
    const contactId = await makeContact(exec);
    await insertInteraction(exec, contactId, "2026-08-01 09:00:00");
    await insertEvent(exec, contactId, "archive", "2026-08-03 09:00:00");

    const history = await readContactHistory(exec, contactId);
    expect(history.markers.get("2026-08-01")).toEqual(
      expect.objectContaining({ interactionCount: 1, lifecycleCount: 0, kind: "interaction" }),
    );
    // Lifecycle-only date: a lifecycle marker with a ZERO interaction count.
    expect(history.markers.get("2026-08-03")).toEqual(
      expect.objectContaining({ interactionCount: 0, lifecycleCount: 1, kind: "lifecycle-only" }),
    );
    expect(history.hasLifecycleRecords).toBe(true);
  });

  it("reports hasLifecycleRecords with zero interactions for a lifecycle-only contact", async () => {
    const exec = await freshExec();
    const contactId = await makeContact(exec);
    await insertEvent(exec, contactId, "bind", "2026-08-03 09:00:00");

    const history = await readContactHistory(exec, contactId);
    expect(history.interactions).toHaveLength(0);
    expect(history.lifecycleEvents).toHaveLength(1);
    expect(history.hasLifecycleRecords).toBe(true);
  });

  it("returns empty markers/records/false-signal for a contact with no history", async () => {
    const exec = await freshExec();
    const contactId = await makeContact(exec);

    const history = await readContactHistory(exec, contactId);
    expect(history.interactions).toEqual([]);
    expect(history.lifecycleEvents).toEqual([]);
    expect(history.knowledgeChanges).toEqual([]);
    expect(history.markers.size).toBe(0);
    expect(history.hasLifecycleRecords).toBe(false);
  });
});

describe("isGroupLinked — inert seam (D-12)", () => {
  it("resolves hard-false for every Phase-32 interaction row (no group_event_id column)", async () => {
    const exec = await freshExec();
    const contactId = await makeContact(exec);
    await insertInteraction(exec, contactId, "2026-08-01 09:00:00");
    await insertInteraction(exec, contactId, "2026-08-02 09:00:00");

    const history = await readContactHistory(exec, contactId);
    expect(history.interactions.every((r) => r.groupLinked === false)).toBe(true);
    // The predicate itself is hard-false: no group_event_id field exists.
    expect(isGroupLinked({})).toBe(false);
    expect(isGroupLinked({ groupEventId: undefined })).toBe(false);
  });
});

describe("readContactHistory — Group Event local context", () => {
  it("surfaces one group child with local context while the parent never becomes history", async () => {
    const exec = await freshExec();
    const contactId = await makeContact(exec);
    const { groupEventId } = await createGroupEvent(exec, {
      uid: uid(), title: "Dinner", occurredAt: "2026-09-01 18:00:00", now: NOW,
      groupNote: "GROUP_NOTE_LOCAL_ONLY", participants: [{ contactId, uid: uid() }],
    });
    const history = await readContactHistory(exec, contactId);
    expect(history.interactions).toHaveLength(1);
    expect(history.interactions[0]).toMatchObject({ groupLinked: true, groupEventId, groupTitle: "Dinner", groupNote: "GROUP_NOTE_LOCAL_ONLY" });
    expect(history.markers.get("2026-09-01")).toMatchObject({ interactionCount: 1 });
  });
});

describe("readContactHistory — knowledge-change family (HIST-10)", () => {
  it("surfaces every registered current-state field, each record carrying its fieldKey", async () => {
    const exec = await freshExec();
    const contactId = await makeContact(exec);
    await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "last_talked_about",
      value: "new job",
      now: "2026-08-01 09:00:00",
    });
    await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      now: "2026-08-05 09:00:00",
    });

    const history = await readContactHistory(exec, contactId);
    const fieldKeys = new Set(history.knowledgeChanges.map((r) => r.fieldKey));
    expect(fieldKeys).toEqual(new Set(["last_talked_about", "current_location"]));
    expect(history.knowledgeChanges.every((r) => typeof r.fieldKey === "string" && r.date.length === 10)).toBe(true);
  });

  it("orders same-timestamp knowledge records stably across fields", async () => {
    const exec = await freshExec();
    const contactId = await makeContact(exec);
    // Both fields written at the SAME timestamp — the family must be deterministic.
    await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "current_location",
      value: "Chicago",
      now: "2026-08-05 09:00:00",
    });
    await setCurrentStateValue(exec, {
      contactId,
      fieldKey: "last_talked_about",
      value: "new job",
      now: "2026-08-05 09:00:00",
    });

    const a = await readContactHistory(exec, contactId);
    const b = await readContactHistory(exec, contactId);
    expect(a.knowledgeChanges.map((r) => `${r.fieldKey}:${r.id}`)).toEqual(
      b.knowledgeChanges.map((r) => `${r.fieldKey}:${r.id}`),
    );
    // Same created_at → registry field order (last_talked_about before current_location).
    const sameDay = a.knowledgeChanges.filter((r) => r.date === "2026-08-05");
    expect(sameDay[0].fieldKey).toBe("last_talked_about");
    expect(sameDay[1].fieldKey).toBe("current_location");
  });
});
