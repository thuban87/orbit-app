import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  addMemory,
  deleteMemory,
  editMemory,
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

  it("normalizes blank optionals to NULL and defaults provenance to user", async () => {
    const contactId = await seedContact();
    await addMemory(exec, {
      contactId,
      type: "general",
      value: "   ",
      note: "\t",
      url: "",
      customLabel: "\n",
      createdAt: NOW,
      now: NOW,
    });

    expect(await listMemoriesForContact(exec, contactId)).toEqual([
      expect.objectContaining({
        value: null,
        note: null,
        url: null,
        custom_label: null,
        provenance: "user",
      }),
    ]);
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
});
