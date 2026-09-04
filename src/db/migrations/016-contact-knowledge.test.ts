import { describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-04 12:00:00";

function createExecutor(): SqlExecutor {
  return nodeSqliteExecutor(openTestDb());
}

async function migrateTo16(exec: SqlExecutor): Promise<void> {
  let counter = 0;
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `uid-${++counter}`,
  });
}

async function seedContact(exec: SqlExecutor, uid: string): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [uid, "Alex", 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

describe("migration 016 — contact knowledge schema", () => {
  it.each(Array.from({ length: 16 }, (_, version) => version))(
    "upgrades a genuine v%i database to v16",
    async (priorVersion) => {
      const exec = createExecutor();
      let counter = 0;
      const deps = { now: NOW, newUid: () => `uid-${++counter}` };

      await runMigrations(exec, MIGRATIONS, priorVersion, deps);
      expect(
        await exec.getFirstAsync<{ user_version: number }>("PRAGMA user_version"),
      ).toEqual({ user_version: priorVersion });

      await runMigrations(exec, MIGRATIONS, 16, deps);
      expect(
        await exec.getFirstAsync<{ user_version: number }>("PRAGMA user_version"),
      ).toEqual({ user_version: 16 });
      for (const name of ["memories", "relationships", "current_state_entries"]) {
        expect(
          await exec.getFirstAsync<{ name: string }>(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
            [name],
          ),
        ).toEqual({ name });
      }
    },
  );

  it("creates the prescribed columns and additive read indexes", async () => {
    const exec = createExecutor();
    await migrateTo16(exec);

    const expectedColumns = {
      memories: [
        "id", "uid", "contact_id", "type", "custom_label", "value", "note", "url",
        "meaningful_date", "pinned", "outdated", "hidden", "provenance", "created_at",
        "modified_at", "deleted_at",
      ],
      relationships: [
        "id", "uid", "contact_id", "person_name", "relation_type", "linked_contact_id",
        "note", "pinned", "hidden", "created_at", "modified_at", "deleted_at",
      ],
      current_state_entries: [
        "id", "uid", "contact_id", "field_key", "value", "is_current", "created_at",
        "modified_at",
      ],
    } as const;

    for (const [table, columns] of Object.entries(expectedColumns)) {
      expect(
        (await exec.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).map(
          (column) => column.name,
        ),
      ).toEqual(columns);
    }

    const memoriesIndexes = await exec.getAllAsync<{ name: string }>("PRAGMA index_list(memories)");
    const relationshipIndexes = await exec.getAllAsync<{ name: string }>("PRAGMA index_list(relationships)");
    const currentStateIndexes = await exec.getAllAsync<{ name: string }>("PRAGMA index_list(current_state_entries)");
    expect(memoriesIndexes.map((index) => index.name)).toContain("idx_memories_contact_deleted");
    expect(relationshipIndexes.map((index) => index.name)).toContain("idx_relationships_contact_deleted");
    expect(currentStateIndexes.map((index) => index.name)).toEqual(
      expect.arrayContaining(["idx_current_state_current", "idx_current_state_history"]),
    );
    for (const table of [
      "contacts",
      "fuel",
      "custom_field_defs",
      "custom_field_values",
      "field_history",
      "tombstones",
      "app_settings",
    ]) {
      expect(
        await exec.getFirstAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
          [table],
        ),
      ).toEqual({ name: table });
    }
  });

  it("enforces knowledge-row identity, history cardinality, links, and self-link safety", async () => {
    const exec = createExecutor();
    await migrateTo16(exec);
    const alex = await seedContact(exec, "alex");
    const blair = await seedContact(exec, "blair");

    await exec.runAsync(
      `INSERT INTO memories (uid, contact_id, type, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?)`,
      ["memory-1", alex, "general", NOW, NOW],
    );
    await expect(
      Promise.resolve().then(() => exec.runAsync(
        `INSERT INTO memories (uid, contact_id, type, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?)`,
        ["memory-1", alex, "general", NOW, NOW],
      )),
    ).rejects.toThrow();

    await exec.runAsync(
      `INSERT INTO relationships (uid, contact_id, person_name, linked_contact_id, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["relationship-1", alex, "Blair", blair, NOW, NOW],
    );
    await expect(
      Promise.resolve().then(() => exec.runAsync(
        `INSERT INTO relationships (uid, contact_id, person_name, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?)`,
        ["relationship-1", alex, "Duplicate", NOW, NOW],
      )),
    ).rejects.toThrow();
    await expect(
      Promise.resolve().then(() => exec.runAsync(
        `INSERT INTO relationships (uid, contact_id, person_name, linked_contact_id, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ["relationship-self", alex, "Self", alex, NOW, NOW],
      )),
    ).rejects.toThrow();
    await expect(
      Promise.resolve().then(() => exec.runAsync(
        "UPDATE relationships SET linked_contact_id = contact_id WHERE uid = ?",
        ["relationship-1"],
      )),
    ).rejects.toThrow();
    await exec.runAsync(
      `INSERT INTO relationships (uid, contact_id, person_name, linked_contact_id, created_at, modified_at)
       VALUES (?, ?, ?, NULL, ?, ?)`,
      ["relationship-null", alex, "No link", NOW, NOW],
    );

    await exec.runAsync(
      `INSERT INTO current_state_entries (uid, contact_id, field_key, value, is_current, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ["state-1", alex, "current_location", "Austin", 1, NOW, NOW],
    );
    await expect(
      Promise.resolve().then(() => exec.runAsync(
        `INSERT INTO current_state_entries (uid, contact_id, field_key, value, is_current, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ["state-2", alex, "current_location", "Chicago", 1, NOW, NOW],
      )),
    ).rejects.toThrow();
    await exec.runAsync(
      `INSERT INTO current_state_entries (uid, contact_id, field_key, value, is_current, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ["state-2", alex, "current_location", "Chicago", 0, NOW, NOW],
    );
    await expect(
      Promise.resolve().then(() => exec.runAsync(
        `INSERT INTO current_state_entries (uid, contact_id, field_key, value, is_current, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ["state-2", alex, "last_talked_about", "Travel", 0, NOW, NOW],
      )),
    ).rejects.toThrow();

    await exec.runAsync("DELETE FROM contacts WHERE id = ?", [blair]);
    expect(
      await exec.getFirstAsync<{ linked_contact_id: number | null }>(
        "SELECT linked_contact_id FROM relationships WHERE uid = ?",
        ["relationship-1"],
      ),
    ).toEqual({ linked_contact_id: null });
    await exec.runAsync("DELETE FROM contacts WHERE id = ?", [alex]);
    for (const table of ["memories", "relationships", "current_state_entries"]) {
      expect(
        await exec.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`),
      ).toEqual({ count: 0 });
    }
  });

  it("uses the contact/deleted and history indexes for their recurring queries", async () => {
    const exec = createExecutor();
    await migrateTo16(exec);
    const contactId = await seedContact(exec, "planner-contact");
    const plan = await exec.getAllAsync<{ detail: string }>(
      "EXPLAIN QUERY PLAN SELECT * FROM memories WHERE contact_id = ? AND deleted_at IS NULL ORDER BY id",
      [contactId],
    );
    expect(plan.map((row) => row.detail).join(" ")).toContain("idx_memories_contact_deleted");
    const relationshipPlan = await exec.getAllAsync<{ detail: string }>(
      "EXPLAIN QUERY PLAN SELECT * FROM relationships WHERE contact_id = ? AND deleted_at IS NULL ORDER BY id",
      [contactId],
    );
    expect(relationshipPlan.map((row) => row.detail).join(" ")).toContain(
      "idx_relationships_contact_deleted",
    );
    const historyPlan = await exec.getAllAsync<{ detail: string }>(
      "EXPLAIN QUERY PLAN SELECT * FROM current_state_entries WHERE contact_id = ? AND field_key = ? ORDER BY id",
      [contactId, "current_location"],
    );
    expect(historyPlan.map((row) => row.detail).join(" ")).toContain("idx_current_state_history");
  });
});
