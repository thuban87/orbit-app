import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { addMemory } from "@/db/memories-dao";
import { listKnowledgeSearchMemories } from "@/db/knowledge-search-read";
import { runMigrations } from "@/db/migrations/runner";
import { searchKnowledge } from "@/services/knowledge-search";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-04 12:00:00";
let exec: SqlExecutor;
let uidCounter = 0;

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `migration-${++uidCounter}`,
  });
});

async function seedContact(): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    ["alex", "Alex", 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

describe("knowledge search corpus read", () => {
  it("returns only live registry-searchable Memory text for TypeScript scoring", async () => {
    const contactId = await seedContact();
    const memoryId = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Climbing on Sundays",
      note: "Indoor wall",
      provenance: "share",
      createdAt: NOW,
      now: NOW,
    });
    await exec.runAsync(
      "UPDATE memories SET provenance = ? WHERE id = ?",
      ["internal-provenance-marker", memoryId],
    );
    const deletedId = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Deleted climbing item",
      createdAt: NOW,
      now: NOW,
    });
    await exec.runAsync("UPDATE memories SET deleted_at = ? WHERE id = ?", [NOW, deletedId]);

    const corpus = await listKnowledgeSearchMemories(exec, contactId);
    expect(corpus).toEqual([
      {
        custom_label: null,
        value: "Climbing on Sundays",
        note: "Indoor wall",
      },
    ]);
    expect(searchKnowledge(corpus, "climbing")).toEqual(corpus);
    expect(searchKnowledge(corpus, "internal-provenance-marker")).toEqual([]);
  });
});
