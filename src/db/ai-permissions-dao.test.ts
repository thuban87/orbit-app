import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  type AiPermissionRef,
  aiDefaultKeyForMemoryType,
  bulkDisableAiPermissions,
  bulkEnableAiPermissions,
  getAiPermissionDefaults,
  getBulkPermissionImpact,
  listAiPermissionItems,
  memoryAiDefaultsMap,
  resolveNewItemAiDefault,
  setAiPermissionDefault,
  summarizeAiPermissionItems,
} from "@/db/ai-permissions-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { createGroupEvent, dissolveGroupEvent } from "@/db/group-events-dao";
import { moveKnowledgeEntry, undoKnowledgeMove } from "@/db/knowledge-move-dao";
import { insertLinkedEntryCore } from "@/db/linked-entry-dao";
import { runMigrations } from "@/db/migrations/runner";
import { recordTouchpointWithLinkedEntry } from "@/db/recency-dao";
import { inWriteTransaction } from "@/db/transaction";
import type { SqlExecutor } from "@/db/types";

const NOW = "2026-09-14 08:00:00";
let exec: SqlExecutor;
let nextUid = 0;
const uid = () => `permission-${++nextUid}`;

beforeEach(async () => {
  nextUid = 0;
  exec = nodeSqliteExecutor(openTestDb());
  await runMigrations(exec, MIGRATIONS, TARGET_VERSION, {
    now: NOW,
    newUid: uid,
  });
});

async function seedContact(name: string): Promise<number> {
  return (
    await exec.runAsync(
      `INSERT INTO contacts (uid,name,interval_days,created_at,modified_at)
       VALUES (?,?,?,?,?)`,
      [uid(), name, 30, NOW, NOW],
    )
  ).lastInsertRowId;
}

async function seedReviewRows() {
  const alex = await seedContact("Alex");
  const blair = await seedContact("Blair");
  const memory = await exec.runAsync(
    `INSERT INTO memories
       (uid,contact_id,type,value,allow_ai,created_at,modified_at)
     VALUES (?,?,?,?,1,?,?)`,
    [uid(), alex, "general", "Likes astronomy", NOW, NOW],
  );
  const disabledMemory = await exec.runAsync(
    `INSERT INTO memories
       (uid,contact_id,type,value,allow_ai,created_at,modified_at)
     VALUES (?,?,?,?,0,?,?)`,
    [uid(), blair, "gift_idea", "Keeps bees", NOW, NOW],
  );
  const note = await exec.runAsync(
    `INSERT INTO interactions
       (uid,contact_id,occurred_at,recorded_at,note,allow_ai,source,modified_at)
     VALUES (?,?,?,?,?,1,'manual',?)`,
    [uid(), alex, NOW, NOW, "Ask about the telescope", NOW],
  );
  const field = await exec.runAsync(
    `INSERT INTO custom_field_defs
       (uid,col_name,label,type,display_order,share_with_ai,created_at,modified_at)
     VALUES (?,?,'Favorite constellation','text',0,1,?,?)`,
    [uid(), "favorite_constellation", NOW, NOW],
  );
  for (const [contactId, value] of [
    [alex, "Orion"],
    [blair, "Lyra"],
  ] as const) {
    await exec.runAsync(
      `INSERT INTO custom_field_values
         (uid,contact_id,field_def_id,value,created_at,modified_at)
       VALUES (?,?,?,?,?,?)`,
      [uid(), contactId, field.lastInsertRowId, value, NOW, NOW],
    );
  }
  return {
    alex,
    blair,
    memoryId: memory.lastInsertRowId,
    disabledMemoryId: disabledMemory.lastInsertRowId,
    noteId: note.lastInsertRowId,
    fieldId: field.lastInsertRowId,
  };
}

