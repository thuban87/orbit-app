import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { compareRowAndTombstone } from "@/backup/reconciliation";
import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import { setAiPermissionDefault } from "@/db/ai-permissions-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import {
  addMemory,
  addMemoryCore,
  deleteMemory,
  deleteMemoryNow,
  deleteMemoryNowCore,
  editMemory,
  expireMemoryIfStale,
  ImportedTypeProvenanceError,
  purgeMemoryPermanently,
  restoreMemory,
  setMemoryAllowAi,
  undoMemoryDelete,
} from "@/db/memories-dao";
import {
  listAiEligibleMemories,
  listMemoriesForContact,
} from "@/db/memories-read";
import { runMigrations } from "@/db/migrations/runner";
import { inWriteTransaction } from "@/db/transaction";
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
  it("keeps a new import-provenance imported note AI-off under an ON default", async () => {
    const contactId = await seedContact();
    await setAiPermissionDefault(exec, "memory", 1, NOW);
    const imported = await addMemory(exec, {
      contactId,
      type: "imported",
      provenance: "import",
      value: "Third-party note",
      createdAt: NOW,
      now: NOW,
    });
    expect(
      await exec.getFirstAsync<{ allow_ai: number }>(
        "SELECT allow_ai FROM memories WHERE id = ?",
        [imported],
      ),
    ).toEqual({ allow_ai: 0 });
  });

  it("refuses type imported with any provenance but import, writing nothing (D-35, G-D5)", async () => {
    const contactId = await seedContact();
    await setAiPermissionDefault(exec, "memory", 1, NOW);
    for (const provenance of ["user", "share", undefined] as const) {
      await expect(
        addMemory(exec, {
          contactId,
          type: "imported",
          provenance,
          value: "My note",
          createdAt: NOW,
          now: NOW,
        }),
      ).rejects.toBeInstanceOf(ImportedTypeProvenanceError);
    }
    expect(await listMemoriesForContact(exec, contactId)).toEqual([]);
  });

  it("applies the durable Memory default only to rows created afterward", async () => {
    const contactId = await seedContact();
    const first = await addMemory(exec, {
      contactId,
      type: "general",
      value: "First",
      createdAt: NOW,
      now: NOW,
    });
    await setAiPermissionDefault(exec, "memory", 1, "2026-09-04 12:05:00");
    const second = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Second",
      createdAt: NOW,
      now: NOW,
    });

    await expect(
      exec.getAllAsync(
        "SELECT id,allow_ai FROM memories WHERE id IN (?,?) ORDER BY id",
        [first, second],
      ),
    ).resolves.toEqual([
      { id: first, allow_ai: 0 },
      { id: second, allow_ai: 1 },
    ]);
  });

  it("seeds AI permission off and toggles it only for the matching contact", async () => {
    const contactId = await seedContact();
    const otherContactId = await seedContact("Blair");
    const id = await addMemory(exec, {
      contactId,
      type: "general",
      value: "A private memory",
      createdAt: NOW,
      now: NOW,
    });

    await expect(
      exec.getFirstAsync<{ allow_ai: number }>(
        "SELECT allow_ai FROM memories WHERE id = ?",
        [id],
      ),
    ).resolves.toEqual({ allow_ai: 0 });

    const before = (await exec.getFirstAsync<{ data_revision: number }>(
      "SELECT data_revision FROM app_settings WHERE id = 1",
    ))!.data_revision;
    await setMemoryAllowAi(exec, {
      id,
      contactId,
      allow: true,
      now: "2026-09-04 13:00:00",
    });
    await expect(
      exec.getFirstAsync<{ allow_ai: number; modified_at: string }>(
        "SELECT allow_ai, modified_at FROM memories WHERE id = ? AND contact_id = ?",
        [id, contactId],
      ),
    ).resolves.toEqual({ allow_ai: 1, modified_at: "2026-09-04 13:00:00" });
    await expect(
      exec.getFirstAsync<{ data_revision: number }>(
        "SELECT data_revision FROM app_settings WHERE id = 1",
      ),
    ).resolves.toEqual({ data_revision: before + 1 });

    await expect(
      setMemoryAllowAi(exec, {
        id,
        contactId: otherContactId,
        allow: false,
        now: "2026-09-04 14:00:00",
      }),
    ).rejects.toThrow("setMemoryAllowAi: no memory matched");
    await expect(
      exec.getFirstAsync<{ allow_ai: number; modified_at: string }>(
        "SELECT allow_ai, modified_at FROM memories WHERE id = ? AND contact_id = ?",
        [id, contactId],
      ),
    ).resolves.toEqual({ allow_ai: 1, modified_at: "2026-09-04 13:00:00" });
  });

  it("marks manual permanent purges and successful stale expiry dirty for backup", async () => {
    const contactId = await seedContact();
    const id = await addMemory(exec, {
      contactId,
      type: "general",
      customLabel: "Note",
      value: "Delete",
      createdAt: NOW,
      now: NOW,
    });
    const uid = (await exec.getFirstAsync<{ uid: string }>(
      "SELECT uid FROM memories WHERE id=?",
      [id],
    ))!.uid;
    await deleteMemory(exec, { id, contactId, now: NOW });
    const beforePurge = (await exec.getFirstAsync<{ data_revision: number }>(
      "SELECT data_revision FROM app_settings WHERE id=1",
    ))!.data_revision;
    await purgeMemoryPermanently(exec, { id, contactId });
    await expect(
      exec.getFirstAsync<{ data_revision: number }>(
        "SELECT data_revision FROM app_settings WHERE id=1",
      ),
    ).resolves.toEqual({ data_revision: beforePurge + 1 });
    await expect(
      exec.getFirstAsync(
        "SELECT entity_type,entity_uid,deleted_at FROM tombstones WHERE entity_type='memory' AND entity_uid=?",
        [uid],
      ),
    ).resolves.toEqual({
      entity_type: "memory",
      entity_uid: uid,
      deleted_at: NOW,
    });

    const staleId = await addMemory(exec, {
      contactId,
      type: "general",
      customLabel: "Note",
      value: "Stale",
      createdAt: NOW,
      now: NOW,
    });
    const staleUid = (await exec.getFirstAsync<{ uid: string }>(
      "SELECT uid FROM memories WHERE id=?",
      [staleId],
    ))!.uid;
    await exec.runAsync(
      "UPDATE memories SET deleted_at=datetime('now','localtime', ?) WHERE id=?",
      ["-31 days", staleId],
    );
    const beforeExpiry = (await exec.getFirstAsync<{ data_revision: number }>(
      "SELECT data_revision FROM app_settings WHERE id=1",
    ))!.data_revision;
    await expect(
      expireMemoryIfStale(exec, { id: staleId, contactId }, "-30 days", NOW),
    ).resolves.toBe(true);
    await expect(
      exec.getFirstAsync<{ data_revision: number }>(
        "SELECT data_revision FROM app_settings WHERE id=1",
      ),
    ).resolves.toEqual({ data_revision: beforeExpiry + 1 });
    await expect(
      exec.getFirstAsync(
        "SELECT entity_uid FROM tombstones WHERE entity_type='memory' AND entity_uid=?",
        [staleUid],
      ),
    ).resolves.toEqual({ entity_uid: staleUid });
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
    expect(rows.map((row) => row.value)).toEqual([
      "Pinned memory",
      "First memory",
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.uid).toBeTruthy();
  });

  it("rejects a wholly blank draft before any row is written", async () => {
    const contactId = await seedContact();
    await expect(
      addMemory(exec, {
        contactId,
        type: "general",
        value: "   ",
        note: "\t",
        url: "",
        customLabel: "\n",
        createdAt: NOW,
        now: NOW,
      }),
    ).rejects.toThrow("memory value or custom label is required");
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

  it("rejects unregistered types, including the retired custom type, before writing (D-86)", async () => {
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
        customLabel: "Has a label",
        value: "Retired type",
        createdAt: NOW,
        now: NOW,
      }),
    ).rejects.toThrow("memories-dao: unregistered memory type");
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
        hidden: null,
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

  it("rejects wrong-pair and invalid patches without changing the row; a label may be cleared while a value remains (D-86)", async () => {
    const contactId = await seedContact();
    const otherContactId = await seedContact("Blair");
    const id = await addMemory(exec, {
      contactId,
      type: "gift_idea",
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
        type: "custom",
        now: "2026-09-04 13:00:00",
      }),
    ).rejects.toThrow("memories-dao: unregistered memory type");

    expect(await listMemoriesForContact(exec, contactId)).toEqual([
      expect.objectContaining({
        id,
        type: "gift_idea",
        custom_label: "Nickname",
        value: "Ace",
      }),
    ]);

    // D-86: the label is optional on every type; clearing it keeps the value.
    await editMemory(exec, {
      id,
      contactId,
      customLabel: "  ",
      now: "2026-09-04 13:00:00",
    });
    expect(await listMemoriesForContact(exec, contactId)).toEqual([
      expect.objectContaining({
        id,
        type: "gift_idea",
        custom_label: null,
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
      await exec.getFirstAsync("SELECT id FROM memories WHERE id = ?", [
        liveId,
      ]),
    ).toEqual({ id: liveId });
    expect(
      await exec.getFirstAsync("SELECT id FROM memories WHERE id = ?", [
        deletedId,
      ]),
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
      expireMemoryIfStale(
        exec,
        { id: reDeletedId, contactId },
        "-30 days",
        NOW,
      ),
    ).resolves.toBe(false);

    expect(
      await exec.getFirstAsync("SELECT id FROM memories WHERE id = ?", [
        staleId,
      ]),
    ).toBeNull();
    expect(
      await exec.getFirstAsync("SELECT id FROM memories WHERE id = ?", [
        recentId,
      ]),
    ).toEqual({ id: recentId });
    expect(
      await exec.getFirstAsync("SELECT id FROM memories WHERE id = ?", [
        reDeletedId,
      ]),
    ).toEqual({ id: reDeletedId });
  });
});

describe("allowAi seeding (D-27, D-57, ADR-091)", () => {
  async function allowAiOf(id: number): Promise<number> {
    return (await exec.getFirstAsync<{ allow_ai: number }>(
      "SELECT allow_ai FROM memories WHERE id = ?",
      [id],
    ))!.allow_ai;
  }

  it("a share memory starts AI-off with the Memories default at 1", async () => {
    const contactId = await seedContact();
    await setAiPermissionDefault(exec, "memory", 1, NOW);
    const id = await addMemory(exec, {
      contactId,
      type: "general",
      provenance: "share",
      value: "Shared",
      createdAt: NOW,
      now: NOW,
    });
    expect(await allowAiOf(id)).toBe(0);
  });

  it("an explicit allowAi 1 is ignored for share and import, stored for user", async () => {
    const contactId = await seedContact();
    const share = await addMemory(exec, {
      contactId,
      type: "general",
      provenance: "share",
      allowAi: 1,
      value: "Shared",
      createdAt: NOW,
      now: NOW,
    });
    const imported = await addMemory(exec, {
      contactId,
      type: "imported",
      provenance: "import",
      allowAi: 1,
      value: "Imported",
      createdAt: NOW,
      now: NOW,
    });
    const user = await addMemory(exec, {
      contactId,
      type: "general",
      provenance: "user",
      allowAi: 1,
      value: "Mine",
      createdAt: NOW,
      now: NOW,
    });
    expect([
      await allowAiOf(share),
      await allowAiOf(imported),
      await allowAiOf(user),
    ]).toEqual([0, 0, 1]);
  });

  it("an explicit allowAi 0 wins over an ON default for provenance user", async () => {
    const contactId = await seedContact();
    await setAiPermissionDefault(exec, "memory", 1, NOW);
    const id = await addMemory(exec, {
      contactId,
      type: "general",
      allowAi: 0,
      value: "Private",
      createdAt: NOW,
      now: NOW,
    });
    expect(await allowAiOf(id)).toBe(0);
  });
});

describe("per-type AI defaults and markers (D-13, D-14, D-57, D-102)", () => {
  async function allowAiOf(id: number): Promise<number> {
    return (await exec.getFirstAsync<{ allow_ai: number }>(
      "SELECT allow_ai FROM memories WHERE id = ?",
      [id],
    ))!.allow_ai;
  }

  function add(type: string, extra: Record<string, unknown> = {}) {
    return seedContact().then((contactId) =>
      addMemory(exec, {
        contactId,
        type,
        value: `${type} value`,
        createdAt: NOW,
        now: NOW,
        ...extra,
      }),
    );
  }

  it("each typed memory follows its own default column", async () => {
    await setAiPermissionDefault(exec, "gift_idea", 1, NOW);
    expect(await allowAiOf(await add("gift_idea"))).toBe(1);
    expect(await allowAiOf(await add("thought_of_them"))).toBe(0);
    expect(await allowAiOf(await add("general"))).toBe(0);

    await setAiPermissionDefault(exec, "gift_idea", 0, NOW);
    await setAiPermissionDefault(exec, "thought_of_them", 1, NOW);
    expect(await allowAiOf(await add("gift_idea"))).toBe(0);
    expect(await allowAiOf(await add("thought_of_them"))).toBe(1);
    expect(await allowAiOf(await add("general"))).toBe(0);

    await setAiPermissionDefault(exec, "thought_of_them", 0, NOW);
    await setAiPermissionDefault(exec, "memory", 1, NOW);
    expect(await allowAiOf(await add("gift_idea"))).toBe(0);
    expect(await allowAiOf(await add("thought_of_them"))).toBe(0);
    expect(await allowAiOf(await add("general"))).toBe(1);
  });

  it("a share memory is AI-off with every default at 1; an import is AI-off too", async () => {
    for (const key of ["memory", "gift_idea", "thought_of_them"] as const) {
      await setAiPermissionDefault(exec, key, 1, NOW);
    }
    for (const type of ["general", "gift_idea", "thought_of_them"]) {
      expect(await allowAiOf(await add(type, { provenance: "share" }))).toBe(0);
    }
    expect(
      await allowAiOf(await add("imported", { provenance: "import" })),
    ).toBe(0);
  });

  it("accepts a label on any memory type, including label-only rows (D-86)", async () => {
    const contactId = await seedContact();
    for (const type of ["general", "gift_idea", "thought_of_them"]) {
      await addMemory(exec, {
        contactId,
        type,
        customLabel: `${type} label`,
        createdAt: NOW,
        now: NOW,
      });
    }
    await addMemory(exec, {
      contactId,
      type: "imported",
      provenance: "import",
      customLabel: "Imported label",
      value: "Imported value",
      createdAt: NOW,
      now: NOW,
    });
    expect(
      (await listMemoriesForContact(exec, contactId))
        .map((row) => [row.type, row.custom_label])
        .sort(),
    ).toEqual([
      ["general", "general label"],
      ["gift_idea", "gift_idea label"],
      ["imported", "Imported label"],
      ["thought_of_them", "thought_of_them label"],
    ]);
  });

  it("stores interaction_id and link_source, and MemoryRow exposes them", async () => {
    const contactId = await seedContact();
    const interactionId = await seedInteraction(contactId, "Talked shop");
    const id = await inWriteTransaction(exec, () =>
      addMemoryCore(exec, {
        contactId,
        type: "general",
        value: "Talked shop",
        interactionId,
        linkSource: "note",
        createdAt: NOW,
        now: NOW,
      }),
    );
    expect(await listMemoriesForContact(exec, contactId)).toEqual([
      expect.objectContaining({
        id,
        interaction_id: interactionId,
        link_source: "note",
        group_note_copy: 0,
      }),
    ]);
  });

  it("a Group Note copy is AI-off even for user provenance, allowAi 1 and every default at 1", async () => {
    for (const key of ["memory", "gift_idea", "thought_of_them"] as const) {
      await setAiPermissionDefault(exec, key, 1, NOW);
    }
    const id = await add("general", {
      provenance: "user",
      allowAi: 1,
      groupNoteCopy: 1,
    });
    expect(
      await exec.getFirstAsync(
        "SELECT allow_ai, group_note_copy FROM memories WHERE id = ?",
        [id],
      ),
    ).toEqual({ allow_ai: 0, group_note_copy: 1 });
  });
});

describe("editMemoryCore imported retype backstop (D-35; convergence c3)", () => {
  it("refuses imported -> general and general -> imported, and saves a same-type imported edit", async () => {
    const contactId = await seedContact();
    const imported = await addMemory(exec, {
      contactId,
      type: "imported",
      provenance: "import",
      value: "Imported",
      createdAt: NOW,
      now: NOW,
    });
    const general = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Mine",
      createdAt: NOW,
      now: NOW,
    });
    await expect(
      editMemory(exec, {
        id: imported,
        contactId,
        type: "general",
        value: "Changed",
        now: "2026-09-04 13:00:00",
      }),
    ).rejects.toBeInstanceOf(ImportedTypeProvenanceError);
    await expect(
      editMemory(exec, {
        id: general,
        contactId,
        type: "imported",
        now: "2026-09-04 13:00:00",
      }),
    ).rejects.toBeInstanceOf(ImportedTypeProvenanceError);
    expect(
      await exec.getAllAsync(
        "SELECT id, type, value, modified_at FROM memories ORDER BY id",
      ),
    ).toEqual([
      { id: imported, type: "imported", value: "Imported", modified_at: NOW },
      { id: general, type: "general", value: "Mine", modified_at: NOW },
    ]);

    await editMemory(exec, {
      id: imported,
      contactId,
      type: "imported",
      value: "Edited text",
      now: "2026-09-04 14:00:00",
    });
    await editMemory(exec, {
      id: imported,
      contactId,
      note: "No type in the patch",
      now: "2026-09-04 14:00:00",
    });
    expect(
      await exec.getFirstAsync(
        "SELECT type, value, note FROM memories WHERE id = ?",
        [imported],
      ),
    ).toEqual({
      type: "imported",
      value: "Edited text",
      note: "No type in the patch",
    });
  });
});

