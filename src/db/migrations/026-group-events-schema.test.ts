import { beforeEach, describe, expect, it } from "vitest";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { migration001 } from "@/db/migrations/001-initial";
import { migration002 } from "@/db/migrations/002-app-settings";
import { migration025 } from "@/db/migrations/025-interaction-history-schema";
import { GROUP_EVENTS_SCHEMA_VERSION, migration026 } from "@/db/migrations/026-group-events-schema";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-12 12:00:00";
let seq = 0;
const uid = () => `migration-026-${++seq}`;
let exec: SqlExecutor;

beforeEach(async () => {
  seq = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, [migration001, migration002, migration025, migration026], GROUP_EVENTS_SCHEMA_VERSION, { now: NOW, newUid: uid });
});

async function contact(): Promise<number> {
  return (await exec.runAsync("INSERT INTO contacts (uid, name, interval_days, created_at, modified_at) VALUES (?, 'Alex', 30, ?, ?)", [uid(), NOW, NOW])).lastInsertRowId;
}

async function interaction(contactId: number, groupEventId: number | null): Promise<void> {
  await exec.runAsync(
    "INSERT INTO interactions (uid, contact_id, occurred_at, recorded_at, source, modified_at, group_event_id) VALUES (?, ?, ?, ?, 'manual', ?, ?)",
    [uid(), contactId, NOW, NOW, NOW, groupEventId],
  );
}

describe("migration 026 — approved additive group-event schema", () => {
  it("creates only the approved parent and child linkage columns", async () => {
    const version = await exec.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
    expect(version?.user_version).toBe(26);
    const groupColumns = await exec.getAllAsync<{ name: string }>("PRAGMA table_info(group_events)");
    expect(groupColumns.map((row) => row.name)).toEqual(["id", "uid", "title", "occurred_at", "channel", "quality", "duration", "group_note", "created_at", "modified_at"]);
    const interactionColumns = new Set((await exec.getAllAsync<{ name: string }>("PRAGMA table_info(interactions)")).map((row) => row.name));
    expect(["group_event_id", "ge_follow_channel", "ge_follow_quality", "ge_follow_duration"].every((name) => interactionColumns.has(name))).toBe(true);
    expect(interactionColumns.has("ge_follow_direction")).toBe(false);
    expect(interactionColumns.has("ge_follow_connected")).toBe(false);
  });

  it("indexes only real group memberships, not standalone rows", async () => {
    const c = await contact();
    await interaction(c, null);
    await interaction(c, null); // NULL memberships are excluded by the partial predicate.
    const event = (await exec.runAsync("INSERT INTO group_events (uid, title, occurred_at, created_at, modified_at) VALUES (?, 'Dinner', ?, ?, ?)", [uid(), NOW, NOW, NOW])).lastInsertRowId;
    await interaction(c, event);
    await expect(interaction(c, event)).rejects.toThrow();
  });

  it("documents that FK safety-net unlinking does not clear live-inheritance flags", async () => {
    const c = await contact();
    const event = (await exec.runAsync("INSERT INTO group_events (uid, title, occurred_at, created_at, modified_at) VALUES (?, 'Dinner', ?, ?, ?)", [uid(), NOW, NOW, NOW])).lastInsertRowId;
    await exec.runAsync("INSERT INTO interactions (uid, contact_id, occurred_at, recorded_at, source, modified_at, group_event_id, ge_follow_channel, ge_follow_quality, ge_follow_duration) VALUES (?, ?, ?, ?, 'manual', ?, ?, 1, 1, 1)", [uid(), c, NOW, NOW, NOW, event]);
    await exec.runAsync("DELETE FROM group_events WHERE id = ?", [event]);
    expect(await exec.getFirstAsync<{ group_event_id: number | null; ge_follow_channel: number }>("SELECT group_event_id, ge_follow_channel FROM interactions WHERE contact_id = ?", [c])).toEqual({ group_event_id: null, ge_follow_channel: 1 });
  });
});