describe("per-type new-item defaults (D-13, D-14, D-61)", () => {
  it("reads, writes and resolves the Gift Ideas and Thought of Them defaults on their own columns", async () => {
    await setAiPermissionDefault(exec, "gift_idea", 1, NOW);
    expect(await getAiPermissionDefaults(exec)).toEqual({
      memory: 0,
      interactionNote: 0,
      customField: 0,
      giftIdea: 1,
      thoughtOfThem: 0,
    });
    await expect(resolveNewItemAiDefault(exec, "gift_idea")).resolves.toBe(1);
    await expect(
      resolveNewItemAiDefault(exec, "thought_of_them"),
    ).resolves.toBe(0);
    await expect(resolveNewItemAiDefault(exec, "memory")).resolves.toBe(0);
    await setAiPermissionDefault(exec, "thought_of_them", 1, NOW);
    await expect(
      exec.getFirstAsync(
        "SELECT ai_default_gift_idea_allow AS g, ai_default_thought_of_them_allow AS t FROM app_settings WHERE id = 1",
      ),
    ).resolves.toEqual({ g: 1, t: 1 });
  });

  it("maps each memory type to its default key", () => {
    expect(aiDefaultKeyForMemoryType("gift_idea")).toBe("gift_idea");
    expect(aiDefaultKeyForMemoryType("thought_of_them")).toBe(
      "thought_of_them",
    );
    expect(aiDefaultKeyForMemoryType("general")).toBe("memory");
    expect(aiDefaultKeyForMemoryType("imported")).toBe("memory");
  });

  it("memoryAiDefaultsMap gives each user-pickable type its own default", () => {
    expect(
      memoryAiDefaultsMap({
        memory: 1,
        interactionNote: 0,
        customField: 0,
        giftIdea: 0,
        thoughtOfThem: 0,
      }),
    ).toEqual({ general: 1, gift_idea: 0, thought_of_them: 0 });
  });

  it("a new key can never be routed into the review writers (closed union)", async () => {
    await expect(
      bulkEnableAiPermissions(
        exec,
        [{ category: "gift_idea" as never, id: 1 }],
        NOW,
      ),
    ).rejects.toThrow("unknown category");
  });
});

describe("AI permissions DAO", () => {
  it("reads and writes category defaults without changing existing permissions", async () => {
    const seeded = await seedReviewRows();
    expect(await getAiPermissionDefaults(exec)).toEqual({
      memory: 0,
      interactionNote: 0,
      customField: 0,
      giftIdea: 0,
      thoughtOfThem: 0,
    });

    await setAiPermissionDefault(exec, "memory", 1, NOW);

    await expect(resolveNewItemAiDefault(exec, "memory")).resolves.toBe(1);
    await expect(
      resolveNewItemAiDefault(exec, "interaction-note"),
    ).resolves.toBe(0);
    await expect(
      exec.getFirstAsync("SELECT allow_ai FROM memories WHERE id = ?", [
        seeded.disabledMemoryId,
      ]),
    ).resolves.toEqual({ allow_ai: 0 });
    await expect(
      exec.getFirstAsync("SELECT allow_ai FROM interactions WHERE id = ?", [
        seeded.noteId,
      ]),
    ).resolves.toEqual({ allow_ai: 1 });
    await expect(
      exec.getFirstAsync(
        "SELECT share_with_ai FROM custom_field_defs WHERE id = ?",
        [seeded.fieldId],
      ),
    ).resolves.toEqual({ share_with_ai: 1 });
  });

  it("returns semantic, stable review rows and supports type/enabled/contact filters", async () => {
    await seedReviewRows();
    const all = await listAiPermissionItems(exec, {});

    expect(
      all.map((item) => [item.contactName, item.category, item.label]),
    ).toEqual([
      ["Alex", "memory", "Memory"],
      ["Alex", "interaction-note", "Interaction note"],
      ["Alex", "custom-field", "Favorite constellation"],
      ["Blair", "memory", "Gift Ideas"],
      ["Blair", "custom-field", "Favorite constellation"],
    ]);
    expect(
      (await listAiPermissionItems(exec, { enabledOnly: true })).every(
        (item) => item.enabled === 1,
      ),
    ).toBe(true);
    expect(
      await listAiPermissionItems(exec, { category: "interaction-note" }),
    ).toHaveLength(1);
    expect(
      await listAiPermissionItems(exec, { contactQuery: "BLA" }),
    ).toHaveLength(2);
  });

  it("counts distinct contacts once when they appear under multiple types", async () => {
    await seedReviewRows();
    const enabled = await listAiPermissionItems(exec, { enabledOnly: true });
    expect(summarizeAiPermissionItems(enabled)).toEqual({
      contacts: 2,
      items: 4,
    });
  });

  it("bulk enables and disables explicit selections inside one logical write", async () => {
    const seeded = await seedReviewRows();
    const selection: AiPermissionRef[] = [
      { category: "memory", id: seeded.disabledMemoryId },
      { category: "custom-field", id: seeded.fieldId },
    ];
    await exec.runAsync(
      "UPDATE custom_field_defs SET share_with_ai=0 WHERE id=?",
      [seeded.fieldId],
    );

    await expect(getBulkPermissionImpact(exec, selection)).resolves.toEqual({
      contacts: 2,
      items: 3,
    });
    await expect(
      bulkEnableAiPermissions(exec, selection, NOW),
    ).resolves.toEqual({
      contacts: 2,
      items: 3,
    });
    await expect(
      exec.getFirstAsync("SELECT allow_ai FROM memories WHERE id=?", [
        seeded.disabledMemoryId,
      ]),
    ).resolves.toEqual({ allow_ai: 1 });
    await expect(
      bulkDisableAiPermissions(
        exec,
        [{ category: "interaction-note", id: seeded.noteId }],
        NOW,
      ),
    ).resolves.toEqual({ contacts: 1, items: 1 });
    await expect(bulkEnableAiPermissions(exec, [], NOW)).rejects.toThrow(
      /explicit selection/,
    );
  });

  it("enable impact counts only information that will newly become accessible", async () => {
    const seeded = await seedReviewRows();
    await expect(
      getBulkPermissionImpact(exec, [
        { category: "memory", id: seeded.memoryId },
        { category: "memory", id: seeded.disabledMemoryId },
      ]),
    ).resolves.toEqual({ contacts: 1, items: 1 });
  });

  it("contains no query path for excluded information stores", () => {
    const source = readFileSync(
      new URL("./ai-permissions-dao.ts", import.meta.url),
      "utf8",
    );
    // D-09 / D-10: no SQL against Off Limits or Group Events (Group Notes
    // never reach AI, ADR-078 / ADR-136). "off_limits" may appear as a lock
    // label (checker cycle 3 B-3).
    expect(source).not.toMatch(
      /\b(FROM|JOIN|INTO|UPDATE)\s+(off_limits|group_events)\b/i,
    );
    expect(source).toContain('"off_limits"');
    expect(source).not.toMatch(/enableAll|disableAll/);
  });
});

