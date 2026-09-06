import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("expo-sqlite", () => ({}));
import {
  bulkAddFavourites,
  bulkArchive,
  bulkQuickLog,
  bulkRemoveFavourites,
  bulkSetCategory,
  bulkSetFrequency,
  bulkSnooze,
  bulkUnsnooze,
  undoBulkQuickLog,
} from "@/db/bulk-actions-dao";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { createContactFull } from "@/db/contacts-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-06 12:00:00";
let uidCounter = 0;
const uid = () => `bulk-uid-${++uidCounter}`;
let exec: SqlExecutor;

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
    defaultPhoneRegion: "US",
  });
});

async function seedContact(name: string, rarelyResponds = 0): Promise<number> {
  const { contactId } = await createContactFull(exec, {
    uid: uid(),
    name,
    intervalDays: 14,
    rarelyResponds,
    now: NOW,
  });
  return contactId;
}

async function count(table: "interactions" | "events" | "tombstones"): Promise<number> {
  const row = await exec.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
  return row?.n ?? 0;
}

async function lastContact(contactId: number): Promise<string | null> {
  const row = await exec.getFirstAsync<{ last_contact: string | null }>(
    "SELECT last_contact FROM contacts WHERE id = ?",
    [contactId],
  );
  return row?.last_contact ?? null;
}

