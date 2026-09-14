import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({}));

import { nodeSqliteExecutor, openTestDb } from "@/db/__testkit__/node-sqlite";
import {
  bulkDisableAiPermissions,
  bulkEnableAiPermissions,
  getAiPermissionDefaults,
  getBulkPermissionImpact,
  listAiPermissionItems,
  resolveNewItemAiDefault,
  setAiPermissionDefault,
  summarizeAiPermissionItems,
  type AiPermissionRef,
} from "@/db/ai-permissions-dao";
import { MIGRATIONS, TARGET_VERSION } from "@/db/database";
import { runMigrations } from "@/db/migrations/runner";
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
    [uid(), blair, "custom", "Keeps bees", NOW, NOW],
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

describe("AI permissions DAO", () => {
  it("reads and writes category defaults without changing existing permissions", async () => {
    const seeded = await seedReviewRows();
    expect(await getAiPermissionDefaults(exec)).toEqual({
      memory: 0,
      interactionNote: 0,
      customField: 0,
    });

    await setAiPermissionDefault(exec, "memory", 1, NOW);

    await expect(resolveNewItemAiDefault(exec, "memory")).resolves.toBe(1);
    await expect(resolveNewItemAiDefault(exec, "interaction-note")).resolves.toBe(0);
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

    expect(all.map((item) => [item.contactName, item.category, item.label])).toEqual([
      ["Alex", "memory", "Memory"],
      ["Alex", "interaction-note", "Interaction note"],
      ["Alex", "custom-field", "Favorite constellation"],
      ["Blair", "memory", "Custom"],
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
    expect(await listAiPermissionItems(exec, { contactQuery: "BLA" })).toHaveLength(2);
  });

  it("counts distinct contacts once when they appear under multiple types", async () => {
    await seedReviewRows();
    const enabled = await listAiPermissionItems(exec, { enabledOnly: true });
    expect(summarizeAiPermissionItems(enabled)).toEqual({ contacts: 2, items: 4 });
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
    await expect(bulkEnableAiPermissions(exec, selection, NOW)).resolves.toEqual({
      contacts: 2,
      items: 3,
    });
    await expect(
      exec.getFirstAsync("SELECT allow_ai FROM memories WHERE id=?", [
        seeded.disabledMemoryId,
      ]),
    ).resolves.toEqual({ allow_ai: 1 });
    await expect(
      bulkDisableAiPermissions(exec, [
        { category: "interaction-note", id: seeded.noteId },
      ], NOW),
    ).resolves.toEqual({ contacts: 1, items: 1 });
    await expect(bulkEnableAiPermissions(exec, [], NOW)).rejects.toThrow(
      /explicit selection/,
    );
  });

  it("contains no query path for excluded information stores", () => {
    const source = readFileSync(new URL("./ai-permissions-dao.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/\bfuel\b|off_limits|group_events/i);
    expect(source).not.toMatch(/enableAll|disableAll/);
  });
});