describe("review list eligibility and locks (ADR-136; D-86, D-102, D-103)", () => {
  async function allowOf(table: "memories" | "interactions", id: number) {
    return (
      await exec.getFirstAsync<{ allow_ai: number }>(
        `SELECT allow_ai FROM ${table} WHERE id = ?`,
        [id],
      )
    )?.allow_ai;
  }

  async function noteLinked(allowAi: 0 | 1) {
    const contactId = await seedContact("Casey");
    const { interactionId, linkedEntry } =
      await recordTouchpointWithLinkedEntry(
        exec,
        {
          contactId,
          uid: uid(),
          occurredAt: "2026-09-10 10:00:00",
          now: NOW,
          note: "Moving to Denver",
          allowAi,
        },
        "memory",
      );
    if (!linkedEntry) throw new Error("no linked entry");
    return { contactId, interactionId, memoryId: linkedEntry.id };
  }

  async function groupCopy() {
    const alex = await seedContact("Alex");
    const sam = await seedContact("Sam");
    const { groupEventId } = await createGroupEvent(exec, {
      uid: uid(),
      title: "Dinner",
      occurredAt: "2026-09-10 19:00:00",
      now: NOW,
      groupNote: "Reunion plans",
      participants: [
        { contactId: alex, uid: uid() },
        { contactId: sam, uid: uid() },
      ],
    });
    const child = await exec.getFirstAsync<{ id: number }>(
      "SELECT id FROM interactions WHERE group_event_id = ? AND contact_id = ?",
      [groupEventId, alex],
    );
    if (!child) throw new Error("no child");
    const ref = await inWriteTransaction(exec, () =>
      insertLinkedEntryCore(exec, {
        interactionId: child.id,
        contactId: alex,
        section: "memory",
        text: "Reunion plans",
        linkSource: "group_note",
        occurredAt: "2026-09-10 19:00:00",
        now: NOW,
      }),
    );
    return { groupEventId, memoryId: ref.id };
  }

  it("lists a label-only memory under its label with the type's name as value, and bulk-disables it", async () => {
    const alex = await seedContact("Alex");
    const memory = await exec.runAsync(
      `INSERT INTO memories
         (uid,contact_id,type,custom_label,allow_ai,created_at,modified_at)
       VALUES (?,?,'thought_of_them','Anniversary',1,?,?)`,
      [uid(), alex, NOW, NOW],
    );
    const items = await listAiPermissionItems(exec, { category: "memory" });
    expect(items).toEqual([
      expect.objectContaining({
        id: memory.lastInsertRowId,
        label: "Anniversary",
        value: "Thought of Them",
        enabled: 1,
        locked: null,
      }),
    ]);
    await bulkDisableAiPermissions(
      exec,
      [{ category: "memory", id: memory.lastInsertRowId }],
      NOW,
    );
    expect(await allowOf("memories", memory.lastInsertRowId)).toBe(0);
  });

  it("lists a note-linked pair as two items, one per category, switched together (G-D6)", async () => {
    const { interactionId, memoryId } = await noteLinked(1);
    const keys = (await listAiPermissionItems(exec, {})).map((i) => i.itemKey);
    expect(keys).toEqual([
      `memory:${memoryId}`,
      `interaction-note:${interactionId}`,
    ]);
    await expect(
      bulkDisableAiPermissions(
        exec,
        [
          { category: "memory", id: memoryId },
          { category: "interaction-note", id: interactionId },
        ],
        NOW,
      ),
    ).resolves.toEqual({ contacts: 1, items: 2 });
    await bulkEnableAiPermissions(
      exec,
      [{ category: "interaction-note", id: interactionId }],
      NOW,
    );
    expect(await allowOf("memories", memoryId)).toBe(1);
    await bulkDisableAiPermissions(
      exec,
      [{ category: "memory", id: memoryId }],
      NOW,
    );
    expect(await allowOf("interactions", interactionId)).toBe(0);
  });

  it("reports a Group Note copy as locked before and after its event is dissolved (D-102)", async () => {
    const { groupEventId, memoryId } = await groupCopy();
    const lockOf = async () =>
      (await listAiPermissionItems(exec, { category: "memory" })).find(
        (item) => item.id === memoryId,
      )?.locked;
    expect(await lockOf()).toBe("group_note");
    await dissolveGroupEvent(exec, { groupEventId, now: NOW });
    await exec.runAsync(
      "UPDATE memories SET interaction_id = NULL, link_source = NULL WHERE id = ?",
      [memoryId],
    );
    expect(await lockOf()).toBe("group_note");
  });

  it("bulk enable over a mixed selection turns on only the unlocked items and counts only them", async () => {
    const seeded = await seedReviewRows();
    const { memoryId: copyId } = await groupCopy();
    const locked = await noteLinked(0);
    await exec.runAsync(
      "UPDATE interactions SET note_ai_locked = 1 WHERE id = ?",
      [locked.interactionId],
    );
    const selection: AiPermissionRef[] = [
      { category: "memory", id: seeded.disabledMemoryId },
      { category: "memory", id: copyId },
      { category: "memory", id: locked.memoryId },
      { category: "interaction-note", id: locked.interactionId },
    ];
    const items = await listAiPermissionItems(exec, {});
    expect(
      items
        .filter((item) => item.locked !== null)
        .map((item) => [item.itemKey, item.locked]),
    ).toEqual([
      [`memory:${copyId}`, "group_note"],
      [`memory:${locked.memoryId}`, "off_limits"],
      [`interaction-note:${locked.interactionId}`, "off_limits"],
    ]);
    await expect(getBulkPermissionImpact(exec, selection)).resolves.toEqual({
      contacts: 1,
      items: 1,
    });
    await expect(
      bulkEnableAiPermissions(exec, selection, NOW),
    ).resolves.toEqual({ contacts: 1, items: 1 });
    expect(await allowOf("memories", seeded.disabledMemoryId)).toBe(1);
    expect(await allowOf("memories", copyId)).toBe(0);
    expect(await allowOf("memories", locked.memoryId)).toBe(0);
    expect(await allowOf("interactions", locked.interactionId)).toBe(0);
  });

  it("a note moved to Off Limits and undone stays AI-off on both sides through the DAO path (D-103)", async () => {
    const { contactId, interactionId, memoryId } = await noteLinked(1);
    const moved = await moveKnowledgeEntry(exec, {
      ref: { table: "memories", id: memoryId, contactId },
      target: "off_limits",
      now: NOW,
    });
    const restored = await undoKnowledgeMove(exec, moved.undo, NOW);
    expect(
      await exec.getFirstAsync(
        "SELECT allow_ai, interaction_id, link_source FROM memories WHERE id = ?",
        [restored.id],
      ),
    ).toEqual({
      allow_ai: 0,
      interaction_id: interactionId,
      link_source: "note",
    });
    expect(
      await exec.getFirstAsync(
        "SELECT allow_ai, note_ai_locked FROM interactions WHERE id = ?",
        [interactionId],
      ),
    ).toEqual({ allow_ai: 0, note_ai_locked: 1 });

    await expect(
      bulkEnableAiPermissions(
        exec,
        [{ category: "interaction-note", id: interactionId }],
        NOW,
      ),
    ).resolves.toEqual({ contacts: 0, items: 0 });
    expect(await allowOf("interactions", interactionId)).toBe(0);
    expect(await allowOf("memories", restored.id)).toBe(0);
  });
});