describe("bulkQuickLog", () => {
  it("records one canonical outbound interaction and a receipt per contact", async () => {
    const ids = await Promise.all([seedContact("A"), seedContact("B")]);

    const receipt = await bulkQuickLog(exec, ids, NOW);

    expect(receipt.map((entry) => entry.contactId)).toEqual(ids);
    expect(await exec.getAllAsync(
      "SELECT contact_id, channel, direction, connected, quality, source FROM interactions ORDER BY contact_id",
    )).toEqual([
      { contact_id: ids[0], channel: "unspecified", direction: "outbound", connected: 1, quality: null, source: "manual" },
      { contact_id: ids[1], channel: "unspecified", direction: "outbound", connected: 1, quality: null, source: "manual" },
    ]);
    expect(await Promise.all(ids.map(lastContact))).toEqual([NOW, NOW]);
  });

  it("advances recency for a rarely-responding contact because the log is connected", async () => {
    const contactId = await seedContact("Responds", 1);
    await bulkQuickLog(exec, [contactId], NOW);
    expect(await lastContact(contactId)).toBe(NOW);
  });

  it("rejects malformed current-time input before it opens a write transaction", async () => {
    const contactId = await seedContact("Guarded");
    await expect(bulkQuickLog(exec, [contactId], "not-a-local-time")).rejects.toThrow(
      /valid local/,
    );
    expect(await count("interactions")).toBe(0);
  });

  it("undoes only the receipt rows, restores prior recency, and writes tombstones", async () => {
    const contactId = await seedContact("Undo");
    await exec.runAsync(
      `INSERT INTO interactions
         (uid, contact_id, occurred_at, recorded_at, channel, connected, source, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uid(), contactId, "2026-09-01 10:00:00", NOW, "call", 1, "manual", NOW],
    );
    await exec.runAsync("UPDATE contacts SET last_contact = ? WHERE id = ?", [
      "2026-09-01 10:00:00",
      contactId,
    ]);

    const receipt = await bulkQuickLog(exec, [contactId], NOW);
    await undoBulkQuickLog(exec, receipt, NOW);

    expect(await count("interactions")).toBe(1);
    expect(await lastContact(contactId)).toBe("2026-09-01 10:00:00");
    expect(await count("tombstones")).toBe(1);
  });

  it("rolls all undo rows back when one receipt item no longer matches", async () => {
    const ids = await Promise.all([seedContact("A"), seedContact("B")]);
    const receipt = await bulkQuickLog(exec, ids, NOW);
    await expect(
      undoBulkQuickLog(exec, [receipt[0], { contactId: ids[1], interactionId: 9999 }], NOW),
    ).rejects.toThrow(/no interaction matched/);
    expect(await count("interactions")).toBe(2);
    expect(await count("tombstones")).toBe(0);
  });
});

describe("other bulk action composers", () => {
  it("archives all selected contacts with audit events and rolls back a mixed-invalid batch", async () => {
    const a = await seedContact("A");
    const b = await seedContact("B");
    await bulkArchive(exec, [a, b], NOW);
    expect(await exec.getAllAsync("SELECT contact_id, type FROM events ORDER BY contact_id")).toEqual([
      { contact_id: a, type: "archive" },
      { contact_id: b, type: "archive" },
    ]);

    const c = await seedContact("C");
    await expect(bulkArchive(exec, [c, a], NOW)).rejects.toThrow(/no live contact/);
    expect(await exec.getFirstAsync<{ archived_at: string | null }>(
      "SELECT archived_at FROM contacts WHERE id = ?",
      [c],
    )).toEqual({ archived_at: null });
    expect(await count("events")).toBe(2);
  });

  it("adds and removes favourite membership without a toggle path", async () => {
    const ids = await Promise.all([seedContact("A"), seedContact("B")]);
    await bulkAddFavourites(exec, ids, NOW);
    await bulkAddFavourites(exec, ids, NOW);
    expect(await exec.getAllAsync("SELECT favourite_rank FROM contacts ORDER BY id")).toEqual([
      { favourite_rank: expect.any(Number) },
      { favourite_rank: expect.any(Number) },
    ]);
    await bulkRemoveFavourites(exec, ids, NOW);
    expect(await exec.getAllAsync("SELECT favourite_rank FROM contacts ORDER BY id")).toEqual([
      { favourite_rank: null },
      { favourite_rank: null },
    ]);
  });

  it("snoozes and unsnoozes with one immutable event per contact", async () => {
    const ids = await Promise.all([seedContact("A"), seedContact("B")]);
    await bulkSnooze(exec, ids, "1w", NOW);
    expect(await exec.getAllAsync("SELECT snooze_until FROM contacts ORDER BY id")).toEqual([
      { snooze_until: expect.any(String) },
      { snooze_until: expect.any(String) },
    ]);
    await bulkUnsnooze(exec, ids, NOW);
    expect(await exec.getAllAsync("SELECT snooze_until FROM contacts ORDER BY id")).toEqual([
      { snooze_until: null },
      { snooze_until: null },
    ]);
    expect(await exec.getAllAsync("SELECT type FROM events ORDER BY id")).toEqual([
      { type: "snooze" }, { type: "snooze" }, { type: "unsnooze" }, { type: "unsnooze" },
    ]);
  });

  it("resolves one local snooze target for an entire bulk batch", async () => {
    const ids = await Promise.all([seedContact("A"), seedContact("B")]);
    const originalGetFirst = exec.getFirstAsync.bind(exec);
    let resolverCalls = 0;
    const resolvingExec: SqlExecutor = {
      ...exec,
      getFirstAsync: async <T>(sql: string, params?: unknown[]) => {
        if (sql === "SELECT date('now','localtime', ?) AS until") {
          resolverCalls += 1;
          return { until: resolverCalls === 1 ? "2026-09-13" : "2026-09-14" } as T;
        }
        return originalGetFirst<T>(sql, params);
      },
    };

    await bulkSnooze(resolvingExec, ids, "1w", NOW);

    expect(resolverCalls).toBe(1);
    expect(await exec.getAllAsync("SELECT snooze_until FROM contacts ORDER BY id")).toEqual([
      { snooze_until: "2026-09-13" },
      { snooze_until: "2026-09-13" },
    ]);
    expect(await exec.getAllAsync("SELECT type FROM events ORDER BY id")).toEqual([
      { type: "snooze" },
      { type: "snooze" },
    ]);
  });

  it("updates only category and validates positive integer frequencies", async () => {
    const contactId = await seedContact("Unchanged");
    await exec.runAsync("UPDATE contacts SET social_battery = ? WHERE id = ?", ["high", contactId]);
    await bulkSetCategory(exec, [contactId], 2, NOW);
    expect(await exec.getFirstAsync(
      "SELECT name, category_id, interval_days, social_battery FROM contacts WHERE id = ?",
      [contactId],
    )).toEqual({ name: "Unchanged", category_id: 2, interval_days: 14, social_battery: "high" });

    for (const intervalDays of [0, -1, 1.5]) {
      await expect(bulkSetFrequency(exec, [contactId], intervalDays, NOW)).rejects.toThrow(
        /positive integer/,
      );
    }
    expect(await exec.getFirstAsync("SELECT interval_days FROM contacts WHERE id = ?", [contactId]))
      .toEqual({ interval_days: 14 });
    await bulkSetFrequency(exec, [contactId], 1, NOW);
    expect(await exec.getFirstAsync("SELECT interval_days FROM contacts WHERE id = ?", [contactId]))
      .toEqual({ interval_days: 1 });
  });

  it("does no writes for empty selections and returns an empty quick-log receipt", async () => {
    const before = {
      interactions: await count("interactions"),
      events: await count("events"),
    };
    await expect(bulkQuickLog(exec, [], NOW)).resolves.toEqual([]);
    await Promise.all([
      undoBulkQuickLog(exec, [], NOW),
      bulkArchive(exec, [], NOW),
      bulkAddFavourites(exec, [], NOW),
      bulkRemoveFavourites(exec, [], NOW),
      bulkSnooze(exec, [], "1w", NOW),
      bulkUnsnooze(exec, [], NOW),
      bulkSetCategory(exec, [], 2, NOW),
      bulkSetFrequency(exec, [], 1, NOW),
    ]);
    expect({ interactions: await count("interactions"), events: await count("events") }).toEqual(before);
  });
});
