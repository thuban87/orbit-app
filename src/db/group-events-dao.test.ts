import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { createGroupEvent } from "@/db/group-events-dao";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-12 12:00:00";
let counter = 0;
const uid = () => `group-event-${++counter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  counter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, { now: NOW, newUid: uid });
});

async function contact(name = "Alex"): Promise<number> {
  const result = await exec.runAsync(
    "INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, ?, 30, ?, ?)",
    [uid(), name, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function count(table: "group_events" | "interactions"): Promise<number> {
  return (await exec.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))?.n ?? 0;
}

describe("createGroupEvent", () => {
  it("persists a valid zero-participant parent without an interaction", async () => {
    const result = await createGroupEvent(exec, {
      uid: uid(), title: "Book club", occurredAt: NOW, now: NOW, participants: [],
    });
    expect(result.groupEventId).toBeGreaterThan(0);
    expect(await count("group_events")).toBe(1);
    expect(await count("interactions")).toBe(0);
    expect(await exec.getFirstAsync<{ channel: string }>("SELECT channel FROM group_events WHERE id = ?", [result.groupEventId])).toEqual({ channel: "In Person" });
  });

  it("fans out canonical children and recomputes each participant recency", async () => {
    const alex = await contact("Alex");
    const sam = await contact("Sam");
    const occurredAt = "2026-09-10 18:00:00";
    const { groupEventId } = await createGroupEvent(exec, {
      uid: uid(), title: "Dinner", occurredAt, now: NOW, channel: "Call", quality: "Positive", duration: 3600,
      participants: [
        { contactId: alex, uid: uid(), direction: "outbound", connected: 1, note: "Alex note" },
        { contactId: sam, uid: uid(), direction: "inbound", connected: 0 },
      ],
    });
    const rows = await exec.getAllAsync<{ contact_id: number; group_event_id: number; ge_follow_channel: number; ge_follow_quality: number; ge_follow_duration: number; direction: string; connected: number }>(
      "SELECT contact_id, group_event_id, ge_follow_channel, ge_follow_quality, ge_follow_duration, direction, connected FROM interactions ORDER BY contact_id",
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.group_event_id)).toEqual([groupEventId, groupEventId]);
    expect(rows.every((row) => row.ge_follow_channel === 1 && row.ge_follow_quality === 1 && row.ge_follow_duration === 1)).toBe(true);
    expect(rows.find((row) => row.contact_id === alex)).toMatchObject({ direction: "outbound", connected: 1 });
    expect(await exec.getFirstAsync<{ last_contact: string }>("SELECT last_contact FROM contacts WHERE id = ?", [alex])).toEqual({ last_contact: occurredAt });
    // Sam's unconnected row does not qualify as recency only if their contact is rarely-responds;
    // here it remains the sole normal-contact interaction.
    expect(await exec.getFirstAsync<{ last_contact: string }>("SELECT last_contact FROM contacts WHERE id = ?", [sam])).toEqual({ last_contact: occurredAt });
  });

  it("rejects duplicate membership atomically", async () => {
    const alex = await contact();
    await expect(createGroupEvent(exec, {
      uid: uid(), title: "Dinner", occurredAt: NOW, now: NOW,
      participants: [{ contactId: alex, uid: uid() }, { contactId: alex, uid: uid() }],
    })).rejects.toThrow();
    expect(await count("group_events")).toBe(0);
    expect(await count("interactions")).toBe(0);
  });

  it("rejects future, blank-title, and blank-uid inputs before writing", async () => {
    await expect(createGroupEvent(exec, { uid: uid(), title: "Future", occurredAt: "2026-09-12 12:00:01", now: NOW, participants: [] })).rejects.toThrow();
    await expect(createGroupEvent(exec, { uid: uid(), title: "  ", occurredAt: NOW, now: NOW, participants: [] })).rejects.toThrow();
    await expect(createGroupEvent(exec, { uid: "", title: "Valid", occurredAt: NOW, now: NOW, participants: [] })).rejects.toThrow();
    expect(await count("group_events")).toBe(0);
  });
});
