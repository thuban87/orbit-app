import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { addMemory } from "@/db/memories-dao";
import {
  listAiEligibleMemories,
  listMemoriesForContact,
  listProfileVisibleMemoriesForContact,
  listRecentlyDeleted,
  resolveVisibility,
} from "@/db/memories-read";
import { MEMORY_TYPE_REGISTRY } from "@/db/memory-registry";
import { runMigrations } from "@/db/migrations/runner";
import type { ReadOnlyExecutor } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-04 12:00:00";
let exec: SqlExecutor;
let uidCounter = 0;

beforeEach(async () => {
  uidCounter = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: () => `migration-uid-${++uidCounter}`,
  });
});

async function seedContact(): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [`contact-${++uidCounter}`, "Alex", 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

describe("memories read", () => {
  it("accepts the structurally read-only snapshot executor", async () => {
    const contactId = await seedContact();
    const readOnly: ReadOnlyExecutor = {
      getFirstAsync: exec.getFirstAsync.bind(exec),
      getAllAsync: exec.getAllAsync.bind(exec),
    };
    expect(await listMemoriesForContact(readOnly, contactId)).toEqual([]);
  });
  it("keeps default-off Memories out of the explicit AI egress projection", async () => {
    const contactId = await seedContact();
    const memoryId = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Only after opt-in",
      createdAt: NOW,
      now: NOW,
    });

    expect(await listAiEligibleMemories(exec, contactId)).toEqual([]);
    await exec.runAsync("UPDATE memories SET allow_ai = 1 WHERE id = ?", [
      memoryId,
    ]);
    expect(
      (await listAiEligibleMemories(exec, contactId)).map((row) => row.id),
    ).toEqual([memoryId]);
    await exec.runAsync("UPDATE memories SET deleted_at = ? WHERE id = ?", [
      NOW,
      memoryId,
    ]);
    expect(await listAiEligibleMemories(exec, contactId)).toEqual([]);
  });

  it("resolves per-item overrides, registry defaults, and corrupt values defensively", () => {
    expect(resolveVisibility("general", 1)).toBe("hide");
    expect(resolveVisibility("general", 0)).toBe("show");
    expect(resolveVisibility("general", null)).toBe("show");
    expect(resolveVisibility("general", 2)).toBe("show");
    expect(resolveVisibility("bogus", null)).toBe("show");

    const original = MEMORY_TYPE_REGISTRY.general.visibilityDefault;
    MEMORY_TYPE_REGISTRY.general.visibilityDefault = "hide";
    try {
      expect(resolveVisibility("general", null)).toBe("hide");
      expect(resolveVisibility("general", -1)).toBe("hide");
    } finally {
      MEMORY_TYPE_REGISTRY.general.visibilityDefault = original;
    }
  });

  it("returns full metadata and filters hidden items without changing visible order", async () => {
    const contactId = await seedContact();
    const firstId = await addMemory(exec, {
      contactId,
      type: "general",
      value: "First visible",
      note: "Note",
      url: "https://example.test",
      meaningfulDate: "2026-01-01",
      provenance: "share",
      createdAt: NOW,
      now: NOW,
    });
    await addMemory(exec, {
      contactId,
      type: "general",
      value: "Hidden middle",
      hidden: true,
      meaningfulDate: "2026-01-01",
      createdAt: NOW,
      now: NOW,
    });
    const olderId = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Older visible",
      meaningfulDate: "2025-01-01",
      createdAt: NOW,
      now: NOW,
    });

    const rows = await listMemoriesForContact(exec, contactId);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.value)).toEqual([
      "Hidden middle",
      "First visible",
      "Older visible",
    ]);
    expect(rows[1]).toEqual(
      expect.objectContaining({
        id: firstId,
        note: "Note",
        url: "https://example.test",
        meaningful_date: "2026-01-01",
        pinned: 0,
        outdated: 0,
        hidden: null,
        provenance: "share",
        created_at: NOW,
        modified_at: NOW,
        deleted_at: null,
      }),
    );

    expect(
      (await listProfileVisibleMemoriesForContact(exec, contactId)).map(
        (row) => row.id,
      ),
    ).toEqual([firstId, olderId]);
  });

  it("lists only soft-deleted memories newest-first for one contact", async () => {
    const contactId = await seedContact();
    const otherContactId = await seedContact();
    const olderId = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Older deleted",
      createdAt: NOW,
      now: NOW,
    });
    const newerId = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Newer deleted",
      createdAt: NOW,
      now: NOW,
    });
    const liveId = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Live",
      createdAt: NOW,
      now: NOW,
    });
    const otherId = await addMemory(exec, {
      contactId: otherContactId,
      type: "general",
      value: "Other contact",
      createdAt: NOW,
      now: NOW,
    });

    await exec.runAsync("UPDATE memories SET deleted_at = ? WHERE id = ?", [
      "2026-09-03 12:00:00",
      olderId,
    ]);
    await exec.runAsync("UPDATE memories SET deleted_at = ? WHERE id = ?", [
      "2026-09-04 12:00:00",
      newerId,
    ]);
    await exec.runAsync("UPDATE memories SET deleted_at = ? WHERE id = ?", [
      "2026-09-04 13:00:00",
      otherId,
    ]);

    expect(
      (await listRecentlyDeleted(exec, contactId)).map((row) => row.id),
    ).toEqual([newerId, olderId]);
    expect(
      (await listRecentlyDeleted(exec, otherContactId)).map((row) => row.id),
    ).toEqual([otherId]);
    expect(
      (await listMemoriesForContact(exec, contactId)).map((row) => row.id),
    ).toEqual([liveId]);
  });
});