async function seedInteraction(
  contactId: number,
  note: string | null,
  options: { allowAi?: 0 | 1; groupEventId?: number | null } = {},
): Promise<number> {
  return (
    await exec.runAsync(
      `INSERT INTO interactions
         (uid, contact_id, occurred_at, recorded_at, note, source, modified_at,
          allow_ai, group_event_id)
       VALUES (?, ?, '2026-09-01 10:00:00', ?, ?, 'manual', ?, ?, ?)`,
      [
        `interaction-${++uidCounter}`,
        contactId,
        NOW,
        note,
        NOW,
        options.allowAi ?? 0,
        options.groupEventId ?? null,
      ],
    )
  ).lastInsertRowId;
}

async function seedGroupEvent(groupNote: string): Promise<number> {
  return (
    await exec.runAsync(
      `INSERT INTO group_events (uid, title, occurred_at, group_note, created_at, modified_at)
       VALUES (?, 'Dinner', '2026-08-30 19:00:00', ?, ?, ?)`,
      [`group-${++uidCounter}`, groupNote, NOW, NOW],
    )
  ).lastInsertRowId;
}

describe("memory delete with Undo (D-69; F-D3, F-D4, G-D1, G-D2, c9)", () => {
  const LATER = "2026-09-04 13:00:00";

  async function revision(): Promise<number> {
    return (await exec.getFirstAsync<{ data_revision: number }>(
      "SELECT data_revision FROM app_settings WHERE id=1",
    ))!.data_revision;
  }

  async function tombstoneStamp(uid: string): Promise<string | null> {
    return (
      (
        await exec.getFirstAsync<{ deleted_at: string }>(
          "SELECT deleted_at FROM tombstones WHERE entity_type='memory' AND entity_uid=?",
          [uid],
        )
      )?.deleted_at ?? null
    );
  }

  async function rowById(id: number) {
    return exec.getFirstAsync<Record<string, unknown>>(
      `SELECT id, uid, value, allow_ai, interaction_id, link_source,
              group_note_copy, modified_at, deleted_at
         FROM memories WHERE id = ?`,
      [id],
    );
  }

  function addLinked(
    contactId: number,
    interactionId: number,
    linkSource: "note" | "group_note",
    value: string,
    extra: { allowAi?: 0 | 1; groupNoteCopy?: 0 | 1 } = {},
  ) {
    return inWriteTransaction(exec, () =>
      addMemoryCore(exec, {
        contactId,
        type: "general",
        value,
        interactionId,
        linkSource,
        createdAt: NOW,
        now: NOW,
        ...extra,
      }),
    );
  }

  it("Undo restores the same id, uid and fields, live, with no tombstone and a newer modified_at", async () => {
    const contactId = await seedContact();
    const id = await addMemory(exec, {
      contactId,
      type: "gift_idea",
      customLabel: "Birthday",
      value: "A kite",
      note: "With a long tail",
      url: "https://example.test/kite",
      meaningfulDate: "2026-12-01",
      pinned: true,
      outdated: true,
      hidden: false,
      allowAi: 1,
      groupNoteCopy: 0,
      createdAt: NOW,
      now: NOW,
    });
    const before = (await listMemoriesForContact(exec, contactId))[0]!;
    const snapshot = await deleteMemoryNow(exec, {
      id,
      contactId,
      now: LATER,
    });
    expect(snapshot).not.toHaveProperty("deleted_at");
    expect(snapshot.tombstoned_at).toBe(LATER);
    expect(await rowById(id)).toBeNull();
    expect(await tombstoneStamp(snapshot.uid)).toBe(LATER);

    const restoredId = await undoMemoryDelete(
      exec,
      snapshot,
      "2026-09-04 13:05:00",
    );
    expect(restoredId).toBe(id);
    expect(await tombstoneStamp(snapshot.uid)).toBeNull();
    const live = await listMemoriesForContact(exec, contactId);
    expect(live).toEqual([{ ...before, modified_at: "2026-09-04 13:05:00" }]);
    expect(live[0]!.deleted_at).toBeNull();
    expect(
      (await listAiEligibleMemories(exec, contactId)).map((row) => row.id),
    ).toEqual([id]);
  });

  it("refuses another contact's id and a soft-deleted row", async () => {
    const alex = await seedContact("Alex");
    const blair = await seedContact("Blair");
    const id = await addMemory(exec, {
      contactId: blair,
      type: "general",
      value: "Blair's",
      createdAt: NOW,
      now: NOW,
    });
    await expect(
      deleteMemoryNow(exec, { id, contactId: alex, now: LATER }),
    ).rejects.toThrow("deleteMemoryNow: no memory matched");
    await deleteMemory(exec, { id, contactId: blair, now: NOW });
    await expect(
      deleteMemoryNow(exec, { id, contactId: blair, now: LATER }),
    ).rejects.toThrow("no memory matched");
    expect(await rowById(id)).not.toBeNull();
  });

  it("takes a new id with the same uid when another insert took the old id (W6)", async () => {
    const contactId = await seedContact();
    const id = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Original",
      createdAt: NOW,
      now: NOW,
    });
    const snapshot = await deleteMemoryNow(exec, { id, contactId, now: LATER });
    await exec.runAsync(
      `INSERT INTO memories (id, uid, contact_id, type, value, provenance, created_at, modified_at)
       VALUES (?, 'intruder', ?, 'general', 'Intruder', 'user', ?, ?)`,
      [id, contactId, NOW, NOW],
    );
    const restoredId = await undoMemoryDelete(exec, snapshot, LATER);
    expect(restoredId).not.toBe(id);
    expect(await rowById(restoredId)).toMatchObject({
      uid: snapshot.uid,
      value: "Original",
    });
  });

  it("Undo in the same second writes modified_at one second after the tombstone (F-D4)", async () => {
    const contactId = await seedContact();
    const id = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Same second",
      createdAt: NOW,
      now: NOW,
    });
    const snapshot = await deleteMemoryNow(exec, { id, contactId, now: LATER });
    await undoMemoryDelete(exec, snapshot, LATER);
    const restored = (await rowById(id)) as { modified_at: string };
    expect(restored.modified_at).toBe("2026-09-04 13:00:01");
    expect(
      compareRowAndTombstone(restored, { deleted_at: snapshot.tombstoned_at }),
    ).toBe("row");
  });

  it("delete → Undo → delete in one second leaves a tombstone that still wins (c9)", async () => {
    const contactId = await seedContact();
    const id = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Again",
      createdAt: NOW,
      now: NOW,
    });
    const first = await deleteMemoryNow(exec, { id, contactId, now: LATER });
    const restoredId = await undoMemoryDelete(exec, first, LATER);
    const restored = (await rowById(restoredId)) as { modified_at: string };
    const second = await deleteMemoryNow(exec, {
      id: restoredId,
      contactId,
      now: LATER,
    });
    const stamp = (await tombstoneStamp(first.uid))!;
    expect(stamp >= restored.modified_at).toBe(true);
    expect(second.tombstoned_at).toBe(stamp);
    expect(compareRowAndTombstone(restored, { deleted_at: stamp })).toBe(
      "tombstone",
    );
  });

  describe("the link on Undo (F-D3, G-D2)", () => {
    it("comes back unlinked, text and markers kept, when the interaction was deleted", async () => {
      const contactId = await seedContact();
      const interactionId = await seedInteraction(contactId, "Note text", {
        allowAi: 1,
      });
      const id = await addLinked(
        contactId,
        interactionId,
        "note",
        "Note text",
        {
          allowAi: 1,
        },
      );
      const snapshot = await deleteMemoryNow(exec, {
        id,
        contactId,
        now: LATER,
      });
      expect(snapshot.interaction_uid).toMatch(/^interaction-/);
      await exec.runAsync("DELETE FROM interactions WHERE id = ?", [
        interactionId,
      ]);
      await undoMemoryDelete(exec, snapshot, LATER);
      expect(await rowById(id)).toMatchObject({
        value: "Note text",
        interaction_id: null,
        link_source: null,
        allow_ai: 1,
        group_note_copy: 0,
      });
    });

    it("never links to another contact's interaction that reused the old id", async () => {
      const alex = await seedContact("Alex");
      const blair = await seedContact("Blair");
      const interactionId = await seedInteraction(alex, "Alex note");
      const id = await addLinked(alex, interactionId, "note", "Alex note");
      const snapshot = await deleteMemoryNow(exec, {
        id,
        contactId: alex,
        now: LATER,
      });
      await exec.runAsync("DELETE FROM interactions WHERE id = ?", [
        interactionId,
      ]);
      await exec.runAsync(
        `INSERT INTO interactions (id, uid, contact_id, occurred_at, recorded_at, note, source, modified_at)
         VALUES (?, 'blair-talk', ?, ?, ?, 'Blair note', 'manual', ?)`,
        [interactionId, blair, NOW, NOW, NOW],
      );
      await undoMemoryDelete(exec, snapshot, LATER);
      expect(await rowById(id)).toMatchObject({
        value: "Alex note",
        interaction_id: null,
        link_source: null,
      });
    });

    it("comes back unlinked when the slot is taken in memories", async () => {
      const contactId = await seedContact();
      const interactionId = await seedInteraction(contactId, "Note");
      const id = await addLinked(contactId, interactionId, "note", "Note");
      const snapshot = await deleteMemoryNow(exec, {
        id,
        contactId,
        now: LATER,
      });
      // The newer copy also takes the freed id, so Undo gets a new one (W6).
      await addLinked(contactId, interactionId, "note", "Newer copy");
      const restoredId = await undoMemoryDelete(exec, snapshot, LATER);
      expect(restoredId).not.toBe(id);
      expect(await rowById(restoredId)).toMatchObject({
        value: "Note",
        interaction_id: null,
        link_source: null,
      });
    });

    it("comes back unlinked when the slot is taken in current_state_entries", async () => {
      const contactId = await seedContact();
      const interactionId = await seedInteraction(contactId, "Note");
      const id = await addLinked(contactId, interactionId, "note", "Note");
      const snapshot = await deleteMemoryNow(exec, {
        id,
        contactId,
        now: LATER,
      });
      await exec.runAsync(
        `INSERT INTO current_state_entries
           (uid, contact_id, field_key, value, entry_date, created_at, modified_at,
            interaction_id, link_source)
         VALUES ('cs-1', ?, 'last_talked_about', 'Note', '2026-09-01', ?, ?, ?, 'note')`,
        [contactId, NOW, NOW, interactionId],
      );
      await undoMemoryDelete(exec, snapshot, LATER);
      expect(await rowById(id)).toMatchObject({
        value: "Note",
        interaction_id: null,
        link_source: null,
      });
    });

    it("a note link re-syncs to an edited note and to an AI-off switch", async () => {
      const contactId = await seedContact();
      const interactionId = await seedInteraction(contactId, "Old text", {
        allowAi: 1,
      });
      const id = await addLinked(contactId, interactionId, "note", "Old text", {
        allowAi: 1,
      });
      const snapshot = await deleteMemoryNow(exec, {
        id,
        contactId,
        now: LATER,
      });
      await exec.runAsync(
        "UPDATE interactions SET note = 'New text', allow_ai = 0 WHERE id = ?",
        [interactionId],
      );
      await undoMemoryDelete(exec, snapshot, LATER);
      expect(await rowById(id)).toMatchObject({
        value: "New text",
        interaction_id: interactionId,
        link_source: "note",
        allow_ai: 0,
      });
    });

    it("a note link whose note was cleared comes back unlinked with its old text", async () => {
      const contactId = await seedContact();
      const interactionId = await seedInteraction(contactId, "Old text");
      const id = await addLinked(contactId, interactionId, "note", "Old text");
      const snapshot = await deleteMemoryNow(exec, {
        id,
        contactId,
        now: LATER,
      });
      await exec.runAsync("UPDATE interactions SET note = '  ' WHERE id = ?", [
        interactionId,
      ]);
      await undoMemoryDelete(exec, snapshot, LATER);
      expect(await rowById(id)).toMatchObject({
        value: "Old text",
        interaction_id: null,
        link_source: null,
      });
    });

    it("a Group Note copy whose participant was detached comes back unlinked, AI-off, marker kept", async () => {
      const contactId = await seedContact();
      const eventId = await seedGroupEvent("Group text");
      const interactionId = await seedInteraction(contactId, null, {
        groupEventId: eventId,
      });
      const id = await addLinked(
        contactId,
        interactionId,
        "group_note",
        "Group text",
        { groupNoteCopy: 1 },
      );
      const snapshot = await deleteMemoryNow(exec, {
        id,
        contactId,
        now: LATER,
      });
      await exec.runAsync(
        "UPDATE interactions SET group_event_id = NULL WHERE id = ?",
        [interactionId],
      );
      await undoMemoryDelete(exec, snapshot, LATER);
      expect(await rowById(id)).toMatchObject({
        value: "Group text",
        interaction_id: null,
        link_source: null,
        group_note_copy: 1,
        allow_ai: 0,
      });
    });

    it("a Group Note copy whose event was dissolved comes back unlinked", async () => {
      const contactId = await seedContact();
      const eventId = await seedGroupEvent("Group text");
      const interactionId = await seedInteraction(contactId, null, {
        groupEventId: eventId,
      });
      const id = await addLinked(
        contactId,
        interactionId,
        "group_note",
        "Group text",
        { groupNoteCopy: 1 },
      );
      const snapshot = await deleteMemoryNow(exec, {
        id,
        contactId,
        now: LATER,
      });
      // Dissolving the event leaves the interaction alive, group_event_id NULL.
      await exec.runAsync("DELETE FROM group_events WHERE id = ?", [eventId]);
      await undoMemoryDelete(exec, snapshot, LATER);
      expect(await rowById(id)).toMatchObject({
        value: "Group text",
        interaction_id: null,
        group_note_copy: 1,
        allow_ai: 0,
      });
    });

    it("a Group Note copy whose Group Note was edited comes back linked with the new text", async () => {
      const contactId = await seedContact();
      const eventId = await seedGroupEvent("Group text");
      const interactionId = await seedInteraction(contactId, null, {
        groupEventId: eventId,
        allowAi: 1,
      });
      const id = await addLinked(
        contactId,
        interactionId,
        "group_note",
        "Group text",
        { groupNoteCopy: 1 },
      );
      const snapshot = await deleteMemoryNow(exec, {
        id,
        contactId,
        now: LATER,
      });
      await exec.runAsync(
        "UPDATE group_events SET group_note = 'Edited group text' WHERE id = ?",
        [eventId],
      );
      await undoMemoryDelete(exec, snapshot, LATER);
      expect(await rowById(id)).toMatchObject({
        value: "Edited group text",
        interaction_id: interactionId,
        link_source: "group_note",
        group_note_copy: 1,
        allow_ai: 0,
      });
    });
  });

  it("each wrapper advances data_revision by exactly 1; the core with bumpRevision false by 0", async () => {
    const contactId = await seedContact();
    const id = await addMemory(exec, {
      contactId,
      type: "general",
      value: "Count me",
      createdAt: NOW,
      now: NOW,
    });
    let before = await revision();
    const snapshot = await deleteMemoryNow(exec, { id, contactId, now: LATER });
    expect(await revision()).toBe(before + 1);
    before = await revision();
    const restoredId = await undoMemoryDelete(exec, snapshot, LATER);
    expect(await revision()).toBe(before + 1);
    before = await revision();
    await inWriteTransaction(exec, () =>
      deleteMemoryNowCore(exec, {
        id: restoredId,
        contactId,
        now: "2026-09-04 14:00:00",
        bumpRevision: false,
      }),
    );
    expect(await revision()).toBe(before);
  });
});
