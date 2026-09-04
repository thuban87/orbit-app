import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  addMemory,
  deleteMemory,
  editMemory,
  expireMemoryIfStale,
  purgeMemoryPermanently,
  restoreMemory,
} from "@/db/memories-dao";
import { listMemoriesForContact } from "@/db/memories-read";
import { runMigrations } from "@/db/migrations/runner";
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

async function seedContact(name = "Alex"): Promise<number> {
  const result = await exec.runAsync(
    `INSERT INTO contacts (uid, name, interval_days, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?)`,
    [`contact-${++uidCounter}`, name, 30, NOW, NOW],
  );
  return result.lastInsertRowId;
}

describe("memories DAO", () => {
  it("marks manual permanent purges and successful stale expiry dirty for backup", async () => {
    const contactId = await seedContact();
    const id = await addMemory(exec, { contactId, type: "custom", customLabel: "Note", value: "Delete", createdAt: NOW, now: NOW });
    const uid = (await exec.getFirstAsync<{ uid: string }>("SELECT uid FROM memories WHERE id=?", [id]))!.uid;
    await deleteMemory(exec, { id, contactId, now: NOW });
    const beforePurge = (await exec.getFirstAsync<{ data_revision: number }>("SELECT data_revision FROM app_settings WHERE id=1"))!.data_revision;
    await purgeMemoryPermanently(exec, { id, contactId });
    await expect(exec.getFirstAsync<{ data_revision: number }>("SELECT data_revision FROM app_settings WHERE id=1")).resolves.toEqual({ data_revision: beforePurge + 1 });
    await expect(exec.getFirstAsync("SELECT entity_type,entity_uid,deleted_at FROM tombstones WHERE entity_type='memory' AND entity_uid=?", [uid])).resolves.toEqual({ entity_type: "memory", entity_uid: uid, deleted_at: NOW });

    const staleId = await addMemory(exec, { contactId, type: "custom", customLabel: "Note", value: "Stale", createdAt: NOW, now: NOW });
    const staleUid = (await exec.getFirstAsync<{ uid: string }>("SELECT uid FROM memories WHERE id=?", [staleId]))!.uid;
    await exec.runAsync("UPDATE memories SET deleted_at=datetime('now','localtime', ?) WHERE id=?", ["-31 days", staleId]);
    const beforeExpiry = (await exec.getFirstAsync<{ data_revision: number }>("SELECT data_revision FROM app_settings WHERE id=1"))!.data_revision;
    await expect(expireMemoryIfStale(exec, { id: staleId, contactId }, "-30 days", NOW)).resolves.toBe(true);
    await expect(exec.getFirstAsync<{ data_revision: number }>("SELECT data_revision FROM app_settings WHERE id=1")).resolves.toEqual({ data_revision: beforeExpiry + 1 });
    await expect(exec.getFirstAsync("SELECT entity_uid FROM tombstones WHERE entity_type='memory' AND entity_uid=?", [staleUid])).resolves.toEqual({ entity_uid: staleUid });
  });
  it("adds and reads distinct typed memories in deterministic order", async () => {
    const contactId = await seedContact();
    await addMemory(exec, {
      contactId,
      type: "general",
      value: "First memory",
      meaningfulDate: "2026-01-01",
      createdAt: NOW,
      now: NOW,
    });
    await addMemory(exec, {
      contactId,
      type: "general",
      value: "Pinned memory",
      pinned: true,
      meaningfulDate: "2025-01-01",
      createdAt: NOW,
      now: NOW,
    });

    const rows = await listMemoriesForContact(exec, contactId);
    expect(rows.map((row) => row.value)).toEqual(["Pinned memory", "First memory"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.uid).toBeTruthy();
  });

  it("rejects a wholly blank draft before any row is written", async () => {
    const contactId = await seedContact();
    await expect(addMemory(exec, {
      contactId,
      type: "general",
      value: "   ",
      note: "\t",
      url: "",
      customLabel: "\n",
      createdAt: NOW,
      now: NOW,
    })).rejects.toThrow("memory value or custom label is required");
    expect(await listMemoriesForContact(exec, contactId)).toEqual([]);
  });

  it("preserves multi-byte text and excludes memories belonging to other contacts", async () => {
    const alex = await seedContact("Alex");
    const blair = await seedContact("Blair");
    const value = "cafe\u0301 ☕️ 👨‍👩‍👧‍👦";
    await addMemory(exec, {
      contactId: alex,
      type: "general",
      value,
      createdAt: NOW,
      now: NOW,
    });
    await addMemory(exec, {
      contactId: blair,
      type: "general",
      value: "Blair only",
      createdAt: NOW,
      now: NOW,
    });

    expect((await listMemoriesForContact(exec, alex))[0]?.value).toBe(value);
  });

  it("rejects unregistered types and label-free custom memories before writing", async () => {
    const contactId = await seedContact();
    await expect(
      addMemory(exec, {
        contactId,
        type: "not_registered",
        value: "Nope",
        createdAt: NOW,
        now: NOW,
      }),
    ).rejects.toThrow("memories-dao: unregistered memory type");
    await expect(
      addMemory(exec, {
        contactId,
        type: "custom",
        customLabel: " \t",
        value: "No label",
        createdAt: NOW,
        now: NOW,
      }),
    ).rejects.toThrow("memories-dao: custom memory requires a label");
    expect(await listMemoriesForContact(exec, contactId)).toEqual([]);
  });

  it("patches only present metadata fields and normalizes blank optionals to NULL", async () => {
    const contactId = await seedContact();
    const id = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Original value",
      note: "Original note",
      url: "https://example.test/original",
      meaningfulDate: "2026-01-01",
      createdAt: NOW,
      now: NOW,
    });

    await editMemory(exec, {
      id,
      contactId,
      note: "Updated note",
      pinned: true,
      outdated: true,
      now: "2026-09-04 13:00:00",
    });
    await editMemory(exec, {
      id,
      contactId,
      note: " \t",
      url: "",
      meaningfulDate: "\n",
      now: "2026-09-04 14:00:00",
    });

    expect(await listMemoriesForContact(exec, contactId)).toEqual([
      expect.objectContaining({
        id,
        value: "Original value",
        note: null,
        url: null,
        meaningful_date: null,
        pinned: 1,
        outdated: 1,
        created_at: NOW,
        modified_at: "2026-09-04 14:00:00",
      }),
    ]);
  });

  it("rejects an edit that would make a general memory wholly blank", async () => {
    const contactId = await seedContact();
    const id = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Original value",
      createdAt: NOW,
      now: NOW,
    });

    await expect(
      editMemory(exec, {
        id,
        contactId,
        value: " \t",
        now: "2026-09-04 13:00:00",
      }),
    ).rejects.toThrow("memories-dao: memory value or custom label is required");

    await expect(
      exec.getFirstAsync<{ value: string | null; custom_label: string | null }>(
        "SELECT value,custom_label FROM memories WHERE id=?",
        [id],
      ),
    ).resolves.toEqual({ value: "Original value", custom_label: null });
  });

  it("rejects wrong-pair and invalid effective custom patches without changing the row", async () => {
    const contactId = await seedContact();
    const otherContactId = await seedContact("Blair");
    const id = await addMemory(exec, {
      contactId,
      type: "custom",
      customLabel: "Nickname",
      value: "Ace",
      createdAt: NOW,
      now: NOW,
    });

    await expect(
      editMemory(exec, {
        id,
        contactId: otherContactId,
        value: "Wrong contact",
        now: "2026-09-04 13:00:00",
      }),
    ).rejects.toThrow("editMemory: no memory matched");
    await expect(
      editMemory(exec, {
        id,
        contactId,
        type: "not_registered",
        now: "2026-09-04 13:00:00",
      }),
    ).rejects.toThrow("memories-dao: unregistered memory type");
    await expect(
      editMemory(exec, {
        id,
        contactId,
        customLabel: "  ",
        now: "2026-09-04 13:00:00",
      }),
    ).rejects.toThrow("memories-dao: custom memory requires a label");

    expect(await listMemoriesForContact(exec, contactId)).toEqual([
      expect.objectContaining({
        id,
        type: "custom",
        custom_label: "Nickname",
        value: "Ace",
      }),
    ]);
  });

  it("soft-deletes and restores a memory without physically removing its row", async () => {
    const contactId = await seedContact();
    const id = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Keep me",
      createdAt: NOW,
      now: NOW,
    });

    await deleteMemory(exec, {
      id,
      contactId,
      now: "2026-09-04 13:00:00",
    });

    expect(await listMemoriesForContact(exec, contactId)).toEqual([]);
    expect(
      await exec.getFirstAsync<{ deleted_at: string | null }>(
        "SELECT deleted_at FROM memories WHERE id = ? AND contact_id = ?",
        [id, contactId],
      ),
    ).toEqual({ deleted_at: "2026-09-04 13:00:00" });

    await restoreMemory(exec, {
      id,
      contactId,
      now: "2026-09-04 14:00:00",
    });

    expect(await listMemoriesForContact(exec, contactId)).toEqual([
      expect.objectContaining({ id, value: "Keep me" }),
    ]);
  });

  it("permanently purges only an already soft-deleted memory", async () => {
    const contactId = await seedContact();
    const liveId = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Live",
      createdAt: NOW,
      now: NOW,
    });
    const deletedId = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Deleted",
      createdAt: NOW,
      now: NOW,
    });
    await deleteMemory(exec, {
      id: deletedId,
      contactId,
      now: "2026-09-04 13:00:00",
    });

    await expect(
      purgeMemoryPermanently(exec, { id: liveId, contactId }),
    ).rejects.toThrow("purgeMemoryPermanently: no memory matched");
    await purgeMemoryPermanently(exec, { id: deletedId, contactId });

    expect(
      await exec.getFirstAsync("SELECT id FROM memories WHERE id = ?", [liveId]),
    ).toEqual({ id: liveId });
    expect(
      await exec.getFirstAsync("SELECT id FROM memories WHERE id = ?", [deletedId]),
    ).toBeNull();
  });

  it("expires only a still-stale soft-deleted memory under the write lock", async () => {
    const contactId = await seedContact();
    const staleId = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Stale",
      createdAt: NOW,
      now: NOW,
    });
    const recentId = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Recent",
      createdAt: NOW,
      now: NOW,
    });
    const reDeletedId = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Freshly re-deleted",
      createdAt: NOW,
      now: NOW,
    });
    for (const [id, offset] of [
      [staleId, "-31 days"],
      [recentId, "-29 days"],
      [reDeletedId, "-1 days"],
    ] as const) {
      await exec.runAsync(
        "UPDATE memories SET deleted_at = datetime('now', 'localtime', ?) WHERE id = ?",
        [offset, id],
      );
    }

    await expect(
      expireMemoryIfStale(exec, { id: staleId, contactId }, "-30 days", NOW),
    ).resolves.toBe(true);
    await expect(
      expireMemoryIfStale(exec, { id: recentId, contactId }, "-30 days", NOW),
    ).resolves.toBe(false);
    await expect(
      expireMemoryIfStale(exec, { id: reDeletedId, contactId }, "-30 days", NOW),
    ).resolves.toBe(false);

    expect(
      await exec.getFirstAsync("SELECT id FROM memories WHERE id = ?", [staleId]),
    ).toBeNull();
    expect(
      await exec.getFirstAsync("SELECT id FROM memories WHERE id = ?", [recentId]),
    ).toEqual({ id: recentId });
    expect(
      await exec.getFirstAsync("SELECT id FROM memories WHERE id = ?", [reDeletedId]),
    ).toEqual({ id: reDeletedId });
  });
});
