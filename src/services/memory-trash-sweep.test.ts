import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { addMemory } from "@/db/memories-dao";
import { addRelationship } from "@/db/relationships-dao";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";
import { registerMemoryTrashSweep } from "@/services/memory-trash-sweep";
import {
  __resetSweepForTest,
  runLaunchSweep,
} from "@/services/launch-sweep";

const NOW = "2026-09-04 12:00:00";
let exec: SqlExecutor;
let uidCounter = 0;

beforeEach(async () => {
  uidCounter = 0;
  __resetSweepForTest();
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `migration-uid-${++uidCounter}`,
  });
});

afterEach(() => __resetSweepForTest());

async function seedContact(name = "Alex"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [`contact-${++uidCounter}`, name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

async function seedMemory(contactId: number, value: string): Promise<number> {
  return addMemory(exec, {
    contactId,
    type: "general",
    value,
    createdAt: NOW,
    now: NOW,
  });
}

async function seedRelationship(contactId: number, personName: string): Promise<number> {
  return addRelationship(exec, {
    contactId,
    personName,
    createdAt: NOW,
    now: NOW,
  });
}

async function ageMemory(id: number, offset: string): Promise<void> {
  await exec.runAsync(
    "UPDATE memories SET deleted_at = datetime('now', 'localtime', ?) WHERE id = ?",
    [offset, id],
  );
}

async function ageRelationship(id: number, offset: string): Promise<void> {
  await exec.runAsync(
    "UPDATE relationships SET deleted_at = datetime('now', 'localtime', ?) WHERE id = ?",
    [offset, id],
  );
}

async function rowExists(table: "memories" | "relationships", id: number): Promise<boolean> {
  return (
    (await exec.getFirstAsync<{ id: number }>(
      `SELECT id FROM ${table} WHERE id = ?`,
      [id],
    )) !== null
  );
}

describe("memory trash sweep", () => {
  it("expires only past-window memories and relationships, retaining under-window rows on rerun", async () => {
    const contactId = await seedContact();
    const staleMemory = await seedMemory(contactId, "Stale memory");
    const recentMemory = await seedMemory(contactId, "Recent memory");
    const edgeMemory = await seedMemory(contactId, "Edge memory");
    const staleRelationship = await seedRelationship(contactId, "Stale relationship");
    const recentRelationship = await seedRelationship(contactId, "Recent relationship");
    await ageMemory(staleMemory, "-31 days");
    await ageMemory(recentMemory, "-29 days");
    // SQLite evaluates its wall clock separately from this setup query. Keep
    // the retained row safely inside the strict window rather than racing the
    // next-second boundary of an exact 30-day timestamp.
    await ageMemory(edgeMemory, "-29 days");
    await ageRelationship(staleRelationship, "-31 days");
    await ageRelationship(recentRelationship, "-29 days");

    registerMemoryTrashSweep(() => exec, () => NOW);
    await runLaunchSweep();

    expect(await rowExists("memories", staleMemory)).toBe(false);
    expect(await rowExists("memories", recentMemory)).toBe(true);
    expect(await rowExists("memories", edgeMemory)).toBe(true);
    expect(await rowExists("relationships", staleRelationship)).toBe(false);
    expect(await rowExists("relationships", recentRelationship)).toBe(true);

    await runLaunchSweep();
    expect(await rowExists("memories", recentMemory)).toBe(true);
    expect(await rowExists("relationships", recentRelationship)).toBe(true);
  });

  it("keeps rows restored or freshly re-deleted after candidate discovery", async () => {
    const contactId = await seedContact();
    const restoredMemory = await seedMemory(contactId, "Restored memory");
    const freshlyRedelMemory = await seedMemory(contactId, "Fresh memory");
    const freshlyRedelRelationship = await seedRelationship(contactId, "Fresh relationship");
    await ageMemory(restoredMemory, "-31 days");
    await ageMemory(freshlyRedelMemory, "-31 days");
    await ageRelationship(freshlyRedelRelationship, "-31 days");

    const proxy: SqlExecutor = {
      execAsync: (sql) => exec.execAsync(sql),
      runAsync: (sql, params) => exec.runAsync(sql, params),
      getFirstAsync: <T>(sql: string, params?: unknown[]) =>
        exec.getFirstAsync<T>(sql, params),
      async getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]> {
        const rows = await exec.getAllAsync<T>(sql, params);
        if (/FROM memories/.test(sql) && /deleted_at/.test(sql)) {
          await exec.runAsync("UPDATE memories SET deleted_at = NULL WHERE id = ?", [
            restoredMemory,
          ]);
          await exec.runAsync(
            "UPDATE memories SET deleted_at = datetime('now', 'localtime', ?) WHERE id = ?",
            ["-1 days", freshlyRedelMemory],
          );
        }
        if (/FROM relationships/.test(sql) && /deleted_at/.test(sql)) {
          await exec.runAsync(
            "UPDATE relationships SET deleted_at = datetime('now', 'localtime', ?) WHERE id = ?",
            ["-1 days", freshlyRedelRelationship],
          );
        }
        return rows;
      },
    };

    registerMemoryTrashSweep(() => proxy, () => NOW);
    await runLaunchSweep();

    expect(await rowExists("memories", restoredMemory)).toBe(true);
    expect(await rowExists("memories", freshlyRedelMemory)).toBe(true);
    expect(await rowExists("relationships", freshlyRedelRelationship)).toBe(true);
  });
});
